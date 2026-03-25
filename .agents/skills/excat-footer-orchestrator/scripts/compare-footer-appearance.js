#!/usr/bin/env node

/*
 * compare-footer-appearance.js
 *
 * Compares source footer-appearance-mapping.json vs migrated-footer-appearance-mapping.json.
 * layoutSpacing (required in schema): strict string match per key (except notes) on source vs migrated.
 * Optional blocks (leadCaptureBand, noticeStrip, promoMediaBand, primaryLinkBand): omitted on both = skip;
 * otherwise both must define and match (except notes).
 * Produces footer-appearance-register.json.
 *
 * Usage:
 *   node .../compare-footer-appearance.js <source-mapping> <migrated-mapping> [--output=<register-path>]
 *
 * Exit codes: 0 = match, 1 = mismatch, 2 = usage error
 */

import fs from 'fs';
import path from 'path';
import { VALIDATION_DIR } from './validation-paths.js';

function debugLog(level, msg) {
  const ts = new Date().toISOString();
  const prefix = { ERROR: '❌', PASS: '✅', BLOCK: '🚫', START: '🔵' }[level] || 'ℹ️';
  const entry = `[${ts}] ${prefix} [SCRIPT:compare-footer-appearance] [${level}] ${msg}\n`;
  try {
    const logDir = path.resolve(VALIDATION_DIR);
    if (fs.existsSync(logDir)) fs.appendFileSync(path.join(logDir, 'debug.log'), entry);
  } catch (_) { /* ignore */ }
}

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); }
  catch (e) { console.error(`Failed to load ${p}: ${e.message}`); return null; }
}

const LAYOUT_SPACING_KEYS = [
  'footerPaddingTop',
  'footerPaddingBottom',
  'contentInsetInline',
  'columnGapApprox',
  'majorBandGapApprox',
];

/**
 * Compare layoutSpacing: every required key from source except `notes` must match migrated (trimmed string ===).
 */
function compareLayoutSpacing(source, migrated) {
  const issues = [];
  const s = source.layoutSpacing;
  const m = migrated.layoutSpacing;
  if (!s || typeof s !== 'object') {
    issues.push('layoutSpacing: missing or invalid on source mapping');
    return { issues, layoutSpacingMatch: false };
  }
  if (!m || typeof m !== 'object') {
    issues.push('layoutSpacing: missing or invalid on migrated mapping');
    return { issues, layoutSpacingMatch: false };
  }
  let ok = true;
  for (const k of LAYOUT_SPACING_KEYS) {
    const sv = String(s[k] ?? '').trim();
    const mv = String(m[k] ?? '').trim();
    if (!sv) {
      issues.push(`layoutSpacing.${k}: empty in source`);
      ok = false;
      continue;
    }
    if (!mv) {
      issues.push(`layoutSpacing.${k}: missing or empty in migrated`);
      ok = false;
      continue;
    }
    if (sv !== mv) {
      issues.push(`layoutSpacing.${k}: source=${JSON.stringify(sv)} migrated=${JSON.stringify(mv)}`);
      ok = false;
    }
  }
  return { issues, layoutSpacingMatch: ok };
}

/** Optional top-level blocks in footer-appearance-mapping — omitted on both = skip; if either side defines a block, both must define it and agree on keys (except `notes`). */
const OPTIONAL_APPEARANCE_BLOCKS = [
  'leadCaptureBand',
  'noticeStrip',
  'promoMediaBand',
  'primaryLinkBand',
];

/**
 * If neither mapping has the block, skip. If exactly one has it, mismatch.
 * If both have it, every key from source except `notes` must exist on migrated and match (===).
 */
function compareOptionalAppearanceBlocks(source, migrated) {
  const issues = [];
  const flags = {};
  for (const block of OPTIONAL_APPEARANCE_BLOCKS) {
    const s = source[block];
    const m = migrated[block];
    const sObj = s && typeof s === 'object';
    const mObj = m && typeof m === 'object';
    if (!sObj && !mObj) {
      flags[`${block}Skipped`] = true;
      flags[`${block}Match`] = true;
      continue;
    }
    if (!sObj || !mObj) {
      issues.push(`${block}: must appear in both source and migrated mappings, or be omitted from both`);
      flags[`${block}Match`] = false;
      continue;
    }
    let blockOk = true;
    for (const k of Object.keys(s)) {
      if (k === 'notes') continue;
      if (m[k] === undefined) {
        issues.push(`${block}.${k}: missing in migrated`);
        blockOk = false;
      } else if (s[k] !== m[k]) {
        issues.push(`${block}.${k}: source=${JSON.stringify(s[k])} migrated=${JSON.stringify(m[k])}`);
        blockOk = false;
      }
    }
    flags[`${block}Match`] = blockOk;
  }
  return { issues, flags };
}

