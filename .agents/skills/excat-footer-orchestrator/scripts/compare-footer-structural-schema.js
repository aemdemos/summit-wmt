#!/usr/bin/env node

/*
 * compare-footer-structural-schema.js
 *
 * Compare source footer structure (from phase-1, phase-2) to migrated footer
 * structural summary. Exit 0 only if similarity >= threshold (default 100) AND
 * per-section strict match (schema-register allValidated), same as hooks.
 *
 * Usage:
 *   node .../compare-footer-structural-schema.js <phase-1.json> <phase-2.json> <migrated-structural-summary.json>
 *   [--threshold=100] [--output-register=schema-register.json]
 *
 * Exit codes: 0 = pass, 1 = fail
 */

import fs from 'fs';
import path from 'path';
import { VALIDATION_DIR } from './validation-paths.js';

function debugLog(level, msg) {
  const ts = new Date().toISOString();
  const prefix = { ERROR: '❌', PASS: '✅', BLOCK: '🚫', START: '🔵' }[level] || 'ℹ️';
  const entry = `[${ts}] ${prefix} [SCRIPT:compare-footer-structural-schema] [${level}] ${msg}\n`;
  try {
    const logDir = path.resolve(VALIDATION_DIR);
    if (fs.existsSync(logDir)) fs.appendFileSync(path.join(logDir, 'debug.log'), entry);
  } catch (_) { /* ignore */ }
}

function loadJson(p) { return JSON.parse(fs.readFileSync(path.resolve(p), 'utf8')); }

const MAJOR_PENALTY = 25;
const MINOR_PENALTY = 5;

function normType(t) {
  return String(t || 'unknown').toLowerCase().trim();
}

function buildSourceSummary(p1, p2) {
  return {
    sectionCount: p1.sectionCount ?? 0,
    sections: (p2.sections || []).map((s, i) => ({
      index: s.index ?? i,
      type: normType(s.type),
      hasImages: Boolean(s.hasImages),
      imageCount: s.imageCount ?? (s.hasImages ? 1 : 0),
      linkCount: s.linkCount ?? 0,
      hasSocialIcons: Boolean(s.hasSocialIcons),
      socialIconCount: s.socialIconCount ?? 0,
      hasForm: Boolean(s.hasForm),
      hasLocaleSelector: Boolean(s.hasLocaleSelector),
      hasVideo: Boolean(s.hasVideo),
      hasBrandLogos: Boolean(s.hasBrandLogos),
      brandLogoCount: s.brandLogoCount ?? 0,
    })),
  };
}

function normalizeMigratedSection(m, i) {
  return {
    index: m.index ?? i,
    type: normType(m.type),
    linkCount: m.linkCount ?? 0,
    imageCount: m.imageCount ?? (m.hasImages ? 1 : 0),
    hasSocialIcons: Boolean(m.hasSocialIcons),
    hasForm: Boolean(m.hasForm),
    hasLocaleSelector: Boolean(m.hasLocaleSelector),
    hasVideo: Boolean(m.hasVideo),
    hasBrandLogos: Boolean(m.hasBrandLogos),
    brandLogoCount: m.brandLogoCount ?? 0,
  };
}

