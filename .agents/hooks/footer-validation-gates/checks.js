/**
 * Check functions for footer-validation-gate.
 * Pure functions that return errors/blocks; no side effects.
 */

import fs from 'fs';
import path from 'path';
import {
  VALIDATION_DIR,
  SCHEMA_REGISTER,
  ELEMENTS_BEHAVIOR_REGISTER,
  APPEARANCE_REGISTER,
  APPEARANCE_MAPPING,
  MIGRATED_FOOTER_APPEARANCE_MAPPING,
  MOBILE_SCHEMA_REGISTER,
  MOBILE_BEHAVIOR_REGISTER,
  PHASE_4_MOBILE,
  MISSING_CONTENT_REGISTER,
  MOBILE_MISSING_CONTENT_REGISTER,
  IMAGE_AUDIT_MARKER,
  IMAGE_AUDIT_REPORT,
  IMAGE_PATTERN,
  IMG_TAG_PATTERN,
  loadJson,
  getFooterFilePath,
} from './helpers.js';

/** Desktop validation complete (structural + behavior + appearance when source mapping exists — requires migrated mapping + register; matches compare-footer-appearance.js inputs). */
export function checkDesktopComplete(workspaceRoot) {
  const wr = workspaceRoot;
  const schemaReg = loadJson(path.join(wr, SCHEMA_REGISTER));
  if (!schemaReg) {
    return {
      pass: false,
      message: 'schema-register.json is missing. Run compare-footer-structural-schema.js (desktop validation) before Phase 4 (mobile).',
    };
  }
  if (!schemaReg.allValidated) {
    const validated = (schemaReg.items || []).filter((c) => c.status === 'validated').length;
    const total = (schemaReg.items || []).length;
    return {
      pass: false,
      message: `schema-register: ${validated}/${total} validated. Fix sections, re-run compare-footer-structural-schema.js until allValidated: true.`,
    };
  }

  const behaviorReg = loadJson(path.join(wr, ELEMENTS_BEHAVIOR_REGISTER));
  if (!behaviorReg) {
    return {
      pass: false,
      message: 'footer-elements-behavior-register.json is missing. Run compare-footer-elements-behavior.js before Phase 4 (mobile).',
    };
  }
  if (!behaviorReg.allValidated) {
    const validated = (behaviorReg.items || []).filter((i) => i.status === 'validated').length;
    const total = (behaviorReg.items || []).length;
    return {
      pass: false,
      message: `footer-elements-behavior-register: ${validated}/${total} validated. Fix failed items, re-run compare-footer-elements-behavior.js.`,
    };
  }

  const appearanceMappingPath = path.join(wr, APPEARANCE_MAPPING);
  const migratedAppearancePath = path.join(wr, MIGRATED_FOOTER_APPEARANCE_MAPPING);
  const srcAppearanceExists = fs.existsSync(appearanceMappingPath);
  const migratedAppearanceExists = fs.existsSync(migratedAppearancePath);
  if (srcAppearanceExists) {
    const parity = checkMandatoryAppearanceParityBlocks(wr);
    if (!parity.pass) {
      return {
        pass: false,
        message: `${parity.message}\n\nUpdate footer-appearance-mapping.json (phase-driven blocks) before desktop validation can complete.`,
      };
    }
  }
  if (!srcAppearanceExists && migratedAppearanceExists) {
    return {
      pass: false,
      message:
        'migrated-footer-appearance-mapping.json exists but footer-appearance-mapping.json (source) is missing. Source mapping is required (Phase 2, before footer.css). Restore or create it, then run compare-footer-appearance.js before Phase 4 (mobile).',
    };
  }
  if (srcAppearanceExists) {
    if (!migratedAppearanceExists) {
      return {
        pass: false,
        message:
          'footer-appearance-mapping.json (source) exists but migrated-footer-appearance-mapping.json is missing. Observe the migrated footer, create the migrated mapping, then run compare-footer-appearance.js before Phase 4 (mobile).',
      };
    }
    const appearanceReg = loadJson(path.join(wr, APPEARANCE_REGISTER));
    if (!appearanceReg) {
      return {
        pass: false,
        message: 'footer-appearance-register.json is missing. Run compare-footer-appearance.js (source vs migrated) before Phase 4 (mobile).',
      };
    }
    if (!appearanceReg.allValidated) {
      return { pass: false, message: 'footer-appearance-register is INCOMPLETE. Run compare-footer-appearance.js until allValidated: true.' };
    }
  }

  return { pass: true };
}

