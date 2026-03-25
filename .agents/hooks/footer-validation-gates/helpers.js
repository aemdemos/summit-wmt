/**
 * Shared helpers for footer-validation-gate.
 * Used by gate-table and main hook.
 */

import fs from 'fs';
import path from 'path';

/** Keep in sync with `.agents/skills/excat-footer-orchestrator/scripts/validation-paths.js`. */
export const VALIDATION_DIR = 'migration-work/footer-validation';
export const SESSION_JSON = path.join(VALIDATION_DIR, 'session.json');
export const SECTION_DETECTION_MARKER = '.section-detection-complete';
export const SCHEMA_REGISTER = path.join(VALIDATION_DIR, 'schema-register.json');
export const ELEMENTS_BEHAVIOR_REGISTER = path.join(VALIDATION_DIR, 'footer-elements-behavior-register.json');
export const APPEARANCE_REGISTER = path.join(VALIDATION_DIR, 'footer-appearance-register.json');
export const APPEARANCE_MAPPING = path.join(VALIDATION_DIR, 'footer-appearance-mapping.json');
/** Post-implementation migrated footer appearance — paired with APPEARANCE_MAPPING for compare-footer-appearance.js */
export const MIGRATED_FOOTER_APPEARANCE_MAPPING = path.join(VALIDATION_DIR, 'migrated-footer-appearance-mapping.json');
export const AGGREGATE = path.join(VALIDATION_DIR, 'phase-3-aggregate.json');
export const PHASE_4_MOBILE = path.join(VALIDATION_DIR, 'phase-4-mobile.json');
export const DEBUG_LOG = path.join(VALIDATION_DIR, 'debug.log');
export const MOBILE_DIR = path.join(VALIDATION_DIR, 'mobile');
/** Source footer structure at mobile viewport — written by detect-footer-mobile-sections.js */
export const MOBILE_FOOTER_STRUCTURE_DETECTION = path.join(MOBILE_DIR, 'mobile-footer-structure-detection.json');
export const MOBILE_STRUCTURE_DETECTION_MARKER = path.join(MOBILE_DIR, '.mobile-footer-structure-detection-complete');
export const MOBILE_SCHEMA_REGISTER = path.join(MOBILE_DIR, 'mobile-schema-register.json');
export const MOBILE_BEHAVIOR_REGISTER = path.join(MOBILE_DIR, 'mobile-behavior-register.json');
export const MIGRATED_MOBILE_STRUCTURAL_SUMMARY = path.join(MOBILE_DIR, 'migrated-mobile-structural-summary.json');
export const MIGRATED_MOBILE_BEHAVIOR_MAPPING = path.join(MOBILE_DIR, 'migrated-mobile-behavior-mapping.json');
export const MISSING_CONTENT_REGISTER = path.join(VALIDATION_DIR, 'missing-content-register.json');
export const MOBILE_MISSING_CONTENT_REGISTER = path.join(MOBILE_DIR, 'missing-content-register.json');
export const IMAGE_AUDIT_MARKER = path.join(VALIDATION_DIR, '.image-audit-passed');
export const IMAGE_AUDIT_REPORT = path.join(VALIDATION_DIR, 'image-audit-report.json');
export const CONTENT_VALIDATED_MARKER = path.join(VALIDATION_DIR, '.footer-content-validated');

export const IMAGE_PATTERN = /!\[[^\]]*\]\([^)]+\)/;
export const IMG_TAG_PATTERN = /<img\s[^>]*src\s*=\s*["'][^"']+["'][^>]*>/i;

export const BLOCK_REASON_PARITY_NOTE = '\n\nWe require 100% parity with the original site; this check is essential.';

export function blockReason(reason) {
  return reason + BLOCK_REASON_PARITY_NOTE;
}

export function loadJson(p) {
  try {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch (_) { /* ignore */ }
  return null;
}

export function isFooterContentFile(filePath) {
  if (!filePath) return false;
  return path.basename(filePath) === 'footer.plain.html';
}

export function getFooterFilePath(workspaceRoot) {
  const plainHtml = path.join(workspaceRoot, 'content', 'footer.plain.html');
  return fs.existsSync(plainHtml) ? plainHtml : null;
}

export function isFooterBlockFile(filePath) {
  if (!filePath) return false;
  return path.normalize(filePath).includes(path.join('blocks', 'footer'));
}

export function isFooterValidationFile(filePath) {
  if (!filePath) return false;
  return path.normalize(filePath).includes(path.join('migration-work', 'footer-validation'));
}

export function isFooterCssFile(filePath) {
  if (!filePath) return false;
  return path.basename(filePath) === 'footer.css' && isFooterBlockFile(filePath);
}

export function isFooterJsFile(filePath) {
  if (!filePath) return false;
  return path.basename(filePath) === 'footer.js' && isFooterBlockFile(filePath);
}

export function isMobileFile(filePath) {
  if (!filePath) return false;
  return path.normalize(filePath).includes(path.join('migration-work', 'footer-validation', 'mobile'));
}

export function isMobileBehaviorRegisterFile(filePath) {
  if (!filePath) return false;
  return path.basename(filePath) === 'mobile-behavior-register.json' && isMobileFile(filePath);
}

export function isBehaviorRegisterFile(filePath) {
  if (!filePath) return false;
  return path.basename(filePath) === 'footer-elements-behavior-register.json' && isFooterValidationFile(filePath);
}

export function detectPhase(workspaceRoot) {
  const hasP4 = fs.existsSync(path.join(workspaceRoot, PHASE_4_MOBILE));
  if (hasP4) return 'MOBILE';
  const hasAgg = fs.existsSync(path.join(workspaceRoot, AGGREGATE));
  if (hasAgg) return 'DESKTOP-IMPL';
  return 'DESKTOP';
}
