#!/usr/bin/env node

/*
 * detect-footer-mobile-sections.js
 *
 * Programmatic footer section detection at MOBILE viewport (default 375×812).
 * Run on the SOURCE URL after phase-4-mobile.json — baseline for mobile structural parity.
 * Writes mobile/mobile-footer-structure-detection.json + .mobile-footer-structure-detection-complete.
 *
 * Usage:
 *   node .../detect-footer-mobile-sections.js --url=<source-url>
 *   [--validation-dir=migration-work/footer-validation] [--viewport=375x812] [--cookie-selector=<css>]
 *
 * Exit: 0 success, 1 error, 2 usage
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
  const entry = `[${ts}] ${prefix} [SCRIPT:detect-footer-mobile-sections] [${level}] ${msg}\n`;
  try {
    if (fs.existsSync(validationDir)) fs.appendFileSync(path.join(validationDir, 'debug.log'), entry);
  } catch { /* ignore */ }
}

function parseArgs() {
  const args = process.argv.slice(2);
  let url = null;
  let validationDir = VALIDATION_DIR;
  let viewport = '375x812';
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
    console.error('Usage: node .../detect-footer-mobile-sections.js --url=<source-url> [--validation-dir=<path>] [--viewport=375x812]');
    process.exit(2);
  }

  const absValidationDir = path.resolve(validationDir);
  const mobileDir = path.join(absValidationDir, 'mobile');
  debugLog(absValidationDir, 'START', `detect-footer-mobile-sections.js — url=${url}, viewport=${viewport}`);

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
  const vw = Number.isFinite(rawW) ? rawW : 375;
  const vh = Number.isFinite(rawH) ? rawH : 812;
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
      debugLog(absValidationDir, 'PASS', `[MOBILE] cookie banner dismissed via ${cookieResult}`);
    }

    async function scrollAndRunDetection() {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);
      return page.evaluate(runFooterSectionDetection, 'mobile');
    }

    let result = await scrollAndRunDetection();
    if (result.error === 'no footer found' || result.sectionCount === 0) {
      debugLog(absValidationDir, 'WARN', '[MOBILE] Footer pass empty — networkidle + retry');
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

    const payload = {
      viewport: `${vw}x${vh}`,
      url,
      timestamp: new Date().toISOString(),
      sectionCount: result.sectionCount,
      sections: result.sections,
      totalHeightPx: result.totalHeightPx,
      confidence: result.sectionCount > 0 ? 0.95 : 0,
      uncertainty: result.sectionCount === 0,
      notes: result.sections.length > 0
        ? result.sections.map((s) => `Mobile section ${s.index}: ${s.tag}, links=${s.linkCount}`)
        : ['No footer sections detected at mobile viewport'],
    };

    if (!fs.existsSync(mobileDir)) fs.mkdirSync(mobileDir, { recursive: true });
    fs.writeFileSync(path.join(mobileDir, 'mobile-footer-structure-detection.json'), JSON.stringify(payload, null, 2));
    fs.writeFileSync(
      path.join(mobileDir, '.mobile-footer-structure-detection-complete'),
      JSON.stringify({ timestamp: new Date().toISOString(), sectionCount: result.sectionCount, url, viewport: `${vw}x${vh}` }),
    );

    console.log('=== Mobile footer structure detection complete ===');
    console.log(`viewport: ${vw}x${vh}, sectionCount: ${result.sectionCount}`);
    debugLog(absValidationDir, 'PASS', `PASSED — sectionCount=${result.sectionCount}`);
    process.exit(0);
  } catch (e) {
    if (browser) await browser.close().catch(() => {});
    console.error(`FAIL: ${e.message}`);
    debugLog(absValidationDir, 'BLOCK', `FAILED — ${e.message}`);
    process.exit(1);
  }
}

main();
