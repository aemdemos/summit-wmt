/**
 * Workflow progress dashboard for footer validation.
 * Logs a structured summary whenever footer/validation files are edited.
 */

import fs from 'fs';
import path from 'path';
import {
  VALIDATION_DIR,
  SESSION_JSON,
  PHASE_4_MOBILE,
  SECTION_DETECTION_MARKER,
  SCHEMA_REGISTER,
  ELEMENTS_BEHAVIOR_REGISTER,
  APPEARANCE_REGISTER,
  APPEARANCE_MAPPING,
  MISSING_CONTENT_REGISTER,
  MOBILE_SCHEMA_REGISTER,
  MOBILE_BEHAVIOR_REGISTER,
  MIGRATED_FOOTER_APPEARANCE_MAPPING,
  MIGRATED_MOBILE_STRUCTURAL_SUMMARY,
  MIGRATED_MOBILE_BEHAVIOR_MAPPING,
  MOBILE_FOOTER_STRUCTURE_DETECTION,
  MOBILE_STRUCTURE_DETECTION_MARKER,
  MOBILE_MISSING_CONTENT_REGISTER,
  IMAGE_AUDIT_MARKER,
  CONTENT_VALIDATED_MARKER,
  loadJson,
  detectPhase,
} from './helpers.js';

function check(wr, rel) {
  return fs.existsSync(path.join(wr, rel));
}

function registerSummary(wr, relPath) {
  const reg = loadJson(path.join(wr, relPath));
  if (!reg) return '❌ missing';
  const items = reg.items || reg.components || [];
  const validated = items.filter(i => i.status === 'validated').length;
  const pending = items.filter(i => i.status === 'pending').length;
  const failed = items.filter(i => i.status === 'failed').length;
  const all = reg.allValidated ? '✅' : '❌';
  return `${all} ${validated}/${items.length} validated, ${pending} pending, ${failed} failed`;
}

export function logWorkflowProgress(workspaceRoot, log) {
  const wr = workspaceRoot;
  const phase = detectPhase(wr);
  const ts = new Date().toISOString();

  const desktopMilestones = {
    'session.json': check(wr, SESSION_JSON),
    'phase-1-section-detection.json': check(wr, path.join(VALIDATION_DIR, 'phase-1-section-detection.json')),
    'detect-footer-sections.js RAN': check(wr, path.join(VALIDATION_DIR, SECTION_DETECTION_MARKER)),
    'phase-2-section-mapping.json': check(wr, path.join(VALIDATION_DIR, 'phase-2-section-mapping.json')),
    'phase-3-aggregate.json': check(wr, path.join(VALIDATION_DIR, 'phase-3-aggregate.json')),
    'footer-appearance-mapping.json': check(wr, APPEARANCE_MAPPING),
    'footer-elements-mapping.json': check(wr, path.join(VALIDATION_DIR, 'footer-elements-mapping.json')),
    'content/footer.plain.html': check(wr, 'content/footer.plain.html'),
    'validate-footer-content.js RAN': check(wr, CONTENT_VALIDATED_MARKER),
    'audit-footer-images.js RAN': check(wr, IMAGE_AUDIT_MARKER),
    'blocks/footer/footer.css': check(wr, 'blocks/footer/footer.css'),
    'blocks/footer/footer.js': check(wr, 'blocks/footer/footer.js'),
    'migrated-structural-summary.json': check(wr, path.join(VALIDATION_DIR, 'migrated-structural-summary.json')),
    'migrated-footer-elements-mapping.json': check(wr, path.join(VALIDATION_DIR, 'migrated-footer-elements-mapping.json')),
    'migrated-footer-appearance-mapping.json': check(wr, MIGRATED_FOOTER_APPEARANCE_MAPPING),
  };

  const mobileMilestones = {
    'phase-4-mobile.json': check(wr, PHASE_4_MOBILE),
    'mobile-footer-structure-detection.json': check(wr, MOBILE_FOOTER_STRUCTURE_DETECTION),
    'detect-footer-mobile-sections.js RAN': check(wr, MOBILE_STRUCTURE_DETECTION_MARKER),
    'migrated-mobile-structural-summary.json': check(wr, MIGRATED_MOBILE_STRUCTURAL_SUMMARY),
    'migrated-mobile-behavior-mapping.json': check(wr, MIGRATED_MOBILE_BEHAVIOR_MAPPING),
  };

  const lines = [
    '╔══════════════════════════════════════════════════════════════╗',
    '║              FOOTER WORKFLOW PROGRESS DASHBOARD             ║',
    '╠══════════════════════════════════════════════════════════════╣',
    `║ Phase: ${phase.padEnd(20)} Time: ${ts.slice(0, 19)}     ║`,
    '╠══════════════════════════════════════════════════════════════╣',
    '║ DESKTOP MILESTONES                                         ║',
  ];

  for (const [label, exists] of Object.entries(desktopMilestones)) {
    const icon = exists ? '✅' : '❌';
    lines.push(`║  ${icon} ${label.padEnd(55)}║`);
  }

  lines.push('╠══════════════════════════════════════════════════════════════╣');
  lines.push('║ REGISTERS                                                  ║');
  lines.push(`║  schema-register: ${registerSummary(wr, SCHEMA_REGISTER).padEnd(40)}║`);
  lines.push(`║  elements-behavior: ${registerSummary(wr, ELEMENTS_BEHAVIOR_REGISTER).padEnd(38)}║`);
  lines.push(`║  appearance: ${registerSummary(wr, APPEARANCE_REGISTER).padEnd(45)}║`);

  const mcReg = loadJson(path.join(wr, MISSING_CONTENT_REGISTER));
  if (mcReg) {
    const unresolved = (mcReg.items || []).filter(i => !i.resolved).length;
    const total = (mcReg.items || []).length;
    lines.push(`║  missing-content: ${unresolved === 0 ? '✅' : '❌'} ${total - unresolved}/${total} resolved${(' '.repeat(30))}║`.slice(0, 63) + '║');
  }

  lines.push('╠══════════════════════════════════════════════════════════════╣');
  lines.push('║ MOBILE MILESTONES                                          ║');
  for (const [label, exists] of Object.entries(mobileMilestones)) {
    const icon = exists ? '✅' : '❌';
    lines.push(`║  ${icon} ${label.padEnd(55)}║`);
  }

  if (check(wr, PHASE_4_MOBILE)) {
    lines.push(`║  mobile-schema: ${registerSummary(wr, MOBILE_SCHEMA_REGISTER).padEnd(42)}║`);
    lines.push(`║  mobile-behavior: ${registerSummary(wr, MOBILE_BEHAVIOR_REGISTER).padEnd(40)}║`);
    const mobileMcReg = loadJson(path.join(wr, MOBILE_MISSING_CONTENT_REGISTER));
    if (mobileMcReg) {
      const unresolved = (mobileMcReg.items || []).filter(i => !i.resolved).length;
      const total = (mobileMcReg.items || []).length;
      lines.push(`║  mobile-missing-content: ${unresolved === 0 ? '✅' : '❌'} ${total - unresolved}/${total}${(' '.repeat(30))}║`.slice(0, 63) + '║');
    }
  }

  lines.push('╚══════════════════════════════════════════════════════════════╝');

  log('INFO', 'WORKFLOW PROGRESS DASHBOARD\n' + lines.join('\n'));
}