function main() {
  const args = process.argv.slice(2);
  let outputPath = null;
  const positional = [];
  for (const a of args) {
    if (a.startsWith('--output=')) outputPath = a.split('=')[1];
    else positional.push(a);
  }

  if (positional.length < 2) {
    console.error('Usage: node compare-footer-appearance.js <source-mapping> <migrated-mapping> [--output=<path>]');
    process.exit(2);
  }

  const source = loadJson(positional[0]);
  const migrated = loadJson(positional[1]);
  if (!source || !migrated) process.exit(2);

  debugLog('START', `compare-footer-appearance.js — source=${positional[0]}, migrated=${positional[1]}`);

  const bgTypeMatch = (source.background?.type || '') === (migrated.background?.type || '');
  const bgDarkMatch = source.background?.isDark === migrated.background?.isDark;
  const borderMatch = source.borderTop?.hasBorder === migrated.borderTop?.hasBorder;
  const shadowMatch = source.shadow?.hasShadow === migrated.shadow?.hasShadow;
  const stickyMatch = source.stickyBehavior?.isSticky === migrated.stickyBehavior?.isSticky;
  const layoutMatch = source.layout?.isFullWidth === migrated.layout?.isFullWidth;
  const dividerMatch = source.layout?.hasSectionDividers === migrated.layout?.hasSectionDividers;

  const issues = [];
  if (!bgTypeMatch) issues.push(`background.type: source=${source.background?.type} migrated=${migrated.background?.type}`);
  if (!bgDarkMatch) issues.push(`background.isDark: source=${source.background?.isDark} migrated=${migrated.background?.isDark}`);
  if (!borderMatch) issues.push(`borderTop: source=${source.borderTop?.hasBorder} migrated=${migrated.borderTop?.hasBorder}`);
  if (!shadowMatch) issues.push(`shadow: source=${source.shadow?.hasShadow} migrated=${migrated.shadow?.hasShadow}`);
  if (!stickyMatch) issues.push(`stickyBehavior: source=${source.stickyBehavior?.isSticky} migrated=${migrated.stickyBehavior?.isSticky}`);
  if (!layoutMatch) issues.push(`layout.isFullWidth: source=${source.layout?.isFullWidth} migrated=${migrated.layout?.isFullWidth}`);
  if (!dividerMatch) issues.push(`layout.hasSectionDividers: source=${source.layout?.hasSectionDividers} migrated=${migrated.layout?.hasSectionDividers}`);

  const spacing = compareLayoutSpacing(source, migrated);
  issues.push(...spacing.issues);

  const optional = compareOptionalAppearanceBlocks(source, migrated);
  issues.push(...optional.issues);

  const allMatch = issues.length === 0;
  const register = {
    backgroundTypeMatch: bgTypeMatch,
    backgroundDarkMatch: bgDarkMatch,
    borderTopMatch: borderMatch,
    shadowMatch,
    stickyMatch,
    layoutMatch,
    dividerMatch,
    layoutSpacingMatch: spacing.layoutSpacingMatch,
    ...optional.flags,
    allValidated: allMatch,
    issues,
  };

  console.log('=== Footer Appearance Comparison ===');
  console.log(`background.type: ${bgTypeMatch ? '✓' : '✗'}`);
  console.log(`background.isDark: ${bgDarkMatch ? '✓' : '✗'}`);
  console.log(`borderTop: ${borderMatch ? '✓' : '✗'}`);
  console.log(`shadow: ${shadowMatch ? '✓' : '✗'}`);
  console.log(`stickyBehavior: ${stickyMatch ? '✓' : '✗'}`);
  console.log(`layout: ${layoutMatch ? '✓' : '✗'}`);
  console.log(`layoutSpacing (padding/margins): ${spacing.layoutSpacingMatch ? '✓' : '✗'}`);
  const allOptionalSkipped = OPTIONAL_APPEARANCE_BLOCKS.every(
    (b) => optional.flags[`${b}Skipped`],
  );
  if (allOptionalSkipped) {
    console.log(
      `optional appearance blocks (${OPTIONAL_APPEARANCE_BLOCKS.join(', ')}): skipped — not in either mapping`,
    );
  } else {
    for (const block of OPTIONAL_APPEARANCE_BLOCKS) {
      if (optional.flags[`${block}Match`] === false) console.log(`${block}: ✗`);
      else if (!optional.flags[`${block}Skipped`]) console.log(`${block}: ✓`);
    }
  }
  console.log(`\n=== ${allMatch ? 'VALIDATED' : 'VALIDATION FAILED'} ===`);

  if (issues.length > 0) {
    console.log('\nIssues:');
    issues.forEach(i => console.log(`  - ${i}`));
  }

  if (outputPath) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(register, null, 2));
    console.log(`\nRegister written to: ${outputPath}`);
  }

  debugLog(allMatch ? 'PASS' : 'BLOCK', allMatch ? 'Footer appearance validated' : `FAILED — ${issues.join('; ')}`);
  process.exit(allMatch ? 0 : 1);
}

main();