const LAYOUT_SPACING_REQUIRED_KEYS = [
  'footerPaddingTop',
  'footerPaddingBottom',
  'contentInsetInline',
  'columnGapApprox',
  'majorBandGapApprox',
];

/** Tall image-heavy band in phase-1 (hero / lineup strip) — requires promoMediaBand in appearance mapping. */
const PROMO_SECTION_MIN_HEIGHT_PX = 280;
const PROMO_MAX_IMAGE_NODES = 12;

/** Large footer nav — requires primaryLinkBand in appearance mapping. */
const PRIMARY_LINK_MIN_TOTAL_LINKS = 15;
const PRIMARY_LINK_MIN_COLUMNS_IN_PHASE2 = 3;

const LEAD_CAPTURE_REQUIRED_KEYS = [
  'inputSurface',
  'labelTreatment',
  'primaryButtonAlignment',
  'fieldLayoutDesktop',
];

const PROMO_MEDIA_REQUIRED_KEYS = [
  'containerHeightPx',
  'mediaWidthBehavior',
  'objectFit',
  'domBandPosition',
];

const PRIMARY_LINK_REQUIRED_KEYS = [
  'desktopLinkLayoutPattern',
  'desktopVisibleLinkColumnsApprox',
];

/**
 * Phase-1 heuristic: one section is a tall band dominated by a small number of images (not an icon row).
 */
export function requiresPromoMediaBandFromPhase1(p1) {
  if (!p1?.sections?.length) return false;
  return p1.sections.some((s) => {
    const h = Number(s.heightPx) || 0;
    if (h < PROMO_SECTION_MIN_HEIGHT_PX) return false;
    if (!s.hasImages) return false;
    const imgN = s.imageCount ?? 1;
    if (imgN < 1 || imgN > PROMO_MAX_IMAGE_NODES) return false;
    const lc = s.linkCount ?? 0;
    if (lc > 30) return false;
    return true;
  });
}

/**
 * Phase-2 preferred: linkColumns length; else phase-1/2 section linkCount.
 */
export function requiresPrimaryLinkBandFromPhases(p1, p2) {
  if (p2?.sections?.length) {
    const hitP2 = p2.sections.some((s) => {
      const cols = Array.isArray(s.linkColumns) ? s.linkColumns.length : 0;
      const lc = s.linkCount ?? 0;
      return cols >= PRIMARY_LINK_MIN_COLUMNS_IN_PHASE2 || lc >= PRIMARY_LINK_MIN_TOTAL_LINKS;
    });
    if (hitP2) return true;
  }
  if (p1?.sections?.length) {
    return p1.sections.some((s) => (s.linkCount ?? 0) >= PRIMARY_LINK_MIN_TOTAL_LINKS);
  }
  return false;
}

/** Inline multi-field form in footer (phase-2). */
export function requiresLeadCaptureBandFromPhase2(p2) {
  if (!p2?.sections?.length) return false;
  return p2.sections.some((s) => s.hasForm === true && s.formType === 'inline-form');
}

/**
 * When phase-1/phase-2 patterns match, footer-appearance-mapping.json MUST include the corresponding
 * optional blocks (hook-enforced — same rules as compare-footer-appearance.js once migrated mapping exists).
 */
