#!/usr/bin/env node

/*
 * compare-footer-mobile-behavior.js
 *
 * Compares phase-4-mobile.json (source mobile analysis) to
 * mobile/migrated-mobile-behavior-mapping.json (observed on migrated site at 375×812).
 * Writes mobile/mobile-behavior-register.json.
 *
 * Usage:
 *   node .../compare-footer-mobile-behavior.js <phase-4-mobile.json> <migrated-mobile-behavior-mapping.json> [--output=<mobile/mobile-behavior-register.json>]
 */

import fs from 'fs';
import path from 'path';
import { VALIDATION_DIR } from './validation-paths.js';

function debugLog(level, msg) {
  const ts = new Date().toISOString();
  const prefix = { ERROR: '❌', PASS: '✅', BLOCK: '🚫', START: '🔵' }[level] || 'ℹ️';
  const entry = `[${ts}] ${prefix} [SCRIPT:compare-footer-mobile-behavior] [${level}] ${msg}\n`;
  try {
    const logDir = path.resolve(VALIDATION_DIR);
    if (fs.existsSync(logDir)) fs.appendFileSync(path.join(logDir, 'debug.log'), entry);
  } catch { /* ignore */ }
}

function loadJson(p) {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(p), 'utf8'));
  } catch (e) {
    console.error('Failed to load JSON:', p, e.message);
    return null;
  }
}

function normStr(v) {
  return String(v ?? '').toLowerCase().trim();
}

function strLooseMatch(a, b) {
  const x = normStr(a);
  const y = normStr(b);
  if (x === y) return true;
  if (!x && !y) return true;
  if (x.length > 2 && y.length > 2 && (x.includes(y) || y.includes(x))) return true;
  return false;
}

function fromPhase4(p4) {
  return {
    hasAccordionSections: Boolean(p4.hasAccordionSections),
    accordionExpandMode: normStr(p4.accordionDetails?.expandMode || 'none'),
    formLayoutChange: p4.formLayoutChange,
    hasLocaleSelector: Boolean(p4.hasLocaleSelector),
    localeSelectorMobileBehavior: p4.localeSelectorMobileBehavior,
    hasSocialIcons: Boolean(p4.hasSocialIcons),
    socialIconsLayoutChange: p4.socialIconsLayoutChange,
    hasVideo: Boolean(p4.hasVideo),
    videoMobileBehavior: p4.videoMobileBehavior,
    stackingOrderLength: (p4.stackingOrder || []).length,
  };
}

function fromMigrated(m) {
  return {
    hasAccordionSections: Boolean(m.hasAccordionSections),
    accordionExpandMode: normStr(m.accordionExpandMode || m.accordionDetails?.expandMode || 'none'),
    formLayoutChange: m.formLayoutChange,
    hasLocaleSelector: Boolean(m.hasLocaleSelector),
    localeSelectorMobileBehavior: m.localeSelectorMobileBehavior,
    hasSocialIcons: Boolean(m.hasSocialIcons),
    socialIconsLayoutChange: m.socialIconsLayoutChange,
    hasVideo: Boolean(m.hasVideo),
    videoMobileBehavior: m.videoMobileBehavior,
    stackingOrderLength: m.stackingOrderLength ?? (m.stackingOrder || []).length,
  };
}

