#!/usr/bin/env node

/*
 * Footer Validation Gate Hook (Table-Driven)
 *
 * Enforces footer orchestrator requirements via hard programmatic gates.
 * Registered on PostToolUse (Write|Edit) and Stop events in plugin.json.
 *
 * PostToolUse gates are defined in footer-validation-gates/gate-table.js.
 * Stop checks remain in handleStop below.
 *
 * LOGGING: Writes to BOTH /tmp (always) and workspace debug.log (when session exists).
 * Check: migration-work/footer-validation/debug.log for full execution trace.
 */

import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  VALIDATION_DIR,
  SESSION_JSON,
  PHASE_4_MOBILE,
  SECTION_DETECTION_MARKER,
  APPEARANCE_REGISTER,
  APPEARANCE_MAPPING,
  MIGRATED_FOOTER_APPEARANCE_MAPPING,
  MIGRATED_MOBILE_STRUCTURAL_SUMMARY,
  CONTENT_VALIDATED_MARKER,
  DEBUG_LOG,
  MOBILE_FOOTER_STRUCTURE_DETECTION,
  MOBILE_STRUCTURE_DETECTION_MARKER,
  blockReason,
  loadJson,
  detectPhase,
  isFooterBlockFile,
  isFooterContentFile,
  isFooterValidationFile,
  getFooterFilePath,
} from './footer-validation-gates/helpers.js';
import {
  checkFooterContentForImages,
  checkImageAudit,
  checkSectionCountParity,
  checkFooterHeightSanity,
  checkSchemaRegister,
  checkElementsBehaviorRegister,
  checkMobileRegisters,
  checkMissingContentRegister,
  checkMobileMissingContentRegister,
  checkElementsBehaviorRegisterShortcutNotes,
  checkMobileBehaviorRegisterShortcutNotes,
  checkMandatoryAppearanceParityBlocks,
} from './footer-validation-gates/checks.js';
import { buildContext, runPostToolUseGates, POST_TOOL_USE_GATES } from './footer-validation-gates/gate-table.js';
import { logWorkflowProgress } from './footer-validation-gates/workflow-progress.js';

let sessionId = 'default';
let TMP_LOG = path.join(os.tmpdir(), 'excat-footer-gate-debug-default.log');
let workspaceDebugLog = null;
const hookStartTime = Date.now();

function initSession(hookInput) {
  sessionId = hookInput?.session_id || 'default';
  TMP_LOG = path.join(os.tmpdir(), `excat-footer-gate-debug-${sessionId}.log`);
}

function log(level, msg, data = null) {
  const ts = new Date().toISOString();
  const elapsed = Date.now() - hookStartTime;
  const prefix = { ERROR: '❌', BLOCK: '🚫', WARN: '⚠️', PASS: '✅', START: '🔵', END: '🏁' }[level] || 'ℹ️';
  const dataStr = data ? `\n${JSON.stringify(data, null, 2)}` : '';
  const entry = `[${ts}] (+${elapsed}ms) ${prefix} [${level}] ${msg}${dataStr}\n`;
  try { fs.appendFileSync(TMP_LOG, entry); } catch (_) { /* ignore */ }
  if (workspaceDebugLog) {
    try { fs.appendFileSync(workspaceDebugLog, entry); } catch (_) { /* ignore */ }
  }
}

function initWorkspaceLog(workspaceRoot) {
  const logDir = path.join(workspaceRoot, VALIDATION_DIR);
  if (fs.existsSync(logDir)) workspaceDebugLog = path.join(workspaceRoot, DEBUG_LOG);
}

function logDecision(decision, summary) {
  const elapsed = Date.now() - hookStartTime;
  log('END', `Hook decision: ${decision.toUpperCase()} — ${summary} (elapsed: ${elapsed}ms)`);
}

async function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8'))); }
      catch (e) { reject(new Error(`Failed to parse stdin: ${e.message}`)); }
    });
    process.stdin.on('error', reject);
  });
}