export function checkMandatoryAppearanceParityBlocks(workspaceRoot) {
  const mappingPath = path.join(workspaceRoot, APPEARANCE_MAPPING);
  if (!fs.existsSync(mappingPath)) return { pass: true };
  const mapping = loadJson(mappingPath);
  if (!mapping || typeof mapping !== 'object') return { pass: true };

  const p1Path = path.join(workspaceRoot, VALIDATION_DIR, 'phase-1-section-detection.json');
  const p2Path = path.join(workspaceRoot, VALIDATION_DIR, 'phase-2-section-mapping.json');
  const p1 = fs.existsSync(p1Path) ? loadJson(p1Path) : null;
  const p2 = fs.existsSync(p2Path) ? loadJson(p2Path) : null;

  const wantPromo = Boolean(p1 && requiresPromoMediaBandFromPhase1(p1));
  const wantPrimary = Boolean((p1 || p2) && requiresPrimaryLinkBandFromPhases(p1, p2));
  const wantLead = Boolean(p2 && requiresLeadCaptureBandFromPhase2(p2));

  const issues = [];

  if (wantPromo) {
    const b = mapping.promoMediaBand;
    if (!b || typeof b !== 'object' || b.present !== true) {
      issues.push(
        'promoMediaBand with present: true is REQUIRED — phase-1 includes a tall image-heavy footer band. ' +
          'Add promoMediaBand: containerHeightPx, mediaWidthBehavior, objectFit, domBandPosition (measured on source).',
      );
    } else {
      for (const k of PROMO_MEDIA_REQUIRED_KEYS) {
        const v = b[k];
        if (v === undefined || v === null || (typeof v === 'string' && !String(v).trim())) {
          issues.push(`promoMediaBand.${k} is required when promoMediaBand.present is true.`);
        }
      }
    }
  }

  if (wantPrimary) {
    const b = mapping.primaryLinkBand;
    if (!b || typeof b !== 'object' || b.present !== true) {
      issues.push(
        'primaryLinkBand with present: true is REQUIRED — phase data indicates a large footer link/nav band. ' +
          'Add primaryLinkBand: desktopLinkLayoutPattern, desktopVisibleLinkColumnsApprox (count parallel link stacks at desktop).',
      );
    } else {
      for (const k of PRIMARY_LINK_REQUIRED_KEYS) {
        const v = b[k];
        if (v === undefined || v === null || (typeof v === 'string' && !String(v).trim())) {
          issues.push(`primaryLinkBand.${k} is required when primaryLinkBand.present is true.`);
        }
      }
    }
  }

  if (wantLead) {
    const b = mapping.leadCaptureBand;
    if (!b || typeof b !== 'object') {
      issues.push(
        'leadCaptureBand is REQUIRED — phase-2 has an inline form (formType: inline-form). ' +
          'Document inputSurface, labelTreatment, primaryButtonAlignment, fieldLayoutDesktop.',
      );
    } else {
      for (const k of LEAD_CAPTURE_REQUIRED_KEYS) {
        const v = b[k];
        if (v === undefined || v === null || (typeof v === 'string' && !String(v).trim())) {
          issues.push(`leadCaptureBand.${k} is required when the footer has an inline lead-capture form.`);
        }
      }
    }
  }

  if (issues.length > 0) {
    return {
      pass: false,
      message:
        '🚫 [Footer Gate] footer-appearance-mapping.json — mandatory appearance parity (phase-driven):\n\n' +
        issues.map((x, i) => `  ${i + 1}. ${x}`).join('\n'),
    };
  }
  return { pass: true };
}

