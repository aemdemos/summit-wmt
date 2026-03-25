#!/usr/bin/env node

/*
 * compare-footer-mobile-structural-schema.js
 *
 * Compares SOURCE mobile footer structure (mobile-footer-structure-detection.json
 * from detect-footer-mobile-sections.js) to MIGRATED summary at mobile viewport
 * (mobile/migrated-mobile-structural-summary.json). Same field parity as desktop
 * compare-footer-structural-schema.js (sectionCount, per-section link/image/social/form/locale).
 *
 * Usage:
 *   node .../compare-footer-mobile-structural-schema.js <mobile-footer-structure-detection.json> <migrated-mobile-structural-summary.json> [--threshold=100] [--output-register=mobile/mobile-schema-register.json]
 */

import fs from 'fs';
import path from 'path';
import { VALIDATION_DIR } from './validation-paths.js';

function debugLog(level, msg) {
  const ts = new Date().toISOString();
  const prefix = { ERROR: '❌', PASS: '✅', BLOCK: '🚫', START: '🔵' }[level] || 'ℹ️';
  const entry = `[${ts}] ${prefix} [SCRIPT:compare-footer-mobile-structural-schema] [${level}] ${msg}\n`;
  try {
    const logDir = path.resolve(VALIDATION_DIR);
    if (fs.existsSync(logDir)) fs.appendFileSync(path.join(logDir, 'debug.log'), entry);
  } catch { /* ignore */ }
}

function loadJson(p) {
  return JSON.parse(fs.readFileSync(path.resolve(p), 'utf8'));
}

const MAJOR_PENALTY = 25;
const MINOR_PENALTY = 5;

function normalizeFromDetection(det) {
  const sections = (det.sections || []).map((s, i) => ({
    index: s.index ?? i,
    type: s.tag || 'unknown',
    linkCount: s.linkCount ?? 0,
    imageCount: s.imageCount ?? (s.hasImages ? 1 : 0),
    hasSocialIcons: Boolean(s.hasSocialIcons),
    hasForm: Boolean(s.hasForm),
    hasLocaleSelector: Boolean(s.hasLocaleSelector),
  }));
  return { sectionCount: det.sectionCount ?? sections.length, sections };
}

function normalizeFromMigrated(mig) {
  const sections = (mig.sections || []).map((s, i) => ({
    index: s.index ?? i,
    type: s.type || 'unknown',
    linkCount: s.linkCount ?? 0,
    imageCount: s.imageCount ?? (s.hasImages ? 1 : 0),
    hasSocialIcons: Boolean(s.hasSocialIcons),
    hasForm: Boolean(s.hasForm),
    hasLocaleSelector: Boolean(s.hasLocaleSelector),
  }));
  return { sectionCount: mig.sectionCount ?? sections.length, sections };
}

function compare(source, migrated) {
  const mismatches = [];
  let similarity = 100;

  if (source.sectionCount !== migrated.sectionCount) {
    mismatches.push(`sectionCount: source=${source.sectionCount} migrated=${migrated.sectionCount}`);
    similarity -= MAJOR_PENALTY;
  }

  const srcS = source.sections || [];
  const migS = migrated.sections || [];
  const max = Math.max(srcS.length, migS.length);
  for (let i = 0; i < max; i++) {
    const s = srcS[i];
    const m = migS[i];
    if (!s || !m) {
      mismatches.push(`sections[${i}]: missing in ${s ? 'migrated' : 'source'}`);
      similarity -= MAJOR_PENALTY;
      continue;
    }
    if (s.linkCount !== m.linkCount) {
      const diff = Math.abs(s.linkCount - m.linkCount);
      similarity -= Math.min(MINOR_PENALTY * diff, 20);
      mismatches.push(`sections[${i}].linkCount: source=${s.linkCount} migrated=${m.linkCount}`);
    }
    const srcImg = s.imageCount ?? 0;
    const migImg = m.imageCount ?? 0;
    if (srcImg !== migImg) {
      similarity -= Math.min(MINOR_PENALTY * Math.abs(srcImg - migImg), 20);
      mismatches.push(`sections[${i}].imageCount: source=${srcImg} migrated=${migImg}`);
    }
    if (s.hasSocialIcons !== m.hasSocialIcons) {
      mismatches.push(`sections[${i}].hasSocialIcons: source=${s.hasSocialIcons} migrated=${m.hasSocialIcons}`);
      similarity -= MINOR_PENALTY;
    }
    if (s.hasForm !== m.hasForm) {
      mismatches.push(`sections[${i}].hasForm: source=${s.hasForm} migrated=${m.hasForm}`);
      similarity -= MAJOR_PENALTY;
    }
    if (s.hasLocaleSelector !== m.hasLocaleSelector) {
      mismatches.push(`sections[${i}].hasLocaleSelector: source=${s.hasLocaleSelector} migrated=${m.hasLocaleSelector}`);
      similarity -= MAJOR_PENALTY;
    }
  }

  similarity = Math.max(0, similarity);
  return { similarity, mismatches };
}

