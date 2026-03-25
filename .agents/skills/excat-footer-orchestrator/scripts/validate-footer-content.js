#!/usr/bin/env node

/*
 * validate-footer-content.js
 *
 * Deterministic validation of footer.plain.html against phase-2 requirements.
 * MANDATORY — the orchestrator MUST run it after writing footer content
 * and MUST NOT proceed if it exits non-zero.
 *
 * Usage:
 *   node .../validate-footer-content.js <footer-file> <validation-dir> [--source-manifest=<path>]
 *
 * Exit codes:
 *   0 = all checks passed
 *   1 = validation failures
 *   2 = usage error
 */

import fs from 'fs';
import path from 'path';

function debugLog(validationDir, level, msg) {
  const ts = new Date().toISOString();
  const prefix = { ERROR: '❌', PASS: '✅', BLOCK: '🚫', START: '🔵', END: '🏁' }[level] || 'ℹ️';
  const entry = `[${ts}] ${prefix} [SCRIPT:validate-footer-content] [${level}] ${msg}\n`;
  try {
    if (fs.existsSync(validationDir)) fs.appendFileSync(path.join(validationDir, 'debug.log'), entry);
  } catch (_) { /* ignore */ }
}

const IMAGE_PATTERN = /!\[.*?\]\(.*?\)/g;
const IMG_TAG_PATTERN = /<img\s[^>]*src=["']([^"']+)["']/gi;
const MEDIA_REF_PATTERN = /media_[a-f0-9]+/gi;

function loadJson(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); } catch { return null; }
}

