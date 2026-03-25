#!/usr/bin/env node

/*
 * audit-footer-images.js
 *
 * Three modes:
 *   1) FOOTER MODE: expected vs actual from phase files
 *      node .../audit-footer-images.js <footer-file> <validation-dir>
 *   2) URL MODE: produce image manifest from live page footer
 *      node .../audit-footer-images.js --url=<url> --output=<manifest.json>
 *   3) COMPARE MODE: source vs migrated manifest
 *      node .../audit-footer-images.js --compare=source.json --against=migrated.json
 *
 * Exit codes: 0 = pass, 1 = fail, 2 = usage error
 */

import fs from 'fs';
import path from 'path';

function debugLog(validationDir, level, msg) {
  const ts = new Date().toISOString();
  const prefix = { ERROR: '❌', PASS: '✅', BLOCK: '🚫', START: '🔵', END: '🏁' }[level] || 'ℹ️';
  const entry = `[${ts}] ${prefix} [SCRIPT:audit-footer-images] [${level}] ${msg}\n`;
  try {
    if (validationDir && fs.existsSync(validationDir)) fs.appendFileSync(path.join(validationDir, 'debug.log'), entry);
  } catch (_) { /* ignore */ }
}

function loadJson(p) {
  try { if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch (_) { /* ignore */ }
  return null;
}

function extractImagePaths(content) {
  const paths = [];
  let m;
  const mdP = /!\[.*?\]\(([^)]+)\)/g;
  while ((m = mdP.exec(content)) !== null) paths.push(m[1].trim());
  const htmlP = /<img\s[^>]*src=["']([^"']+)["']/gi;
  while ((m = htmlP.exec(content)) !== null) paths.push(m[1].trim());
  return paths;
}

function buildExpectedSlots(valDir) {
  const slots = [];
  const p2 = loadJson(path.join(valDir, 'phase-2-section-mapping.json'));
  if (p2?.sections) {
    for (const section of p2.sections) {
      if (section.hasImages) {
        slots.push({ location: `Section ${section.index}`, description: `Images in section ${section.index} (${section.type || 'unknown'})` });
      }
      if (section.hasSocialIcons) {
        slots.push({ location: `Section ${section.index} social icons`, description: 'Social media icons' });
      }
      if (section.hasBrandLogos) {
        slots.push({ location: `Section ${section.index} brand logos`, description: 'Brand or division logos' });
      }
    }
  }
  return { expectedSlots: slots, expectedCount: slots.length };
}

async function runUrlMode(url, outputPath, validationDir) {
  let chromium;
  try { const pw = await import('playwright'); chromium = pw.chromium; }
  catch { console.error('Playwright required for --url mode.'); process.exit(2); }
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    const manifest = await page.evaluate((baseUrl) => {
      const footer = document.querySelector('footer, [role="contentinfo"]');
      const root = footer || document.body;
      const images = [];
      const seen = new Set();
      const add = (entry) => {
        const key = (entry.sourceUrl || entry.src || '').trim();
        if (key && !seen.has(key)) { seen.add(key); images.push(entry); }
      };
      root.querySelectorAll('img').forEach(el => {
        const rect = el.getBoundingClientRect();
        const src = el.getAttribute('src') || el.currentSrc || '';
        if (!src) return;
        const full = src.startsWith('http') ? src : new URL(src, baseUrl).href;
        add({ type: 'img', sourceUrl: full, localFilename: (src.split('/').pop() || '').replace(/\?.*$/, ''), description: (el.getAttribute('alt') || '').slice(0, 80), context: 'footer', visible: rect.height > 0, size: `${Math.round(rect.width)}x${Math.round(rect.height)}` });
      });
      root.querySelectorAll('svg').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.height === 0 && rect.width === 0) return;
        add({ type: 'svg', sourceUrl: '', localFilename: '', description: (el.getAttribute('class') || 'svg').slice(0, 60), context: 'footer', visible: true, size: `${Math.round(rect.width)}x${Math.round(rect.height)}` });
      });
      root.querySelectorAll('*').forEach(el => {
        const bg = window.getComputedStyle(el).backgroundImage;
        if (!bg || bg === 'none' || bg.includes('gradient') || !bg.includes('url(')) return;
        const m = bg.match(/url\(["']?([^"')]+)["']?\)/);
        if (!m) return;
        const src = m[1].trim();
        const full = src.startsWith('http') ? src : new URL(src, baseUrl).href;
        const rect = el.getBoundingClientRect();
        if (rect.height < 10 || rect.width < 10) return;
        add({ type: 'background-image', sourceUrl: full, localFilename: (src.split('/').pop() || '').replace(/\?.*$/, ''), description: (el.getAttribute('class') || '').slice(0, 60), context: 'footer', visible: true, size: `${Math.round(rect.width)}x${Math.round(rect.height)}` });
      });
      return { url: baseUrl, timestamp: new Date().toISOString(), images, summary: { total: images.length } };
    }, url);
    await browser.close();
    const outAbs = path.isAbsolute(outputPath) ? outputPath : path.join(process.cwd(), outputPath);
    fs.mkdirSync(path.dirname(outAbs), { recursive: true });
    fs.writeFileSync(outAbs, JSON.stringify(manifest, null, 2));
    console.log(`Wrote manifest: ${outAbs} (${manifest.summary.total} images)`);
    if (validationDir) debugLog(path.resolve(validationDir), 'PASS', `URL manifest — ${manifest.summary.total} images`);
    process.exit(0);
  } catch (e) {
    await browser.close().catch(() => {});
    console.error('FAIL:', e.message);
    process.exit(1);
  }
}

