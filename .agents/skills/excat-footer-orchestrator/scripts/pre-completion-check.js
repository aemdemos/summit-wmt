#!/usr/bin/env node

/*
 * pre-completion-check.js (Footer)
 *
 * Pre-completion gate. Run BEFORE announcing "Footer migration complete."
 * Checks all registers, validation markers, and runs ESLint on blocks/footer/footer.js (deliverable only).
 *
 * Usage:
 *   node .../pre-completion-check.js [--validation-dir=migration-work/footer-validation]
 *
 * Exit codes:
 *   0 = safe to announce completion
 *   1 = conditions fail — show "Doing a final validation..." and continue fixing
 *   2 = validation dir or mobile phase missing (not yet applicable)
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { VALIDATION_DIR } from './validation-paths.js';

const ROOT = process.cwd();
const DEFAULT_VAL_DIR = path.resolve(ROOT, VALIDATION_DIR);

const issues = [];

function debugLog(validationDir, level, msg) {
  const ts = new Date().toISOString();
  const prefix = { ERROR: '❌', PASS: '✅', BLOCK: '🚫', START: '🔵' }[level] || 'ℹ️';
  const entry = `[${ts}] ${prefix} [SCRIPT:pre-completion-check] [${level}] ${msg}\n`;
  try {
    if (validationDir && fs.existsSync(validationDir)) fs.appendFileSync(path.join(validationDir, 'debug.log'), entry);
  } catch { /* ignore */ }
}

function checkRegister(filePath, label) {
  if (!fs.existsSync(filePath)) { issues.push(`${label}: register file missing — ${filePath}`); return; }
  let register;
  try { register = JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch (e) { issues.push(`${label}: cannot parse — ${e.message}`); return; }
  if (!register.allValidated) issues.push(`${label}: allValidated is false`);
}

function checkMarker(markerPath, label) {
  if (!fs.existsSync(markerPath)) issues.push(`${label}: marker missing — ${markerPath}`);
}

const args = process.argv.slice(2);
let workspaceRoot = ROOT;
let validationDirOverride = null;
args.forEach(a => {
  if (a.startsWith('--validation-dir=')) validationDirOverride = path.resolve(a.split('=')[1]);
});
const workspaceArg = args.find(a => !a.startsWith('--') && fs.existsSync(a));
if (workspaceArg) workspaceRoot = path.resolve(workspaceArg);
const useRoot = workspaceRoot;
const useValDir = validationDirOverride || (workspaceRoot !== ROOT ? path.join(workspaceRoot, VALIDATION_DIR) : DEFAULT_VAL_DIR);

debugLog(useValDir, 'START', `pre-completion-check.js (footer) — root=${useRoot}`);

if (!fs.existsSync(useValDir)) {
  console.error('pre-completion-check: validation dir not found.');
  process.exit(2);
}

if (!fs.existsSync(path.join(useValDir, 'phase-4-mobile.json'))) {
  console.error('pre-completion-check: phase-4-mobile.json not found. Mobile phase must complete first.');
  process.exit(2);
}

// Check core registers
checkRegister(path.join(useValDir, 'schema-register.json'), 'Schema register');
checkRegister(path.join(useValDir, 'footer-elements-behavior-register.json'), 'Elements behavior register');
const appearanceMappingSrc = path.join(useValDir, 'footer-appearance-mapping.json');
const appearanceMappingMigrated = path.join(useValDir, 'migrated-footer-appearance-mapping.json');
const srcAppearanceExists = fs.existsSync(appearanceMappingSrc);
const migratedAppearanceExists = fs.existsSync(appearanceMappingMigrated);
if (!srcAppearanceExists && migratedAppearanceExists) {
  issues.push('Appearance: migrated-footer-appearance-mapping.json exists but footer-appearance-mapping.json (source) is missing.');
} else if (srcAppearanceExists) {
  if (!migratedAppearanceExists) {
    issues.push('Appearance: migrated-footer-appearance-mapping.json missing (source mapping exists).');
  } else {
    checkRegister(path.join(useValDir, 'footer-appearance-register.json'), 'Appearance register');
  }
}

// Check mobile registers
checkRegister(path.join(useValDir, 'mobile', 'mobile-schema-register.json'), 'Mobile schema register');
checkRegister(path.join(useValDir, 'mobile', 'mobile-behavior-register.json'), 'Mobile behavior register');

// Check markers
checkMarker(path.join(useValDir, '.section-detection-complete'), 'Section detection');
checkMarker(path.join(useValDir, '.footer-content-validated'), 'Footer content validation');
checkMarker(path.join(useValDir, '.image-audit-passed'), 'Image audit');

const mobileStructPath = path.join(useValDir, 'mobile', 'migrated-mobile-structural-summary.json');
const mobileSchemaRegPath = path.join(useValDir, 'mobile', 'mobile-schema-register.json');
if (fs.existsSync(mobileStructPath) || fs.existsSync(mobileSchemaRegPath)) {
  checkMarker(path.join(useValDir, 'mobile', '.mobile-footer-structure-detection-complete'), 'Mobile section detection');
}

// Missing content register: all resolved
const mcr = path.join(useValDir, 'missing-content-register.json');
if (fs.existsSync(mcr)) {
  try {
    const reg = JSON.parse(fs.readFileSync(mcr, 'utf8'));
    const unresolved = (reg.items || []).filter(i => !i.resolved);
    if (unresolved.length > 0) issues.push(`Missing content register: ${unresolved.length} unresolved item(s)`);
  } catch { /* ignore */ }
}

const mobileMcr = path.join(useValDir, 'mobile', 'missing-content-register.json');
if (fs.existsSync(mobileMcr)) {
  try {
    const reg = JSON.parse(fs.readFileSync(mobileMcr, 'utf8'));
    const unresolved = (reg.items || []).filter(i => !i.resolved);
    if (unresolved.length > 0) issues.push(`Mobile missing content register: ${unresolved.length} unresolved item(s)`);
  } catch { /* ignore */ }
}

// ESLint on block deliverable only (validation scripts are tooling, often gitignored — do not gate completion on them)
const lintRelPaths = ['blocks/footer/footer.js'];
const existingLintTargets = lintRelPaths.map(r => path.join(useRoot, r)).filter(a => fs.existsSync(a));
if (existingLintTargets.length > 0) {
  const quoted = existingLintTargets.map(t => `"${t.replace(/"/g, '\\"')}"`).join(' ');
  try {
    execSync(`npx eslint ${quoted}`, { cwd: useRoot, stdio: 'pipe', encoding: 'utf8' });
  } catch (e) {
    const combined = `${e.stdout || ''}\n${e.stderr || ''}`;
    const errorLines = combined.split('\n').filter(l => /\d+:\d+\s+error/.test(l));
    issues.push(`Lint: ${errorLines.length || 1} ESLint error(s) in blocks/footer/footer.js.`);
  }
}

if (issues.length > 0) {
  console.error('❌ PRE-COMPLETION CHECK FAILED — DO NOT send completion message.\n');
  console.error(`${issues.length} issue(s):`);
  issues.forEach((issue, i) => console.error(`  ${i + 1}. ${issue}`));
  debugLog(useValDir, 'BLOCK', `FAILED — ${issues.length} issue(s)`);
  process.exit(1);
}

console.log('✅ PRE-COMPLETION CHECK PASSED — safe to send completion message.');
debugLog(useValDir, 'PASS', 'All conditions pass');
process.exit(0);