function countImageReferences(content) {
  const mdImages = (content.match(IMAGE_PATTERN) || []).length;
  const htmlImages = (content.match(IMG_TAG_PATTERN) || []).length;
  const mediaRefs = (content.match(MEDIA_REF_PATTERN) || []).length;
  return { mdImages, htmlImages, mediaRefs, total: mdImages + htmlImages + mediaRefs };
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

function countTopLevelDivs(html) {
  const noComments = html.replace(/<!--[\s\S]*?-->/g, '');
  const tokens = [];
  const divOpen = /<div[\s>]/gi;
  const divClose = /<\/div\s*>/gi;
  let m;
  while ((m = divOpen.exec(noComments)) !== null) tokens.push({ pos: m.index, open: true });
  while ((m = divClose.exec(noComments)) !== null) tokens.push({ pos: m.index, open: false });
  tokens.sort((a, b) => a.pos - b.pos);
  let depth = 0;
  let count = 0;
  for (const t of tokens) {
    if (t.open) { if (depth === 0) count++; depth++; } else depth--;
  }
  return count;
}

function main() {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--source-manifest='));
  const sourceManifestArg = process.argv.slice(2).find(a => a.startsWith('--source-manifest='));
  const sourceManifestPath = sourceManifestArg ? sourceManifestArg.slice('--source-manifest='.length).trim() : null;

  if (args.length < 2) {
    console.error('Usage: node validate-footer-content.js <footer-file> <validation-dir> [--source-manifest=<path>]');
    process.exit(2);
  }

  const footerFile = args[0];
  const validationDir = args[1];

  debugLog(validationDir, 'START', `validate-footer-content.js invoked — footerFile=${footerFile}, validationDir=${validationDir}`);

  if (!fs.existsSync(footerFile)) {
    console.error(`FAIL: footer file not found: ${footerFile}`);
    process.exit(1);
  }

  const basename = path.basename(footerFile);
  if (basename !== 'footer.plain.html') {
    console.error(`FAIL: ${basename} is not supported. Use content/footer.plain.html.`);
    process.exit(1);
  }

  const parentDir = path.basename(path.dirname(path.resolve(footerFile)));
  if (parentDir !== 'content') {
    console.error(`FAIL: footer file is in "${parentDir}/" — must be in "content/"`);
    process.exit(1);
  }

  const p2Path = path.join(validationDir, 'phase-2-section-mapping.json');
  if (!fs.existsSync(p2Path)) {
    console.error(`FAIL: phase-2-section-mapping.json not found at ${p2Path}`);
    process.exit(2);
  }

  const p2 = loadJson(p2Path);
  const failures = [];

  const imageRequirements = [];
  if (p2?.sections) {
    for (const section of p2.sections) {
      if (section.hasImages) {
        imageRequirements.push({
          source: 'phase-2',
          element: `Section ${section.index ?? '?'}`,
          description: `Images in section ${section.index} (${section.type || 'unknown'})`,
        });
      }
    }
  }

  let localeFlagCountRequired = 0;
  const localeFlagRequirements = [];
  if (p2?.sections) {
    for (const section of p2.sections) {
      if (section.hasLocaleSelector && section.localeSelectorDetails?.hasFlags) {
        const n = section.localeSelectorDetails.flagCount ?? section.localeSelectorDetails.entryCount ?? 1;
        localeFlagCountRequired = Math.max(localeFlagCountRequired, n);
        localeFlagRequirements.push({ source: 'phase-2', element: `Section ${section.index} locale selector`, required: n });
      }
    }
  }

  const footerContent = fs.readFileSync(footerFile, 'utf-8');
  const imgCounts = countImageReferences(footerContent);
  const imgPaths = extractImagePaths(footerContent);

  console.log('=== Footer Content Validation ===');
  console.log(`File: ${footerFile}`);
  console.log(`Content length: ${footerContent.length} chars, ${footerContent.split('\n').length} lines`);
  console.log(`Image requirements: ${imageRequirements.length} element(s) with hasImages=true`);
  console.log(`Image references found: ${imgCounts.total} (md: ${imgCounts.mdImages}, html: ${imgCounts.htmlImages}, media: ${imgCounts.mediaRefs})`);

  const MIN_TOP_LEVEL_SECTIONS = 1;
  const topLevelDivCount = countTopLevelDivs(footerContent);
  if (topLevelDivCount < MIN_TOP_LEVEL_SECTIONS) {
    failures.push(`CRITICAL: footer.plain.html has ${topLevelDivCount} top-level div(s). Must have at least ${MIN_TOP_LEVEL_SECTIONS}.`);
  }
  console.log(`Top-level section divs: ${topLevelDivCount}`);

  if (imageRequirements.length > 0 && imgPaths.length === 0) {
    failures.push(
      `CRITICAL: ${imageRequirements.length} element(s) require images but footer file has ZERO image references.\n` +
      '  Download every image (social icons, brand logos, flags) to content/images/.\n' +
      '  Reference each in footer.plain.html. footer.js must READ from the DOM — never hardcode.'
    );
  }

  // Flag/locale images
  if (localeFlagCountRequired > 0) {
    const flagPaths = imgPaths.filter(p => /flag|country|locale|lang/i.test(p));
    if (flagPaths.length === 0) {
      failures.push(
        'CRITICAL: Locale selector has flags but footer file has NO flag/country image references.\n' +
        '  Country names and flag images MUST live in footer.plain.html. footer.js reads from DOM only.'
      );
    } else if (flagPaths.length < localeFlagCountRequired) {
      failures.push(`Locale selector requires ${localeFlagCountRequired} flag entries but found only ${flagPaths.length}.`);
    }
  }

  // Image file existence + size > 0
  let validatedOnDisk = 0;
  const localPaths = imgPaths.filter(p => !p.startsWith('http://') && !p.startsWith('https://') && !p.startsWith('//'));
  for (const imgPath of localPaths) {
    if (imgPath.startsWith('/')) {
      failures.push(`Image path uses absolute path: ${imgPath} — use relative path like images/filename.ext`);
      continue;
    }
    const resolved = path.resolve(path.dirname(footerFile), imgPath);
    let filePath = null;
    if (fs.existsSync(resolved)) filePath = resolved;
    else if (fs.existsSync(path.resolve(imgPath))) filePath = path.resolve(imgPath);
    if (!filePath) { failures.push(`Image file not found on disk: ${imgPath}`); continue; }
    const stat = fs.statSync(filePath);
    if (stat.size === 0) { failures.push(`Image file is EMPTY (0 bytes): ${imgPath}`); continue; }
    validatedOnDisk++;
  }

  // Source manifest parity
  if (sourceManifestPath && fs.existsSync(sourceManifestPath)) {
    let manifest;
    try { manifest = JSON.parse(fs.readFileSync(sourceManifestPath, 'utf-8')); } catch { failures.push(`--source-manifest not valid JSON`); }
    if (manifest?.images) {
      const footerImages = imgPaths.map(p => ({ src: p, filename: path.basename(p.replace(/\?.*$/, '')) }));
      const missing = manifest.images.filter(srcImg => {
        const wantFile = srcImg.localFilename || path.basename((srcImg.sourceUrl || '').replace(/\?.*$/, ''));
        return !footerImages.some(fi => fi.filename === wantFile || fi.src.endsWith(wantFile));
      });
      if (missing.length > 0) {
        failures.push(`${missing.length} source image(s) from manifest not referenced in footer.plain.html.`);
      }
    }
  }

  if (failures.length > 0) {
    console.log('\n=== VALIDATION FAILED ===');
    failures.forEach(f => console.error(`\nFAIL: ${f}`));
    console.log(`\n${failures.length} failure(s). Fix ALL before proceeding.`);
    debugLog(validationDir, 'BLOCK', `FAILED — ${failures.length} failure(s)`);
    process.exit(1);
  }

  console.log('\n=== VALIDATION PASSED ===');
  console.log(`All ${imageRequirements.length} image requirement(s) satisfied. ${validatedOnDisk} image(s) on disk.`);
  debugLog(validationDir, 'PASS', `PASSED — ${imageRequirements.length} req(s), ${validatedOnDisk} on disk`);
  try {
    fs.writeFileSync(path.join(validationDir, '.footer-content-validated'), JSON.stringify({
      timestamp: new Date().toISOString(), imageCount: imgCounts.total, validatedOnDisk,
    }));
  } catch (_) { /* ignore */ }
  process.exit(0);
}

main();
