#!/usr/bin/env node

/*
 * compare-footer-elements-behavior.js
 *
 * Compares source footer-elements-mapping.json vs migrated-footer-elements-mapping.json.
 * Produces footer-elements-behavior-register.json with per-element hover/click match.
 *
 * Usage:
 *   node .../compare-footer-elements-behavior.js <source-mapping> <migrated-mapping> [--output=<register-path>]
 *
 * Exit codes: 0 = all match, 1 = mismatch(es), 2 = usage error
 */

import fs from 'fs';
import path from 'path';
import { VALIDATION_DIR } from './validation-paths.js';

function debugLog(level, msg) {
  const ts = new Date().toISOString();
  const prefix = { ERROR: '❌', PASS: '✅', BLOCK: '🚫', START: '🔵' }[level] || 'ℹ️';
  const entry = `[${ts}] ${prefix} [SCRIPT:compare-footer-elements-behavior] [${level}] ${msg}\n`;
  try {
    const logDir = path.resolve(VALIDATION_DIR);
    if (fs.existsSync(logDir)) fs.appendFileSync(path.join(logDir, 'debug.log'), entry);
  } catch (_) { /* ignore */ }
}

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); }
  catch (e) { console.error(`Failed to load ${p}: ${e.message}`); return null; }
}

function normalizeUrl(url) {
  if (!url) return '';
  try { return new URL(url, 'https://placeholder.com').pathname.replace(/\/$/, ''); }
  catch { return (url || '').replace(/\/$/, '').toLowerCase(); }
}

function compareDesc(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  const sa = String(a).toLowerCase().trim();
  const sb = String(b).toLowerCase().trim();
  if (sa === sb) return true;
  const wa = new Set(sa.split(/\s+/).filter(Boolean));
  const wb = new Set(sb.split(/\s+/).filter(Boolean));
  const inter = [...wa].filter(w => wb.has(w));
  const union = new Set([...wa, ...wb]);
  return inter.length / union.size >= 0.5;
}

function compareHover(src, mig) {
  const se = src?.effect || 'none';
  const me = mig?.effect || 'none';
  if (se === 'none' && me === 'none') return { matches: true, sourceEffect: se, migratedEffect: me };
  if (se !== 'none' && me === 'none') return { matches: false, sourceEffect: se, migratedEffect: me };
  if (se === 'none' && me !== 'none') return { matches: false, sourceEffect: se, migratedEffect: me };
  return { matches: compareDesc(se, me), sourceEffect: se, migratedEffect: me };
}

function compareClick(src, mig) {
  const sa = src?.action || 'none';
  const ma = mig?.action || 'none';
  if (sa === 'none' && ma === 'none') return { matches: true, sourceAction: sa, migratedAction: ma };
  const urlMatch = normalizeUrl(src?.url) === normalizeUrl(mig?.url);
  return { matches: sa === ma && urlMatch, sourceAction: sa, migratedAction: ma };
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
    console.error('Usage: node compare-footer-elements-behavior.js <source-mapping> <migrated-mapping> [--output=<path>]');
    process.exit(2);
  }

  const source = loadJson(positional[0]);
  const migrated = loadJson(positional[1]);
  if (!source || !migrated) process.exit(2);

  debugLog('START', `compare-footer-elements-behavior.js — source=${positional[0]}, migrated=${positional[1]}`);

  const srcElements = source.elements || [];
  const migById = new Map((migrated.elements || []).map(e => [e.id, e]));

  const items = [];
  for (const srcEl of srcElements) {
    const migEl = migById.get(srcEl.id) || null;
    const hm = compareHover(srcEl.hoverBehavior, migEl?.hoverBehavior);
    const cm = compareClick(srcEl.clickBehavior, migEl?.clickBehavior);
    const allMatch = hm.matches && cm.matches && !!migEl;

    const entry = {
      id: srcEl.id,
      label: srcEl.label || srcEl.id,
      elementType: srcEl.elementType || 'other',
      hoverMatch: hm,
      clickMatch: cm,
      status: allMatch ? 'validated' : 'failed',
    };
    if (!migEl) {
      entry.remediation = `Element "${srcEl.id}" exists on source but MISSING on migrated.`;
    } else if (!allMatch) {
      const fixes = [];
      if (!hm.matches) fixes.push(`hover: source="${hm.sourceEffect}" migrated="${hm.migratedEffect}"`);
      if (!cm.matches) fixes.push(`click: source="${cm.sourceAction}" migrated="${cm.migratedAction}"`);
      entry.remediation = `Fix ${srcEl.id}: ${fixes.join('; ')}`;
    }
    items.push(entry);
  }

  const totalValidated = items.filter(i => i.status === 'validated').length;
  const totalFailed = items.filter(i => i.status === 'failed').length;
  const register = {
    items,
    allValidated: totalFailed === 0 && items.length > 0,
    summary: { totalItems: items.length, totalValidated, totalFailed },
  };

  console.log('=== Footer Elements Behavior Comparison ===');
  console.log(`Source: ${srcElements.length}, Validated: ${totalValidated}, Failed: ${totalFailed}`);

  if (totalFailed > 0) {
    console.log('\n=== FAILURES ===');
    items.filter(i => i.status === 'failed').forEach(i => {
      console.log(`  [${i.id}] "${i.label}": ${i.remediation || 'mismatch'}`);
    });
  }

  if (outputPath) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(register, null, 2));
    console.log(`\nRegister written to: ${outputPath}`);
  }

  console.log(`\n=== ${register.allValidated ? 'ALL VALIDATED' : 'VALIDATION FAILED'} ===`);
  debugLog(register.allValidated ? 'PASS' : 'BLOCK', `${totalValidated}/${items.length} validated`);
  process.exit(register.allValidated ? 0 : 1);
}

main();