function sectionStructuralMatch(s, m) {
  if (!s || !m) return false;
  const srcImg = s.imageCount ?? 0;
  const migImg = m.imageCount ?? 0;
  return (
    s.linkCount === m.linkCount
    && srcImg === migImg
    && s.hasSocialIcons === m.hasSocialIcons
    && s.hasForm === m.hasForm
    && s.hasLocaleSelector === m.hasLocaleSelector
  );
}

function buildRegisterItems(source, migrated) {
  const items = [];
  const srcS = source.sections || [];
  const migS = migrated.sections || [];
  const countOk = source.sectionCount === migrated.sectionCount;
  for (let i = 0; i < Math.max(srcS.length, migS.length); i++) {
    const s = srcS[i];
    const m = migS[i];
    const validated = countOk && sectionStructuralMatch(s, m);
    items.push({
      id: `mobile-section-${i}`,
      label: `Mobile section ${i} (${s?.type || m?.type || 'unknown'})`,
      status: validated ? 'validated' : 'pending',
      sourceMatch: validated,
    });
  }
  const allSectionsMatch = items.length === 0 || items.every((it) => it.status === 'validated');
  return { items, allValidated: countOk && allSectionsMatch };
}

function main() {
  const raw = process.argv.slice(2);
  const args = raw.filter((a) => !a.startsWith('--threshold') && !a.startsWith('--output-register'));
  const thresholdArg = raw.find((a) => a.startsWith('--threshold'));
  const registerArg = raw.find((a) => a.startsWith('--output-register'));
  const threshold = thresholdArg ? parseInt(thresholdArg.split('=')[1], 10) : 100;
  const outputRegisterPath = registerArg ? registerArg.split('=')[1] : null;

  if (args.length < 2) {
    console.error('Usage: node compare-footer-mobile-structural-schema.js <mobile-footer-structure-detection.json> <migrated-mobile-structural-summary.json> [--threshold=100] [--output-register=<path>]');
    process.exit(1);
  }

  const [srcPath, migPath] = args;
  for (const p of [srcPath, migPath]) {
    if (!fs.existsSync(path.resolve(p))) {
      console.error('File not found:', p);
      process.exit(1);
    }
  }

  const rawSrc = loadJson(srcPath);
  const rawMig = loadJson(migPath);
  const source = normalizeFromDetection(rawSrc);
  const migrated = normalizeFromMigrated(rawMig);

  debugLog('START', `compare-footer-mobile-structural-schema.js — threshold=${threshold}`);

  const { similarity, mismatches } = compare(source, migrated);

  const register = buildRegisterItems(source, migrated);
  const similarityOk = similarity >= threshold;
  const strictOk = register.allValidated;
  const pass = similarityOk && strictOk;

  if (outputRegisterPath) {
    const dir = path.dirname(path.resolve(outputRegisterPath));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const out = { ...register, similarity, threshold, mismatches, similarityOk, strictOk };
    try {
      fs.writeFileSync(path.resolve(outputRegisterPath), JSON.stringify(out, null, 2));
    } catch (e) {
      console.error('Error writing register:', e.message);
    }
  }

  console.log(`Mobile structural similarity: ${similarity}% (threshold ${threshold}%)`);
  console.log(`Per-section strict match (mobile-schema-register allValidated): ${strictOk ? 'yes' : 'no'}`);
  if (mismatches.length > 0) {
    console.error('Mismatches:');
    mismatches.forEach((m) => console.error('  ', m));
  }

  if (pass) {
    debugLog('PASS', `PASSED — similarity=${similarity}%, allValidated=true`);
    process.exit(0);
  }
  debugLog('BLOCK', `FAILED — ${!strictOk ? 'per-section strict mismatch' : `similarity ${similarity}% < ${threshold}%`}`);
  process.exit(1);
}

main();
