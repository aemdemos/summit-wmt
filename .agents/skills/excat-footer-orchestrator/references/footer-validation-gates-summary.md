# Footer Validation Gates Summary

**Totals:** **1** hook script (`.agents/hooks/footer-validation-gate.js`) · **12** PostToolUse gates (`POST_TOOL_USE_GATES`) · **1** Stop handler (`handleStop`, many checks in sequence).

The footer validation hook enforces workflow rules through PostToolUse gates and Stop checks.

## PostToolUse Gates (run on every Write/Edit) — 12 total

| Gate ID | Triggers On | Severity | Purpose |
|---------|-------------|----------|---------|
| 1 | Any file | block | Footer content must be in `content/footer.plain.html` |
| WORKFLOW_START_MESSAGE | session.json | block | Start message must be displayed + auto-gitignore |
| SECTION_COUNT_PARITY | phase-2 | block | Phase-2 sections ≥ phase-1 count |
| FOOTER_HEIGHT_SANITY | phase-1/2 | block | Height mismatch detection |
| PHASE2_REQUIRED_FIELDS | phase-2 | block | hasForm, hasSocialIcons, hasLocaleSelector per section |
| APPEARANCE_MAPPING_COMPLETE | `footer-appearance-mapping.json` | block | Same as pre-CSS: **`layoutSpacing`** complete + **`checkMandatoryAppearanceParityBlocks`** (phase-driven `promoMediaBand` / `primaryLinkBand` / `leadCaptureBand`) |
| FOOTER_CONTENT_IMAGES | Any file | block | Images required when phases declare hasImages |
| SHORTCUT_NOTES_BEHAVIOR | behavior register | block | Validated items must not have shortcut notes |
| SHORTCUT_NOTES_MOBILE | mobile behavior | block | Same for mobile |
| MANDATORY_SCRIPTS | footer/validation files | block | Enforce sequential script execution; **before `footer.css`:** source `footer-appearance-mapping.json` must exist, **`layoutSpacing`** complete, and **mandatory appearance parity** vs phase-1/phase-2 (`promoMediaBand`, `primaryLinkBand`, `leadCaptureBand` when heuristics match) |
| DESKTOP_COMPLETE | phase-4 | block | Block mobile until desktop done — **requires** `schema-register.json` and `footer-elements-behavior-register.json` to exist with `allValidated: true`; if `footer-appearance-mapping.json` (source) exists, **migrated** `migrated-footer-appearance-mapping.json` + `footer-appearance-register.json` (`allValidated`) are required before mobile (`checkDesktopComplete`, matches `compare-footer-appearance.js`) |
| HARDCODED_CONTENT | footer.js | warn | Detect hardcoded content in JS |

## Stop Checks (run when session ends)

Runs only when `migration-work/footer-validation/session.json` exists (otherwise hook skips).

All PostToolUse-relevant state plus:
- Section detection script marker (if phase-1 JSON exists)
- Mobile source structure: if `mobile/mobile-footer-structure-detection.json` exists, marker `.mobile-footer-structure-detection-complete` must exist; if `mobile/migrated-mobile-structural-summary.json` exists, same marker required
- `content/footer.plain.html` must exist; validate + image audit markers when footer exists
- Missing content registers resolved (desktop + `mobile/missing-content-register.json` when present)
- `schema-register.json`, `footer-elements-behavior-register.json` must exist and pass checks
- **Appearance:** if `footer-appearance-mapping.json` (source) exists, it must pass **mandatory parity** (`checkMandatoryAppearanceParityBlocks`); then `migrated-footer-appearance-mapping.json` must exist, then `footer-appearance-register.json` with `allValidated: true`; migrated without source is invalid (matches `checkDesktopComplete` + pre-completion)
- Shortcut notes: desktop elements behavior register + **mobile** behavior register (when phase-4 exists) — validated items must not use mismatch “shortcut” notes
- Mobile registers (when `phase-4-mobile.json` exists): `mobile-schema-register.json`, `mobile-behavior-register.json`, `allValidated`
- Pre-completion-check.js (registers + markers + mobile detection marker when applicable + unresolved items in `missing-content-register.json` and `mobile/missing-content-register.json` + ESLint on footer.js and copied scripts)

## Mobile mandatory sequence (MANDATORY_SCRIPTS gate)

When editing footer / validation files:
1. `detect-footer-mobile-sections.js` before `migrated-mobile-structural-summary.json` (marker required)
2. `compare-footer-mobile-structural-schema.js` after migrated mobile structural summary → `mobile-schema-register.json`
3. `compare-footer-mobile-behavior.js` after `migrated-mobile-behavior-mapping.json` → `mobile-behavior-register.json`

## Auto-Gitignore

On `session.json` creation, the hook automatically appends `migration-work/footer-validation/` to `.gitignore`.

## Sub-agent JSON quality (not hook-enforced)

`scripts/validate-output.js` validates phase/mapping JSON against `references/*-schema.json` (Ajv). Run after sub-agent writes; see `references/reference-index.md` and `desktop-footer-agent` / `mobile-footer-agent` SKILL instructions.