/** Check footer-appearance-mapping.json (source) exists before writing footer.css. */
export function checkFooterAppearanceMappingBeforeImplementation(workspaceRoot) {
  const p2Exists = fs.existsSync(path.join(workspaceRoot, VALIDATION_DIR, 'phase-2-section-mapping.json'));
  const mappingPath = path.join(workspaceRoot, APPEARANCE_MAPPING);
  const mappingExists = fs.existsSync(mappingPath);
  if (p2Exists && !mappingExists) {
    return {
      pass: false,
      message: 'footer-appearance-mapping.json (source) is REQUIRED before writing footer.css.\n\nCreate it in Phase 2: observe the source footer — background (solid/gradient/image/video), border-top, shadow, sticky behavior, section dividers, per-section backgrounds. This ensures the correct CSS template is used.',
    };
  }
  if (mappingExists) {
    const reg = loadJson(mappingPath);
    const ls = reg?.layoutSpacing;
    if (!ls || typeof ls !== 'object') {
      return {
        pass: false,
        message:
          'footer-appearance-mapping.json must include layoutSpacing (padding/margin parity).\n\n' +
          'In Phase 2b, measure the **source** footer with Playwright getComputedStyle: footer root padding-top/bottom, main content horizontal inset, approximate column gap, approximate vertical gap between major bands. Record normalized px strings (e.g. 48px). compare-footer-appearance.js validates migrated matches source.',
      };
    }
    for (const k of LAYOUT_SPACING_REQUIRED_KEYS) {
      if (!String(ls[k] ?? '').trim()) {
        return {
          pass: false,
          message: `footer-appearance-mapping.json layoutSpacing.${k} is required (non-empty px string from source measurements) before footer.css.`,
        };
      }
    }
    const parity = checkMandatoryAppearanceParityBlocks(workspaceRoot);
    if (!parity.pass) return parity;
  }
  return { pass: true };
}

/** Missing content register — desktop. */
export function checkMissingContentRegister(workspaceRoot) {
  const errors = [];
  const regPath = path.join(workspaceRoot, MISSING_CONTENT_REGISTER);
  if (!fs.existsSync(regPath)) return { errors, remediation: [] };
  const reg = loadJson(regPath);
  if (!reg) return { errors, remediation: [] };
  const items = reg.items || [];
  const unresolved = items.filter(i => !i.resolved);
  if (unresolved.length === 0) return { errors, remediation: [] };
  for (const item of unresolved) {
    errors.push(`Missing content: "${item.description || 'content'}" at "${item.location || 'unknown'}" — add to footer file, then set resolved: true.`);
  }
  return { errors, remediation: [`Add ${unresolved.length} missing item(s) to content/footer.plain.html, set resolved: true, re-run validate-footer-content.js.`] };
}

/** Missing content register — mobile. */
export function checkMobileMissingContentRegister(workspaceRoot) {
  const errors = [];
  if (!fs.existsSync(path.join(workspaceRoot, PHASE_4_MOBILE))) return { errors, remediation: [] };
  const regPath = path.join(workspaceRoot, MOBILE_MISSING_CONTENT_REGISTER);
  if (!fs.existsSync(regPath)) return { errors, remediation: [] };
  const reg = loadJson(regPath);
  if (!reg) return { errors, remediation: [] };
  const unresolved = (reg.items || []).filter(i => !i.resolved);
  if (unresolved.length === 0) return { errors, remediation: [] };
  for (const item of unresolved) {
    errors.push(`[MOBILE] Missing content: "${item.description}" at "${item.location}" — add to footer file, then set resolved: true.`);
  }
  return { errors, remediation: [`[MOBILE] Add ${unresolved.length} missing item(s).`] };
}

/** Footer content file location: must be content/footer.plain.html. */
export function checkFooterContentLocation(filePath, workspaceRoot) {
  const base = path.basename(filePath);
  if (base !== 'footer.plain.html') return null;
  const parentDir = path.basename(path.dirname(filePath));
  if (parentDir !== 'content') {
    return `footer.plain.html written to wrong location — must be in content/. Rewrite to content/footer.plain.html.`;
  }
  return null;
}

/** Check footer content has images when phases require them. */
export function checkFooterContentForImages(filePath, workspaceRoot) {
  const base = path.basename(filePath);
  if (base !== 'footer.plain.html') return null;
  const p2 = loadJson(path.join(workspaceRoot, VALIDATION_DIR, 'phase-2-section-mapping.json'));
  if (!p2?.sections) return null;
  const requireImages = p2.sections.filter(s => s.hasImages || s.hasSocialIcons || s.hasBrandLogos);
  if (requireImages.length === 0) return null;
  let content = '';
  try { if (fs.existsSync(filePath)) content = fs.readFileSync(filePath, 'utf-8'); } catch { return null; }
  if (!content) return null;
  if (IMAGE_PATTERN.test(content) || IMG_TAG_PATTERN.test(content)) return null;
  return `footer content has NO image references, but phases require images for ${requireImages.length} section(s).\n` +
    'Download images to content/images/, reference in footer file (markdown or HTML <img>).';
}

