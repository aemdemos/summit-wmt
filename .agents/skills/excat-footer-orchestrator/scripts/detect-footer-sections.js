#!/usr/bin/env node

/*
 * detect-footer-sections.js
 *
 * MANDATORY Phase 1 script — programmatic section detection from live page.
 * Never set sectionCount from screenshot alone. This script MUST run before phase-1-section-detection.json.
 *
 * Uses Playwright to navigate, run page.evaluate(), and write phase-1-section-detection.json.
 * Writes .section-detection-complete marker so the gate can enforce execution.
 *
 * Usage:
 *   node .../detect-footer-sections.js --url=<source-url>
 *   [--validation-dir=<path>] [--viewport=1440x900] [--cookie-selector=<css>]
 *
 * Exit codes:
 *   0 = success, phase-1 written
 *   1 = script error (navigation failed, no footer found)
 *   2 = usage error
 */

import fs from 'fs';
import path from 'path';
import { VALIDATION_DIR } from './validation-paths.js';
import { fileURLToPath } from 'url';
import { runFooterSectionDetection } from './footer-section-detection-evaluate.js';
import { tryDismissCookieBanner } from './cookie-banner-dismiss.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

function findLocalChromiumExecutable() {
  const localBrowsers = path.resolve(scriptDir, 'playwright-browsers');
  if (!fs.existsSync(localBrowsers)) return null;
  const chromiumDirs = fs.readdirSync(localBrowsers).filter((d) => d.startsWith('chromium-'));
  const candidates = chromiumDirs.flatMap((dir) => [
    path.join(localBrowsers, dir, 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'),
    path.join(localBrowsers, dir, 'chrome-linux', 'chrome'),
  ]);
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function debugLog(validationDir, level, msg) {
  const ts = new Date().toISOString();
  const prefix = { ERROR: '❌', PASS: '✅', BLOCK: '🚫', START: '🔵', END: '🏁' }[level] || 'ℹ️';
  const entry = `[${ts}] ${prefix} [SCRIPT:detect-footer-sections] [${level}] ${msg}\n`;
  try {
    if (fs.existsSync(validationDir)) fs.appendFileSync(path.join(validationDir, 'debug.log'), entry);
  } catch { /* ignore */ }
}

function parseArgs() {
  const args = process.argv.slice(2);
  let url = null;
  let validationDir = VALIDATION_DIR;
  let viewport = '1440x900';
  let cookieSelector = null;
  args.forEach((a) => {
    if (a.startsWith('--url=')) url = a.slice(6);
    else if (a.startsWith('--validation-dir=')) validationDir = a.slice(17);
    else if (a.startsWith('--viewport=')) viewport = a.slice(11);
    else if (a.startsWith('--cookie-selector=')) cookieSelector = a.slice(18);
  });
  return { url, validationDir, viewport, cookieSelector };
}

async function main() {
  const { url, validationDir, viewport, cookieSelector } = parseArgs();
  if (!url) {
    console.error('Usage: node .../detect-footer-sections.js --url=<source-url> [--validation-dir=<path>]');
    process.exit(2);
  }

  const absValidationDir = path.resolve(validationDir);
  debugLog(absValidationDir, 'START', `detect-footer-sections.js invoked — url=${url}, validationDir=${validationDir}`);

  let chromium;
  try {
    const pw = await import('playwright');
    chromium = pw.chromium;
  } catch (e) {
    console.error('Playwright not found. Install: npm install playwright');
    debugLog(absValidationDir, 'ERROR', `Playwright import failed: ${e.message}`);
    process.exit(2);
  }

  const [rawW, rawH] = viewport.split('x').map(Number);
  const vw = Number.isFinite(rawW) ? rawW : 1440;
  const vh = Number.isFinite(rawH) ? rawH : 900;
  const execPath = findLocalChromiumExecutable();
  const launchOpts = { headless: true };
  if (execPath) launchOpts.executablePath = execPath;

  let browser;
  try {
    browser = await chromium.launch(launchOpts);
    const page = await browser.newPage();
    await page.setViewportSize({ width: vw, height: vh });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const cookieResult = await tryDismissCookieBanner(page, { cookieSelector });
    if (cookieResult) {
      debugLog(absValidationDir, 'PASS', `cookie banner dismissed via ${cookieResult}`);
    }

    async function scrollAndRunDetection() {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);
      return page.evaluate(runFooterSectionDetection, 'desktop');
    }

    let result = await scrollAndRunDetection();
    if (result.error === 'no footer found' || result.sectionCount === 0) {
      debugLog(absValidationDir, 'WARN', 'Footer pass empty — networkidle wait + retry (SPA / late render)');
      await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(800);
      result = await scrollAndRunDetection();
    }

    await browser.close();

    if (result.error) {
      console.error(`FAIL: ${result.error}`);
      debugLog(absValidationDir, 'BLOCK', `FAILED — ${result.error}`);
      process.exit(1);
    }

    const sumOfDetectedSectionHeights = result.sections.reduce((sum, s) => sum + (s.heightPx || 0), 0);
    const footerHeight = result.footerHeightForSanity ?? 0;
    let heightMismatch = false;
    if (footerHeight > 0 && sumOfDetectedSectionHeights > 0 && footerHeight > sumOfDetectedSectionHeights * 1.3) {
      console.warn(`[WARN] Footer total height (${Math.round(footerHeight)}px) is significantly larger than sum of detected sections (${Math.round(sumOfDetectedSectionHeights)}px). Likely a missed section.`);
      heightMismatch = true;
    }

    const phase1 = {
      sectionCount: result.sectionCount,
      sections: result.sections,
      totalHeightPx: result.totalHeightPx,
      confidence: result.sectionCount > 0 ? 0.95 : 0,
      uncertainty: result.sectionCount === 0,
      notes: result.sections.length > 0
        ? result.sections.map((s) => `Section ${s.index}: tag=${s.tag}, height=${s.heightPx}px, links=${s.linkCount}, images=${s.imageCount || 0}`)
        : ['No footer sections detected'],
      ...(heightMismatch && {
        heightMismatch: true,
        footerTotalHeight: Math.round(footerHeight),
        detectedSectionsHeight: Math.round(sumOfDetectedSectionHeights),
      }),
    };

    if (!fs.existsSync(absValidationDir)) fs.mkdirSync(absValidationDir, { recursive: true });
    fs.writeFileSync(path.join(absValidationDir, 'phase-1-section-detection.json'), JSON.stringify(phase1, null, 2));
    fs.writeFileSync(
      path.join(absValidationDir, '.section-detection-complete'),
      JSON.stringify({ timestamp: new Date().toISOString(), sectionCount: result.sectionCount, url, heightMismatch }),
    );

    console.log('=== Section Detection Complete ===');
    console.log(`sectionCount: ${result.sectionCount}`);
    console.log(`totalHeight: ${result.totalHeightPx}px`);
    result.sections.forEach((s) => console.log(`  Section ${s.index}: ${s.tag}, ${s.heightPx}px, links=${s.linkCount}`));
    if (heightMismatch) {
      console.log(`[WARN] heightMismatch: footer ${Math.round(footerHeight)}px vs detected sections ${Math.round(sumOfDetectedSectionHeights)}px`);
    }
    debugLog(absValidationDir, 'PASS', `PASSED — sectionCount=${result.sectionCount}, totalHeight=${result.totalHeightPx}px, heightMismatch=${heightMismatch}`);
    process.exit(0);
  } catch (e) {
    if (browser) await browser.close().catch(() => {});
    console.error(`FAIL: ${e.message}`);
    debugLog(absValidationDir, 'BLOCK', `FAILED — ${e.message}`);
    process.exit(1);
  }
}

main();
