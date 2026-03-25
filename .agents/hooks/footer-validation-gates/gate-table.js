/**
 * Table-driven gate definitions for PostToolUse (footer).
 * Each gate: { id, when(ctx), severity, check(ctx) => { pass, message? } }
 * Order matters: gates run in array order; first failure returns.
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
  MOBILE_SCHEMA_REGISTER,
  MOBILE_BEHAVIOR_REGISTER,
  MIGRATED_FOOTER_APPEARANCE_MAPPING,
  MIGRATED_MOBILE_STRUCTURAL_SUMMARY,
  MIGRATED_MOBILE_BEHAVIOR_MAPPING,
  MOBILE_FOOTER_STRUCTURE_DETECTION,
  MOBILE_STRUCTURE_DETECTION_MARKER,
  IMAGE_AUDIT_MARKER,
  CONTENT_VALIDATED_MARKER,
  loadJson,
  isFooterContentFile,
  isFooterBlockFile,
  isFooterValidationFile,
  isFooterCssFile,
  isFooterJsFile,
  isMobileFile,
  isMobileBehaviorRegisterFile,
  isBehaviorRegisterFile,
  getFooterFilePath,
} from './helpers.js';
import {
  checkFooterContentLocation,
  checkFooterContentForImages,
  checkSectionCountParity,
  checkFooterHeightSanity,
  checkDesktopComplete,
  checkMissingContentRegister,
  checkMobileMissingContentRegister,
  checkElementsBehaviorRegisterShortcutNotes,
  checkMobileBehaviorRegisterShortcutNotes,
  checkFooterAppearanceMappingBeforeImplementation,
  checkPhase2RequiredFields,
} from './checks.js';

export function runPostToolUseGates(ctx, gates, log) {
  ctx.log = log;
  for (const gate of gates) {
    if (!gate.when(ctx)) continue;
    log('INFO', `Gate ${gate.id}: running...`);
    const result = gate.check(ctx);
    if (!result.pass) {
      const severity = result.severity || gate.severity;
      log(severity === 'warn' ? 'WARN' : 'BLOCK', `Gate ${gate.id} ${severity === 'warn' ? 'WARNING' : 'FAILED'}`, result.message ? [result.message.slice(0, 200) + '...'] : null);
      return { decision: severity, reason: result.message };
    }
  }
  return { decision: 'allow' };
}

export function buildContext(hookInput) {
  const filePath = hookInput?.tool_input?.file_path;
  const workspaceRoot = filePath ? (() => {
    let check = path.resolve(path.dirname(filePath));
    const root = path.parse(check).root;
    while (check !== root) {
      if (fs.existsSync(path.join(check, '.git'))) return check;
      const parent = path.dirname(check);
      if (parent === check) break;
      check = parent;
    }
    check = path.resolve(path.dirname(filePath));
    while (check !== root) {
      if (fs.existsSync(path.join(check, 'blocks'))) return check;
      const parent = path.dirname(check);
      if (parent === check) break;
      check = parent;
    }
    return process.cwd();
  })() : process.cwd();
  const relPath = filePath ? path.relative(workspaceRoot, filePath) : '';
  const basename = filePath ? path.basename(filePath) : '';
  return { filePath, workspaceRoot, relPath, basename, hookInput };
}

export const POST_TOOL_USE_GATES = [
  // Gate 1: footer content location
  {
    id: '1',
    when: () => true,
    severity: 'block',
    check: (ctx) => {
      const err = checkFooterContentLocation(ctx.filePath, ctx.workspaceRoot);
      if (err) return { pass: false, message: `🚫 [Footer Gate] ${err}` };
      return { pass: true };
    },
  },

  // Gate WORKFLOW_START_MESSAGE: session.json must have workflowStartMessageDisplayed: true
  {
    id: 'WORKFLOW_START_MESSAGE',
    when: (ctx) => ctx.basename === 'session.json' && isFooterValidationFile(ctx.filePath),
    severity: 'block',
    check: (ctx) => {
      // Auto-patch .gitignore
      const gitignorePath = path.join(ctx.workspaceRoot, '.gitignore');
      const gitignoreRule = 'migration-work/footer-validation/';
      try {
        const existing = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
        if (!existing.includes('footer-validation')) {
          const sep = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
          fs.appendFileSync(gitignorePath, `${sep}\n# Footer validation infrastructure (auto-added by footer orchestrator hook)\n${gitignoreRule}\n`);
          ctx.log?.('PASS', `[GITIGNORE] Auto-appended "${gitignoreRule}" to .gitignore`);
        }
      } catch (e) {
        ctx.log?.('WARN', `[GITIGNORE] Could not patch .gitignore: ${e.message}`);
      }

      const sessionPath = path.isAbsolute(ctx.filePath) ? ctx.filePath : path.join(ctx.workspaceRoot, ctx.filePath);
      const session = loadJson(sessionPath);
      if (!session || session.workflowStartMessageDisplayed !== true) {
        return { pass: false, message: '🚫 [Footer Gate] session.json written without workflowStartMessageDisplayed: true.\n\nDisplay the workflow start message from references/workflow-start-message.md BEFORE writing session.json.' };
      }
      return { pass: true };
    },
  },

  // Gate SECTION_COUNT_PARITY
  {
    id: 'SECTION_COUNT_PARITY',
    when: (ctx) => ctx.basename === 'phase-2-section-mapping.json',
    severity: 'block',
    check: (ctx) => {
      const err = checkSectionCountParity(ctx.workspaceRoot);
      if (err) return { pass: false, message: `🚫 [Footer Gate] ${err}` };
      return { pass: true };
    },
  },

  // Gate FOOTER_HEIGHT_SANITY
  {
    id: 'FOOTER_HEIGHT_SANITY',
    when: (ctx) => ctx.basename === 'phase-2-section-mapping.json' || ctx.basename === 'phase-1-section-detection.json',
    severity: 'block',
    check: (ctx) => {
      const err = checkFooterHeightSanity(ctx.workspaceRoot);
      if (err) return { pass: false, message: `🚫 [Footer Gate] ${err}` };
      return { pass: true };
    },
  },

  // Gate PHASE2_REQUIRED_FIELDS
  {
    id: 'PHASE2_REQUIRED_FIELDS',
    when: (ctx) => ctx.basename === 'phase-2-section-mapping.json',
    severity: 'block',
    check: (ctx) => checkPhase2RequiredFields(ctx.workspaceRoot, ctx.filePath),
  },

  // Gate APPEARANCE_MAPPING_COMPLETE: layoutSpacing + phase-driven promo/link/form bands (matches compare-footer-appearance optional blocks)
  {
    id: 'APPEARANCE_MAPPING_COMPLETE',
    when: (ctx) => ctx.basename === 'footer-appearance-mapping.json' && isFooterValidationFile(ctx.filePath),
    severity: 'block',
    check: (ctx) => {
      const r = checkFooterAppearanceMappingBeforeImplementation(ctx.workspaceRoot);
      if (!r.pass) return r;
      return { pass: true };
    },
  },

  // Gate FOOTER_CONTENT_IMAGES
  {
    id: 'FOOTER_CONTENT_IMAGES',
    when: () => true,
    severity: 'block',
    check: (ctx) => {
      const err = checkFooterContentForImages(ctx.filePath, ctx.workspaceRoot);
      if (err) return { pass: false, message: `🚫 [Footer Gate] ${err}` };
      return { pass: true };
    },
  },

  // Gate SHORTCUT_NOTES_BEHAVIOR
  {
    id: 'SHORTCUT_NOTES_BEHAVIOR',
    when: (ctx) => isBehaviorRegisterFile(ctx.filePath),
    severity: 'block',
    check: (ctx) => {
      const { pass, shortcutItems } = checkElementsBehaviorRegisterShortcutNotes(ctx.workspaceRoot);
      if (pass) return { pass: true };
      return { pass: false, message: `🚫 [Footer Gate] BLOCKED — behavior register has validated items with shortcut notes.\n\n${shortcutItems.map(s => `  ${s.id}: "${(s.note || '').slice(0, 80)}"`).join('\n')}\n\nFix the implementation, remove the note.` };
    },
  },

  // Gate SHORTCUT_NOTES_MOBILE_BEHAVIOR
  {
    id: 'SHORTCUT_NOTES_MOBILE_BEHAVIOR',
    when: (ctx) => isMobileBehaviorRegisterFile(ctx.filePath),
    severity: 'block',
    check: (ctx) => {
      const { pass, shortcutItems } = checkMobileBehaviorRegisterShortcutNotes(ctx.workspaceRoot);
      if (pass) return { pass: true };
      return { pass: false, message: `🚫 [Footer Gate] BLOCKED — mobile behavior register has validated items with shortcut notes.\n\n${shortcutItems.map(s => `  ${s.id}: "${(s.note || '').slice(0, 80)}"`).join('\n')}\n\nFix the implementation, remove the note.` };
    },
  },

  // Gate MANDATORY_SCRIPTS: enforce sequential script execution
  {
    id: 'MANDATORY_SCRIPTS',
    when: (ctx) => isFooterBlockFile(ctx.filePath) || isFooterContentFile(ctx.filePath) || isFooterValidationFile(ctx.filePath),
    severity: 'block',
    check: (ctx) => {
      const sessionFile = path.join(ctx.workspaceRoot, SESSION_JSON);
      if (!fs.existsSync(sessionFile)) return { pass: true };
      const blocks = [];
      const wr = ctx.workspaceRoot;

      // Phase-1 requires detect-footer-sections.js
      const phase1Exists = fs.existsSync(path.join(wr, VALIDATION_DIR, 'phase-1-section-detection.json'));
      const sectionDetectionComplete = fs.existsSync(path.join(wr, VALIDATION_DIR, SECTION_DETECTION_MARKER));
      if (phase1Exists && !sectionDetectionComplete) {
        blocks.push('phase-1-section-detection.json exists but detect-footer-sections.js has NOT been run.\n  → Run FIRST: node migration-work/footer-validation/scripts/detect-footer-sections.js --url=<source-url>');
      }
      if (ctx.basename === 'phase-1-section-detection.json' && !sectionDetectionComplete) {
        blocks.push('Do NOT write phase-1-section-detection.json manually. Run detect-footer-sections.js first.');
      }
      if (ctx.basename === 'phase-2-section-mapping.json' && !sectionDetectionComplete) {
        blocks.push('Do NOT write phase-2 until Phase 1 is produced by the script.');
      }

      // Mobile files blocked until desktop complete + phase-4 exists
      if (isMobileFile(ctx.filePath)) {
        const phase4Exists = fs.existsSync(path.join(wr, PHASE_4_MOBILE));
        if (!phase4Exists) {
          blocks.push('[MOBILE] Cannot create mobile files until phase-4-mobile.json exists.');
        } else {
          const desktopResult = checkDesktopComplete(wr);
          if (!desktopResult.pass) blocks.push(`[MOBILE] Desktop validation incomplete: ${desktopResult.message}`);
        }
      }

      // Footer content validation
      const footerFile = getFooterFilePath(wr);
      const contentValidated = fs.existsSync(path.join(wr, CONTENT_VALIDATED_MARKER));
      if (footerFile && !contentValidated && !isFooterContentFile(ctx.filePath)) {
        blocks.push(`footer.plain.html exists but validate-footer-content.js has NOT been run.\n  → Run: node migration-work/footer-validation/scripts/validate-footer-content.js content/footer.plain.html migration-work/footer-validation`);
      }

      // Image audit
      const imageAuditPassed = fs.existsSync(path.join(wr, IMAGE_AUDIT_MARKER));
      if (footerFile && contentValidated && !imageAuditPassed && !isFooterContentFile(ctx.filePath)) {
        blocks.push('validate-footer-content.js passed but audit-footer-images.js has NOT been run.\n  → Run: node migration-work/footer-validation/scripts/audit-footer-images.js content/footer.plain.html migration-work/footer-validation');
      }

      // Structural schema comparison
      const migratedStructExists = fs.existsSync(path.join(wr, VALIDATION_DIR, 'migrated-structural-summary.json'));
      const schemaRegExists = fs.existsSync(path.join(wr, SCHEMA_REGISTER));
      if (migratedStructExists && !schemaRegExists && ctx.basename !== 'migrated-structural-summary.json') {
        blocks.push('migrated-structural-summary.json exists but compare-footer-structural-schema.js has NOT been run.\n  → Run NOW: node migration-work/footer-validation/scripts/compare-footer-structural-schema.js <phase-1> <phase-2> <migrated-summary> --threshold=100 --output-register=migration-work/footer-validation/schema-register.json');
      }

      // Elements behavior comparison
      const migratedBehaviorExists = fs.existsSync(path.join(wr, VALIDATION_DIR, 'migrated-footer-elements-mapping.json'));
      const behaviorRegExists = fs.existsSync(path.join(wr, ELEMENTS_BEHAVIOR_REGISTER));
      if (migratedBehaviorExists && !behaviorRegExists && ctx.basename !== 'migrated-footer-elements-mapping.json') {
        blocks.push('migrated-footer-elements-mapping.json exists but compare-footer-elements-behavior.js has NOT been run.\n  → Run NOW: node migration-work/footer-validation/scripts/compare-footer-elements-behavior.js <source-mapping> <migrated-mapping> --output=migration-work/footer-validation/footer-elements-behavior-register.json');
      }

      // Appearance comparison
      const srcAppearanceExists = fs.existsSync(path.join(wr, APPEARANCE_MAPPING));
      const migratedAppearanceExists = fs.existsSync(path.join(wr, MIGRATED_FOOTER_APPEARANCE_MAPPING));
      const appearanceRegExists = fs.existsSync(path.join(wr, APPEARANCE_REGISTER));
      if (srcAppearanceExists && migratedAppearanceExists && !appearanceRegExists && ctx.basename !== 'migrated-footer-appearance-mapping.json') {
        blocks.push('migrated-footer-appearance-mapping.json exists but compare-footer-appearance.js has NOT been run.\n  → Run NOW: node migration-work/footer-validation/scripts/compare-footer-appearance.js <source> <migrated> --output=migration-work/footer-validation/footer-appearance-register.json');
      }

      // Appearance mapping + layoutSpacing required before footer.css (padding/margin parity mandate)
      if (isFooterCssFile(ctx.filePath)) {
        const r = checkFooterAppearanceMappingBeforeImplementation(wr);
        if (!r.pass) blocks.push(r.message);
      }

      // Missing content register
      const mcResult = checkMissingContentRegister(wr);
      if (mcResult.errors.length > 0) {
        blocks.push('missing-content-register.json has unresolved omissions.\n  → ' + mcResult.errors[0]);
      }

      // Mobile missing content
      if (fs.existsSync(path.join(wr, PHASE_4_MOBILE))) {
        const mobileMcResult = checkMobileMissingContentRegister(wr);
        if (mobileMcResult.errors.length > 0) {
          blocks.push('[MOBILE] mobile/missing-content-register.json has unresolved items.');
        }
      }

      // Mobile structure detection (programmatic) — before migrated mobile structural summary
      const mobileStructDetJsonExists = fs.existsSync(path.join(wr, MOBILE_FOOTER_STRUCTURE_DETECTION));
      const mobileStructDetComplete = fs.existsSync(path.join(wr, MOBILE_STRUCTURE_DETECTION_MARKER));
      if (mobileStructDetJsonExists && !mobileStructDetComplete) {
        blocks.push('[MOBILE] mobile-footer-structure-detection.json exists but detect-footer-mobile-sections.js has NOT been run.\n  → Run: node migration-work/footer-validation/scripts/detect-footer-mobile-sections.js --url=<source-url> --validation-dir=migration-work/footer-validation');
      }
      if (ctx.basename === 'mobile-footer-structure-detection.json' && !mobileStructDetComplete) {
        blocks.push('[MOBILE] Do NOT write mobile-footer-structure-detection.json manually. Run detect-footer-mobile-sections.js first.');
      }
      const mobileMigStructExists = fs.existsSync(path.join(wr, MIGRATED_MOBILE_STRUCTURAL_SUMMARY));
      if (mobileMigStructExists && !mobileStructDetComplete) {
        blocks.push('[MOBILE] migrated-mobile-structural-summary.json requires mobile structure detection first.\n  → Run: node migration-work/footer-validation/scripts/detect-footer-mobile-sections.js --url=<source-url> --validation-dir=migration-work/footer-validation');
      }
      if (ctx.basename === 'migrated-mobile-structural-summary.json' && !mobileStructDetComplete) {
        blocks.push('[MOBILE] Run detect-footer-mobile-sections.js before writing migrated-mobile-structural-summary.json.');
      }

      // Mobile structural schema compare
      const mobileSchemaRegExists = fs.existsSync(path.join(wr, MOBILE_SCHEMA_REGISTER));
      if (mobileMigStructExists && !mobileSchemaRegExists && ctx.basename !== 'migrated-mobile-structural-summary.json') {
        blocks.push('[MOBILE] migrated-mobile-structural-summary.json exists but compare-footer-mobile-structural-schema.js has NOT been run.\n  → Run: node migration-work/footer-validation/scripts/compare-footer-mobile-structural-schema.js migration-work/footer-validation/mobile/mobile-footer-structure-detection.json migration-work/footer-validation/mobile/migrated-mobile-structural-summary.json --threshold=100 --output-register=migration-work/footer-validation/mobile/mobile-schema-register.json');
      }

      // Mobile behavior compare
      const mobileMigBehaviorExists = fs.existsSync(path.join(wr, MIGRATED_MOBILE_BEHAVIOR_MAPPING));
      const mobileBehaviorRegExists = fs.existsSync(path.join(wr, MOBILE_BEHAVIOR_REGISTER));
      if (mobileMigBehaviorExists && !mobileBehaviorRegExists && ctx.basename !== 'migrated-mobile-behavior-mapping.json') {
        blocks.push('[MOBILE] migrated-mobile-behavior-mapping.json exists but compare-footer-mobile-behavior.js has NOT been run.\n  → Run: node migration-work/footer-validation/scripts/compare-footer-mobile-behavior.js migration-work/footer-validation/phase-4-mobile.json migration-work/footer-validation/mobile/migrated-mobile-behavior-mapping.json --output=migration-work/footer-validation/mobile/mobile-behavior-register.json');
      }

      if (blocks.length > 0) {
        return { pass: false, message: `🚫 [Footer Gate] BLOCKED — ${blocks.length} mandatory step(s) skipped:\n\n` + blocks.map((b, i) => `${i + 1}. ${b}`).join('\n\n') };
      }
      return { pass: true };
    },
  },

  // Gate DESKTOP_COMPLETE: block phase-4 until desktop done
  {
    id: 'DESKTOP_COMPLETE',
    when: (ctx) => ctx.basename === 'phase-4-mobile.json',
    severity: 'block',
    check: (ctx) => {
      const result = checkDesktopComplete(ctx.workspaceRoot);
      if (!result.pass) {
        return { pass: false, message: `🚫 [Footer Gate] Cannot start mobile phase while desktop is INCOMPLETE.\n\n${result.message}` };
      }
      return { pass: true };
    },
  },

  // Gate HARDCODED_CONTENT: warn if footer.js has hardcoded content
  {
    id: 'HARDCODED_CONTENT',
    when: (ctx) => isFooterJsFile(ctx.filePath),
    severity: 'warn',
    check: (ctx) => {
      try {
        const js = fs.readFileSync(ctx.filePath, 'utf8');
        const warnings = [];
        const innerHTML = (js.match(/\.innerHTML\s*=\s*`[^`]{80,}/g) || []);
        if (innerHTML.length > 0) warnings.push(`${innerHTML.length} large innerHTML template literal(s) — footer content should come from DOM.`);
        const hardcodedLinks = (js.match(/href\s*[:=]\s*['"][^'"]*https?:\/\/[^'"]+['"]/g) || []);
        if (hardcodedLinks.length > 3) warnings.push(`${hardcodedLinks.length} hardcoded href URLs — link destinations should be in footer content.`);
        const countryArray = (js.match(/\[\s*['"](?:Germany|France|Spain|United States|Brazil)[^\]]{0,200}\]/gi) || []);
        if (countryArray.length > 0) warnings.push(`Hardcoded country name arrays — locale content MUST be in footer.plain.html.`);
        if (warnings.length > 0) {
          return { pass: false, message: `⚠️ [Footer Gate] WARNING — footer.js may contain hardcoded content:\n\n${warnings.join('\n')}\n\nContent-first rule: ALL text, links, and locale data belong in content/footer.plain.html.` };
        }
        return { pass: true };
      } catch { return { pass: true }; }
    },
  },
];