/** Section count parity: phase-2 must have at least as many sections as phase-1. */
export function checkSectionCountParity(workspaceRoot) {
  const p1 = loadJson(path.join(workspaceRoot, VALIDATION_DIR, 'phase-1-section-detection.json'));
  const p2 = loadJson(path.join(workspaceRoot, VALIDATION_DIR, 'phase-2-section-mapping.json'));
  if (!p1 || !p2) return null;
  const required = p1.sectionCount ?? 0;
  const actual = (p2.sections || []).length;
  if (actual < required) {
    return `phase-2-section-mapping.json has ${actual} section(s) but phase-1 requires ${required}. Implement ALL footer sections.`;
  }
  return null;
}

/** Height sanity: phase-1 heightMismatch blocks. */
export function checkFooterHeightSanity(workspaceRoot) {
  const p1 = loadJson(path.join(workspaceRoot, VALIDATION_DIR, 'phase-1-section-detection.json'));
  if (p1?.heightMismatch) {
    return `phase-1-section-detection.json reports heightMismatch: footer total (${p1.footerTotalHeight ?? '?'}px) is >1.3× detected sections (${p1.detectedSectionsHeight ?? '?'}px). Likely missed section.`;
  }
  return null;
}

/** Image audit check. */
export function checkImageAudit(workspaceRoot) {
  const footerFile = getFooterFilePath(workspaceRoot);
  if (!footerFile) return null;
  const markerPath = path.join(workspaceRoot, IMAGE_AUDIT_MARKER);
  if (!fs.existsSync(markerPath)) {
    return `content/footer.plain.html exists but audit-footer-images.js has NOT been run.\n  → Run: node migration-work/footer-validation/scripts/audit-footer-images.js content/footer.plain.html migration-work/footer-validation`;
  }
  const reportPath = path.join(workspaceRoot, IMAGE_AUDIT_REPORT);
  if (fs.existsSync(reportPath)) {
    const report = loadJson(reportPath);
    if (report?.passed === false) {
      return `image-audit-report.json FAILED: expected ${report.expectedCount}, actual ${report.actualCount}. Fix missing images, re-run.`;
    }
  }
  return null;
}

/** Schema register check. */
export function checkSchemaRegister(workspaceRoot) {
  const errors = [];
  const reg = loadJson(path.join(workspaceRoot, SCHEMA_REGISTER));
  if (!reg) { errors.push('schema-register.json does not exist.'); return { errors, remediation: [] }; }
  if (!reg.allValidated) errors.push('schema-register.json allValidated=false.');
  for (const it of (reg.items || [])) {
    if (it.status !== 'validated') errors.push(`Schema: "${it.id}" status="${it.status}".`);
  }
  return { errors, remediation: [] };
}

/** Elements behavior register check. */
export function checkElementsBehaviorRegister(workspaceRoot) {
  const errors = [];
  const reg = loadJson(path.join(workspaceRoot, ELEMENTS_BEHAVIOR_REGISTER));
  if (!reg) { errors.push('footer-elements-behavior-register.json does not exist.'); return { errors, remediation: [] }; }
  if (!reg.allValidated) errors.push('footer-elements-behavior-register.json allValidated=false.');
  for (const item of (reg.items || [])) {
    if (item.status === 'failed') {
      const fixes = [];
      if (!item.hoverMatch?.matches) fixes.push(`hover: ${item.hoverMatch?.sourceEffect || 'mismatch'}`);
      if (!item.clickMatch?.matches) fixes.push(`click: ${item.clickMatch?.sourceAction || 'mismatch'}`);
      errors.push(`Element behavior: "${item.id}" failed: ${fixes.join(', ')}.`);
    }
  }
  return { errors, remediation: [] };
}