function findWorkspaceRoot(startPath) {
  let check = path.resolve(startPath);
  const root = path.parse(check).root;
  while (check !== root) {
    if (fs.existsSync(path.join(check, '.git'))) return check;
    const parent = path.dirname(check);
    if (parent === check) break;
    check = parent;
  }
  check = path.resolve(startPath);
  while (check !== root) {
    if (fs.existsSync(path.join(check, 'blocks'))) return check;
    const parent = path.dirname(check);
    if (parent === check) break;
    check = parent;
  }
  return process.cwd();
}

function handlePostToolUse(hookInput) {
  const filePath = hookInput?.tool_input?.file_path;
  const toolName = hookInput?.tool_name || 'unknown';
  if (!filePath) {
    log('INFO', `PostToolUse: no file_path (tool=${toolName}) — skipping`);
    console.log(JSON.stringify({ reason: 'No file path in tool input.' }));
    return;
  }

  const workspaceRoot = findWorkspaceRoot(path.dirname(filePath));
  initWorkspaceLog(workspaceRoot);
  const relPath = path.relative(workspaceRoot, filePath);
  log('START', `PostToolUse — tool=${toolName}, file=${relPath}`);

  if (isFooterBlockFile(filePath) || isFooterContentFile(filePath) || isFooterValidationFile(filePath)) {
    logWorkflowProgress(workspaceRoot, log);
  }

  const ctx = buildContext(hookInput);
  ctx.filePath = path.isAbsolute(filePath) ? filePath : path.join(workspaceRoot, filePath);
  const result = runPostToolUseGates(ctx, POST_TOOL_USE_GATES, log);

  if (result.decision === 'block') {
    logDecision('block', result.reason?.slice(0, 80) || 'Gate blocked');
    console.log(JSON.stringify({ decision: 'block', reason: blockReason(result.reason) }));
    return;
  }
  if (result.decision === 'warn') {
    logDecision('warn', result.reason?.slice(0, 80) || 'Gate warning');
    console.log(JSON.stringify({ decision: 'warn', reason: result.reason }));
    return;
  }

  const phase = detectPhase(workspaceRoot);
  log('PASS', `[${phase}] All gates passed for: ${relPath}`);
  logDecision('allow', `[${phase}] ${path.basename(filePath)} passed all gates`);
  console.log(JSON.stringify({
    success: true,
    file: filePath,
    message: `Footer gate [${phase}]: ${path.basename(filePath)} passed.`,
  }));
}