function runCompareMode(comparePath, againstPath, validationDir) {
  const src = loadJson(path.resolve(comparePath));
  const mig = loadJson(path.resolve(againstPath));
  if (!src?.images) { console.error('Source manifest invalid'); process.exit(2); }
  if (!mig?.images) { console.error('Migrated manifest invalid'); process.exit(2); }
  const migFiles = new Set(mig.images.map(i => (i.localFilename || '').trim()).filter(Boolean));
  const missing = src.images.filter(s => {
    const file = (s.localFilename || path.basename((s.sourceUrl || '').replace(/\?.*$/, ''))).trim();
    return !migFiles.has(file);
  });
  const passed = mig.images.length >= src.images.length && missing.length === 0;
  const reportDir = validationDir ? path.resolve(validationDir) : path.dirname(path.resolve(againstPath));
  const report = { sourceTotal: src.images.length, migratedTotal: mig.images.length, missingCount: missing.length, missing, passed };
  try { fs.writeFileSync(path.join(reportDir, 'image-manifest-compare-report.json'), JSON.stringify(report, null, 2)); } catch (_) {}
  if (passed) {
    try { fs.writeFileSync(path.join(reportDir, '.image-manifest-compare-passed'), JSON.stringify({ timestamp: new Date().toISOString() })); } catch (_) {}
    console.log(`Compare passed: migrated ${mig.images.length} >= source ${src.images.length}`);
    process.exit(0);
  }
  console.error(`Compare FAILED: migrated ${mig.images.length} vs source ${src.images.length}, ${missing.length} missing`);
  process.exit(1);
}

function runFooterMode(footerFile, validationDir) {
  const footerPath = path.isAbsolute(footerFile) ? footerFile : path.join(process.cwd(), footerFile);
  const valDir = path.isAbsolute(validationDir) ? validationDir : path.join(process.cwd(), validationDir);
  debugLog(valDir, 'START', `audit-footer-images.js — footerFile=${footerPath}`);
  if (!fs.existsSync(footerPath)) { console.error(`FAIL: Footer file not found: ${footerPath}`); process.exit(2); }
  const { expectedSlots, expectedCount } = buildExpectedSlots(valDir);
  const content = fs.readFileSync(footerPath, 'utf-8');
  const imgPaths = [...new Set(extractImagePaths(content))];
  let validatedOnDisk = 0;
  const missingOrEmpty = [];
  const localPaths = imgPaths.filter(p => !p.startsWith('http') && !p.startsWith('//'));
  for (const ip of localPaths) {
    if (ip.startsWith('/')) { missingOrEmpty.push({ path: ip, reason: 'Absolute path' }); continue; }
    const resolved = path.resolve(path.dirname(footerPath), ip);
    if (!fs.existsSync(resolved)) { missingOrEmpty.push({ path: ip, reason: 'Not found' }); continue; }
    if (fs.statSync(resolved).size === 0) { missingOrEmpty.push({ path: ip, reason: '0 bytes' }); continue; }
    validatedOnDisk++;
  }
  const passed = missingOrEmpty.length === 0 && validatedOnDisk >= expectedCount;
  const report = { expectedCount, actualCount: validatedOnDisk, uniqueRefsInFooter: imgPaths.length, passed, expectedSlots, missingOrEmpty };
  try { fs.writeFileSync(path.join(valDir, 'image-audit-report.json'), JSON.stringify(report, null, 2)); } catch {}
  console.log(`=== Footer Image Audit ===\nExpected: ${expectedCount}, On disk: ${validatedOnDisk}`);
  if (!passed) {
    console.log('=== AUDIT FAILED ===');
    debugLog(valDir, 'BLOCK', `FAILED — expected ${expectedCount}, actual ${validatedOnDisk}`);
    try { const m = path.join(valDir, '.image-audit-passed'); if (fs.existsSync(m)) fs.unlinkSync(m); } catch {}
    process.exit(1);
  }
  console.log('=== AUDIT PASSED ===');
  debugLog(valDir, 'PASS', `PASSED — expected ${expectedCount}, actual ${validatedOnDisk}`);
  try { fs.writeFileSync(path.join(valDir, '.image-audit-passed'), JSON.stringify({ timestamp: new Date().toISOString() })); } catch {}
  process.exit(0);
}

async function main() {
  const args = process.argv.slice(2);
  let footerFile = null, validationDir = null, url = null, output = null, compare = null, against = null;
  for (const a of args) {
    if (a.startsWith('--url=')) url = a.slice(6);
    else if (a.startsWith('--output=')) output = a.slice(9);
    else if (a.startsWith('--compare=')) compare = a.slice(10);
    else if (a.startsWith('--against=')) against = a.slice(10);
    else if (a.startsWith('--validation-dir=')) validationDir = a.slice(17);
    else if (!footerFile) footerFile = a;
    else if (!validationDir) validationDir = a;
  }
  if (url && output) return runUrlMode(url, output, validationDir);
  if (compare && against) return runCompareMode(compare, against, validationDir);
  if (!footerFile || !validationDir) {
    console.error('Usage:\n  Footer: node audit-footer-images.js <footer-file> <validation-dir>\n  URL:    --url=<url> --output=<path>\n  Compare: --compare=<src> --against=<mig>');
    process.exit(2);
  }
  runFooterMode(footerFile, validationDir);
}

main();