/** Shortcut note detection — validated items with notes describing mismatches. */
function isShortcutNote(note) {
  if (!note || typeof note !== 'string') return false;
  return /not included|not in (eds|migrated)|migrated (does not|uses|has) |source has .+ (but|;) migrated|different (structure|layout)|instead of|rather than/i.test(note);
}

export function checkElementsBehaviorRegisterShortcutNotes(workspaceRoot) {
  const shortcutItems = [];
  const reg = loadJson(path.join(workspaceRoot, ELEMENTS_BEHAVIOR_REGISTER));
  if (!reg) return { pass: true, shortcutItems: [] };
  for (const item of (reg.items || [])) {
    if (item.status === 'validated') {
      const note = item.hoverMatch?.note || item.clickMatch?.note || item.note;
      if (isShortcutNote(note)) shortcutItems.push({ id: item.id, label: item.label, note });
    }
  }
  return { pass: shortcutItems.length === 0, shortcutItems };
}

export function checkMobileBehaviorRegisterShortcutNotes(workspaceRoot) {
  const shortcutItems = [];
  if (!fs.existsSync(path.join(workspaceRoot, PHASE_4_MOBILE))) return { pass: true, shortcutItems: [] };
  const reg = loadJson(path.join(workspaceRoot, MOBILE_BEHAVIOR_REGISTER));
  if (!reg) return { pass: true, shortcutItems: [] };
  for (const item of (reg.items || [])) {
    if (item.status === 'validated') {
      const note = item.note;
      if (isShortcutNote(note)) shortcutItems.push({ id: item.id, label: item.label || '', note });
    }
  }
  return { pass: shortcutItems.length === 0, shortcutItems };
}

/** Mobile registers check. */
export function checkMobileRegisters(workspaceRoot) {
  const errors = [];
  if (!fs.existsSync(path.join(workspaceRoot, PHASE_4_MOBILE))) return { errors, remediation: [] };
  if (!fs.existsSync(path.join(workspaceRoot, MOBILE_SCHEMA_REGISTER))) {
    errors.push('mobile-schema-register.json does NOT exist.');
  } else {
    const reg = loadJson(path.join(workspaceRoot, MOBILE_SCHEMA_REGISTER));
    if (!reg?.allValidated) errors.push('mobile-schema-register.json allValidated=false.');
  }
  if (!fs.existsSync(path.join(workspaceRoot, MOBILE_BEHAVIOR_REGISTER))) {
    errors.push('mobile-behavior-register.json does NOT exist.');
  } else {
    const reg = loadJson(path.join(workspaceRoot, MOBILE_BEHAVIOR_REGISTER));
    if (!reg?.allValidated) errors.push('mobile-behavior-register.json allValidated=false.');
  }
  return { errors, remediation: [] };
}

/** Phase-2 section mapping: required fields for each section. */
export function checkPhase2RequiredFields(workspaceRoot, filePath) {
  const p2 = loadJson(filePath);
  if (!p2?.sections) return { pass: true };
  for (const s of p2.sections) {
    if (s.hasForm === undefined) {
      return { pass: false, message: `phase-2-section-mapping.json section ${s.index} missing hasForm field. Check if source has newsletter form, contact form, etc.` };
    }
    if (s.hasSocialIcons === undefined) {
      return { pass: false, message: `phase-2-section-mapping.json section ${s.index} missing hasSocialIcons field.` };
    }
    if (s.hasLocaleSelector === undefined) {
      return { pass: false, message: `phase-2-section-mapping.json section ${s.index} missing hasLocaleSelector field.` };
    }
    if (s.hasLocaleSelector && (!s.localeSelectorDetails || !s.localeSelectorDetails.selectorType)) {
      return { pass: false, message: `section ${s.index} has locale selector but localeSelectorDetails is incomplete. Extract all options, flags, and links.` };
    }
    if (s.hasForm && s.formType === undefined) {
      return { pass: false, message: `section ${s.index} has a form but formType is missing. Set formType: "cta-link" or "inline-form".` };
    }
  }
  return { pass: true };
}