function main() {
  const args = process.argv.slice(2);
  let outputPath = null;
  const positional = [];
  for (const a of args) {
    if (a.startsWith('--output=')) outputPath = a.slice(9);
    else positional.push(a);
  }

  if (positional.length < 2) {
    console.error('Usage: node compare-footer-mobile-behavior.js <phase-4-mobile.json> <migrated-mobile-behavior-mapping.json> [--output=<path>]');
    process.exit(2);
  }

  const phase4 = loadJson(positional[0]);
  const migrated = loadJson(positional[1]);
  if (!phase4 || !migrated) process.exit(2);

  debugLog('START', `compare-footer-mobile-behavior.js — phase4=${positional[0]}, migrated=${positional[1]}`);

  const src = fromPhase4(phase4);
  const mig = fromMigrated(migrated);

  const checks = [
    {
      id: 'mobile-accordion',
      label: 'Accordion sections present',
      match: src.hasAccordionSections === mig.hasAccordionSections,
      sourceValue: String(src.hasAccordionSections),
      migratedValue: String(mig.hasAccordionSections),
    },
    {
      id: 'mobile-accordion-mode',
      label: 'Accordion expand mode',
      match: src.accordionExpandMode === mig.accordionExpandMode,
      sourceValue: src.accordionExpandMode,
      migratedValue: mig.accordionExpandMode,
    },
    {
      id: 'mobile-form-layout',
      label: 'Form layout change',
      match: strLooseMatch(src.formLayoutChange, mig.formLayoutChange),
      sourceValue: String(src.formLayoutChange ?? ''),
      migratedValue: String(mig.formLayoutChange ?? ''),
    },
    {
      id: 'mobile-locale',
      label: 'Locale selector present',
      match: src.hasLocaleSelector === mig.hasLocaleSelector,
      sourceValue: String(src.hasLocaleSelector),
      migratedValue: String(mig.hasLocaleSelector),
    },
    {
      id: 'mobile-locale-behavior',
      label: 'Locale mobile behavior',
      match: strLooseMatch(src.localeSelectorMobileBehavior, mig.localeSelectorMobileBehavior),
      sourceValue: String(src.localeSelectorMobileBehavior ?? ''),
      migratedValue: String(mig.localeSelectorMobileBehavior ?? ''),
    },
    {
      id: 'mobile-social',
      label: 'Social icons present',
      match: src.hasSocialIcons === mig.hasSocialIcons,
      sourceValue: String(src.hasSocialIcons),
      migratedValue: String(mig.hasSocialIcons),
    },
    {
      id: 'mobile-social-layout',
      label: 'Social icons layout change',
      match: strLooseMatch(src.socialIconsLayoutChange, mig.socialIconsLayoutChange),
      sourceValue: String(src.socialIconsLayoutChange ?? ''),
      migratedValue: String(mig.socialIconsLayoutChange ?? ''),
    },
    {
      id: 'mobile-video',
      label: 'Video present',
      match: src.hasVideo === mig.hasVideo,
      sourceValue: String(src.hasVideo),
      migratedValue: String(mig.hasVideo),
    },
    {
      id: 'mobile-video-behavior',
      label: 'Video mobile behavior',
      match: strLooseMatch(src.videoMobileBehavior, mig.videoMobileBehavior),
      sourceValue: String(src.videoMobileBehavior ?? ''),
      migratedValue: String(mig.videoMobileBehavior ?? ''),
    },
    {
      id: 'mobile-stacking-length',
      label: 'Stacking order length',
      match: src.stackingOrderLength === mig.stackingOrderLength,
      sourceValue: String(src.stackingOrderLength),
      migratedValue: String(mig.stackingOrderLength),
    },
  ];

  const items = checks.map((c) => ({
    id: c.id,
    label: c.label,
    status: c.match ? 'validated' : 'failed',
    sourceValue: c.sourceValue,
    migratedValue: c.migratedValue,
    ...(c.match ? {} : { remediation: `Align migrated mobile behavior with phase-4: ${c.label}` }),
  }));

  const failed = items.filter((i) => i.status === 'failed').length;
  const register = {
    items,
    allValidated: failed === 0,
    summary: { totalItems: items.length, failed },
  };

  console.log('=== Footer mobile behavior comparison ===');
  items.forEach((i) => console.log(`  [${i.status === 'validated' ? '✓' : '✗'}] ${i.label}`));

  if (outputPath) {
    const dir = path.dirname(path.resolve(outputPath));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.resolve(outputPath), JSON.stringify(register, null, 2));
    console.log(`\nRegister written: ${outputPath}`);
  }

  debugLog(register.allValidated ? 'PASS' : 'BLOCK', `${items.length - failed}/${items.length} passed`);
  process.exit(register.allValidated ? 0 : 1);
}

main();