function handleStop(hookInput) {
  const workspaceRoot = hookInput?.tool_input?.file_path
    ? findWorkspaceRoot(path.dirname(hookInput.tool_input.file_path))
    : process.cwd();

  initWorkspaceLog(workspaceRoot);
  log('START', '=== STOP EVENT — Final footer validation gate ===');
  logWorkflowProgress(workspaceRoot, log);

  const sessionFile = path.join(workspaceRoot, SESSION_JSON);
  if (!fs.existsSync(sessionFile)) {
    log('INFO', 'No session.json — not a footer orchestrator run, skipping');
    logDecision('allow', 'No footer session');
    console.log(JSON.stringify({ reason: 'No footer orchestrator session. Gate skipped.' }));
    return;
  }

  // Gitignore safety check
  const gitignorePath = path.join(workspaceRoot, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    try {
      const content = fs.readFileSync(gitignorePath, 'utf8');
      if (!content.includes('footer-validation')) {
        log('WARN', '[GITIGNORE] .gitignore does not exclude migration-work/footer-validation/');
      }
    } catch (_) { /* ignore */ }
  }

  const allErrors = [];
  const allRemediation = [];

  // Section detection script
  const phase1Path = path.join(workspaceRoot, VALIDATION_DIR, 'phase-1-section-detection.json');
  if (fs.existsSync(phase1Path) && !fs.existsSync(path.join(workspaceRoot, VALIDATION_DIR, SECTION_DETECTION_MARKER))) {
    allErrors.push('phase-1-section-detection.json exists but detect-footer-sections.js has NOT been run.');
  }

  const mobileStructDetPath = path.join(workspaceRoot, MOBILE_FOOTER_STRUCTURE_DETECTION);
  const mobileStructDetMarkerPath = path.join(workspaceRoot, MOBILE_STRUCTURE_DETECTION_MARKER);
  if (fs.existsSync(mobileStructDetPath) && !fs.existsSync(mobileStructDetMarkerPath)) {
    allErrors.push('[MOBILE] mobile-footer-structure-detection.json exists but detect-footer-mobile-sections.js has NOT been run.');
  }
  if (fs.existsSync(path.join(workspaceRoot, MIGRATED_MOBILE_STRUCTURAL_SUMMARY)) && !fs.existsSync(mobileStructDetMarkerPath)) {
    allErrors.push('[MOBILE] migrated-mobile-structural-summary.json exists but mobile structure detection (.mobile-footer-structure-detection-complete) is missing.');
  }

  // Height sanity + section parity
  const heightErr = checkFooterHeightSanity(workspaceRoot);
  if (heightErr) allErrors.push(heightErr);
  const parityErr = checkSectionCountParity(workspaceRoot);
  if (parityErr) allErrors.push(parityErr);

  // Footer content
  const footerFilePath = getFooterFilePath(workspaceRoot);
  if (!footerFilePath) {
    allErrors.push('content/footer.plain.html does not exist.');
  } else {
    const imgErr = checkFooterContentForImages(footerFilePath, workspaceRoot);
    if (imgErr) allErrors.push(imgErr);
    if (!fs.existsSync(path.join(workspaceRoot, CONTENT_VALIDATED_MARKER))) {
      allErrors.push('validate-footer-content.js has NOT been run.');
    }
    const imageAuditErr = checkImageAudit(workspaceRoot);
    if (imageAuditErr) allErrors.push(imageAuditErr);
  }

  // Missing content
  const mcResult = checkMissingContentRegister(workspaceRoot);
  if (mcResult.errors.length > 0) { allErrors.push(...mcResult.errors); allRemediation.push(...mcResult.remediation); }

  // Schema register
  const schemaResult = checkSchemaRegister(workspaceRoot);
  allErrors.push(...schemaResult.errors);

  // Elements behavior register
  const behaviorResult = checkElementsBehaviorRegister(workspaceRoot);
  allErrors.push(...behaviorResult.errors);

  // Shortcut notes
  const shortcutResult = checkElementsBehaviorRegisterShortcutNotes(workspaceRoot);
  if (!shortcutResult.pass) {
    for (const s of shortcutResult.shortcutItems) {
      allErrors.push(`Element "${s.id}" marked validated with shortcut note — fix implementation.`);
    }
  }

  // Appearance — align with checkDesktopComplete: source mapping ⇒ migrated + register; orphaned migrated without source is invalid
  const appearanceMappingPath = path.join(workspaceRoot, APPEARANCE_MAPPING);
  const migratedAppearancePath = path.join(workspaceRoot, MIGRATED_FOOTER_APPEARANCE_MAPPING);
  const srcAppearanceExists = fs.existsSync(appearanceMappingPath);
  const migratedAppearanceExists = fs.existsSync(migratedAppearancePath);
  const appearanceReg = loadJson(path.join(workspaceRoot, APPEARANCE_REGISTER));
  if (srcAppearanceExists) {
    const parityStop = checkMandatoryAppearanceParityBlocks(workspaceRoot);
    if (!parityStop.pass) allErrors.push(parityStop.message);
  }
  if (!srcAppearanceExists && migratedAppearanceExists) {
    allErrors.push(
      'migrated-footer-appearance-mapping.json exists but footer-appearance-mapping.json (source) is missing. Restore source mapping and run compare-footer-appearance.js.',
    );
  }
  if (srcAppearanceExists && !migratedAppearanceExists) {
    allErrors.push(
      'footer-appearance-mapping.json (source) exists but migrated-footer-appearance-mapping.json is missing. Create migrated mapping and run compare-footer-appearance.js.',
    );
  }
  if (srcAppearanceExists && migratedAppearanceExists) {
    if (!appearanceReg) {
      allErrors.push('footer-appearance-register.json is missing. Run compare-footer-appearance.js.');
    } else if (!appearanceReg.allValidated) {
      allErrors.push('footer-appearance-register.json allValidated is not true.');
    }
  }

  // Mobile
  const phase4Path = path.join(workspaceRoot, PHASE_4_MOBILE);
  if (fs.existsSync(phase4Path)) {
    const mobileResult = checkMobileRegisters(workspaceRoot);
    allErrors.push(...mobileResult.errors);
    const mobileMcResult = checkMobileMissingContentRegister(workspaceRoot);
    if (mobileMcResult.errors.length > 0) { allErrors.push(...mobileMcResult.errors); }
    const mobileShortcutResult = checkMobileBehaviorRegisterShortcutNotes(workspaceRoot);
    if (!mobileShortcutResult.pass) {
      for (const s of mobileShortcutResult.shortcutItems) {
        allErrors.push(`[MOBILE] Behavior register item "${s.id}" marked validated with shortcut note — fix implementation, remove the note.`);
      }
    }
  }

  // Pre-completion check script
  if (allErrors.length === 0 && fs.existsSync(phase4Path)) {
    const preCheckScript = path.join(workspaceRoot, VALIDATION_DIR, 'scripts', 'pre-completion-check.js');
    if (fs.existsSync(preCheckScript)) {
      try {
        execFileSync(process.execPath, [preCheckScript], {
          cwd: workspaceRoot, encoding: 'utf8', timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'],
        });
        log('PASS', '[PRE-COMPLETION] passed');
      } catch (e) {
        const out = `${e.stdout || ''}${e.stderr || ''}`.trim();
        allErrors.push(`[PRE-COMPLETION] pre-completion-check.js failed:\n${out.slice(0, 800)}`);
      }
    }
  }

  if (allErrors.length > 0) {
    log('BLOCK', `Stop gate BLOCKED — ${allErrors.length} issue(s)`, allErrors);
    let msg = `🚫 [Footer Gate] Cannot stop — ${allErrors.length} issue(s):\n\n` + allErrors.map((e, i) => `  ${i + 1}. ${e}`).join('\n');
    if (allRemediation.length > 0) {
      msg += '\n\n=== REQUIRED REMEDIATION ===\n\n' + allRemediation.map((r, i) => `  ${i + 1}. ${r}`).join('\n\n');
    }
    msg += '\n\nFix ALL issues before completing.';
    logDecision('block', `${allErrors.length} issue(s)`);
    console.log(JSON.stringify({ decision: 'block', reason: blockReason(msg) }));
    return;
  }

  log('PASS', '=== ALL STOP CHECKS PASSED ===');
  logDecision('allow', 'All checks passed');
  console.log(JSON.stringify({ reason: 'Footer gate: all checks passed.' }));
}

async function main() {
  try {
    const hookInput = await readStdin();
    initSession(hookInput);
    const event = hookInput?.hook_event_name || hookInput?.hook_event || 'PostToolUse';
    log('START', `========== FOOTER VALIDATION GATE HOOK ==========`);
    log('INFO', `Event: ${event} | Session: ${sessionId}`);

    if (event === 'Stop') handleStop(hookInput);
    else handlePostToolUse(hookInput);
  } catch (error) {
    log('ERROR', `Hook crashed: ${error.message}`);
    logDecision('allow', `Error fallback: ${error.message}`);
    console.log(JSON.stringify({ reason: `Footer gate error: ${error.message}` }));
    process.exit(0);
  }
}

main();