function compare(source, migrated) {
  const mismatches = [];
  let similarity = 100;

  if (source.sectionCount !== migrated.sectionCount) {
    mismatches.push(`sectionCount: source=${source.sectionCount} migrated=${migrated.sectionCount}`);
    similarity -= MAJOR_PENALTY;
  }

  const srcSections = source.sections || [];
  const migSections = migrated.sections || [];
  const max = Math.max(srcSections.length, migSections.length);
  for (let i = 0; i < max; i++) {
    const s = srcSections[i];
    const m = migSections[i];
    if (!s || !m) {
      mismatches.push(`sections[${i}]: missing in ${s ? 'migrated' : 'source'}`);
      similarity -= MAJOR_PENALTY;
      continue;
    }
    if (s.type !== m.type) {
      mismatches.push(`sections[${i}].type: source=${s.type} migrated=${m.type}`);
      similarity -= MAJOR_PENALTY;
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
    if (s.hasVideo !== m.hasVideo) {
      mismatches.push(`sections[${i}].hasVideo: source=${s.hasVideo} migrated=${m.hasVideo}`);
      similarity -= MAJOR_PENALTY;
    }
    if (s.hasBrandLogos !== m.hasBrandLogos) {
      mismatches.push(`sections[${i}].hasBrandLogos: source=${s.hasBrandLogos} migrated=${m.hasBrandLogos}`);
      similarity -= MINOR_PENALTY;
    }
    const srcBrand = s.brandLogoCount ?? 0;
    const migBrand = m.brandLogoCount ?? 0;
    if (srcBrand !== migBrand) {
      similarity -= Math.min(MINOR_PENALTY * Math.abs(srcBrand - migBrand), 20);
      mismatches.push(`sections[${i}].brandLogoCount: source=${srcBrand} migrated=${migBrand}`);
    }
  }

  similarity = Math.max(0, similarity);
  return { similarity, mismatches };
}

function sectionStructuralMatch(s, m) {
  if (!s || !m) return false;
  const srcImg = s.imageCount ?? 0;
  const migImg = m.imageCount ?? 0;
  const srcBrand = s.brandLogoCount ?? 0;
  const migBrand = m.brandLogoCount ?? 0;
  return (
    s.type === m.type
    && s.linkCount === m.linkCount
    && srcImg === migImg
    && s.hasSocialIcons === m.hasSocialIcons
    && s.hasForm === m.hasForm
    && s.hasLocaleSelector === m.hasLocaleSelector
    && s.hasVideo === m.hasVideo
    && s.hasBrandLogos === m.hasBrandLogos
    && srcBrand === migBrand
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
      id: `section-${i}`,
      label: `Section ${i} (${s?.type || m?.type || 'unknown'})`,
      status: validated ? 'validated' : 'pending',
      sourceMatch: validated,
    });
  }
  const allSectionsMatch = items.length === 0 || items.every((it) => it.status === 'validated');
  return { items, allValidated: countOk && allSectionsMatch };
}

function main() {
  const raw = process.argv.slice(2);
  const args = raw.filter(a => !a.startsWith('--threshold') && !a.startsWith('--output-register'));
  const thresholdArg = raw.find(a => a.startsWith('--threshold'));
  const registerArg = raw.find(a => a.startsWith('--output-register'));
  const threshold = thresholdArg ? parseInt(thresholdArg.split('=')[1], 10) : 100;
  const outputRegisterPath = registerArg ? registerArg.split('=')[1] : null;

  if (args.length < 3) {
    console.error('Usage: node compare-footer-structural-schema.js <phase-1.json> <phase-2.json> <migrated-structural-summary.json> [--threshold=100] [--output-register=<path>]');
    process.exit(1);
  }

  const [p1Path, p2Path, migPath] = args;
  for (const p of [p1Path, p2Path, migPath]) {
    if (!fs.existsSync(path.resolve(p))) { console.error('File not found:', p); process.exit(1); }
  }

  const p1 = loadJson(p1Path);
  const p2 = loadJson(p2Path);
  const migrated = loadJson(migPath);
  debugLog('START', `compare-footer-structural-schema.js — threshold=${threshold}`);

  const source = buildSourceSummary(p1, p2);
  const migratedNorm = {
    sectionCount: migrated.sectionCount ?? (migrated.sections || []).length,
    sections: (migrated.sections || []).map((sec, i) => normalizeMigratedSection(sec, i)),
  };
  const { similarity, mismatches } = compare(source, migratedNorm);

  const register = buildRegisterItems(source, migratedNorm);
  const similarityOk = similarity >= threshold;
  const strictOk = register.allValidated;
  const pass = similarityOk && strictOk;

  if (outputRegisterPath) {
    const out = { ...register, similarity, threshold, mismatches, similarityOk, strictOk };
    try { fs.writeFileSync(path.resolve(outputRegisterPath), JSON.stringify(out, null, 2)); } catch {}
  }

  console.log(`Structural similarity: ${similarity}% (threshold ${threshold}%)`);
  console.log(`Per-section strict match (schema-register allValidated): ${strictOk ? 'yes' : 'no'}`);
  if (mismatches.length > 0) {
    console.error('Mismatches:');
    mismatches.forEach(m => console.error('  ', m));
  }

  if (pass) {
    debugLog('PASS', `PASSED — similarity=${similarity}%, allValidated=true`);
    process.exit(0);
  }
  const reason = !strictOk
    ? 'per-section strict mismatch (see schema-register items)'
    : `similarity ${similarity}% < ${threshold}%`;
  debugLog('BLOCK', `FAILED — ${reason}; mismatches: ${mismatches.join('; ')}`);
  process.exit(1);
}

main();
