# Footer Validation Artifacts

All validation artifacts are stored in `migration-work/footer-validation/` which is auto-gitignored.

## Directory Structure

```
migration-work/footer-validation/
├── session.json                              # Session state
├── debug.log                                 # Full execution trace
├── .section-detection-complete               # Marker: detect-footer-sections.js ran
├── .footer-content-validated                 # Marker: validate-footer-content.js ran
├── .image-audit-passed                       # Marker: audit-footer-images.js ran
├── phase-1-section-detection.json            # Phase 1: programmatic section detection
├── phase-2-section-mapping.json              # Phase 2: per-section detailed mapping
├── phase-3-aggregate.json                    # Phase 3: compiled findings
├── phase-4-mobile.json                       # Phase 4: mobile analysis
├── footer-appearance-mapping.json            # Source appearance (incl. required layoutSpacing px strings; optional leadCaptureBand, promoMediaBand, primaryLinkBand, noticeStrip)
├── footer-elements-mapping.json              # Source per-element hover/click behavior
├── migrated-structural-summary.json          # Migrated footer structure
├── migrated-footer-elements-mapping.json     # Migrated per-element behavior
├── migrated-footer-appearance-mapping.json   # Migrated appearance (same optional blocks as source when used)
├── schema-register.json                      # Structural comparison result
├── footer-elements-behavior-register.json    # Behavior comparison result
├── footer-appearance-register.json           # Appearance comparison result
├── missing-content-register.json             # Desktop missing content tracker
├── image-audit-report.json                   # Image audit details
├── source-image-manifest.json                # Source footer images (from URL mode)
├── migrated-image-manifest.json              # Migrated footer images
├── scripts/                                  # Copied from skill `scripts/` at session init (run npm install here)
│   ├── package.json                          # playwright + ajv (for detection scripts + validate-output.js)
│   ├── cookie-banner-dismiss.js                  # Consent dismissal (structural + English + CMP heuristic)
│   ├── footer-section-detection-evaluate.js      # Shared browser logic (imported by detection scripts)
│   ├── detect-footer-sections.js
│   ├── detect-footer-mobile-sections.js
│   ├── validate-output.js                    # Ajv: validate phase/mapping JSON vs references/*-schema.json
│   ├── validate-footer-content.js
│   ├── audit-footer-images.js
│   ├── compare-footer-structural-schema.js
│   ├── compare-footer-elements-behavior.js
│   ├── compare-footer-appearance.js
│   ├── compare-footer-mobile-structural-schema.js
│   ├── compare-footer-mobile-behavior.js
│   └── pre-completion-check.js
└── mobile/
    ├── .mobile-footer-structure-detection-complete   # Marker: detect-footer-mobile-sections.js ran
    ├── mobile-footer-structure-detection.json          # Source footer structure at 375×812
    ├── migrated-mobile-structural-summary.json
    ├── migrated-mobile-behavior-mapping.json         # Observed mobile behavior on migrated page
    ├── mobile-schema-register.json
    ├── mobile-behavior-register.json
    └── missing-content-register.json
```

## Register Format

All registers share a common pattern:
```json
{
  "allValidated": true|false,
  "items": [
    { "id": "section-0", "status": "validated"|"pending"|"failed", ... }
  ]
}
```

## Marker Files

Marker files (`.section-detection-complete`, `.mobile-footer-structure-detection-complete`, etc.) prove a script was run successfully.
The hook checks for these markers and blocks progress if they're missing.

## Mobile validation (phase 4+)

Mobile structural parity is **programmatic**, same pattern as desktop:

1. After `phase-4-mobile.json`, run **`detect-footer-mobile-sections.js`** on the **source** URL (375×812). Writes `mobile/mobile-footer-structure-detection.json` and `.mobile-footer-structure-detection-complete`. Do not author the detection JSON manually.

2. Extract **`mobile/migrated-mobile-structural-summary.json`** from the migrated page at **375×812** (Playwright), same shape as desktop structural summary where possible.

3. Run **`compare-footer-mobile-structural-schema.js`** (source detection JSON + migrated summary) → **`mobile/mobile-schema-register.json`** (default threshold 100% + `allValidated`).

4. Extract **`mobile/migrated-mobile-behavior-mapping.json`** from the migrated page; shape is defined in **`references/migrated-mobile-behavior-mapping-schema.json`**.

5. Run **`compare-footer-mobile-behavior.js`** (`phase-4-mobile.json` + migrated behavior mapping) → **`mobile/mobile-behavior-register.json`**.

Hooks enforce: mobile detection marker before `migrated-mobile-structural-summary.json`; structural compare before continuing past migrated structural summary; behavior compare when migrated behavior mapping exists. **`mobile/missing-content-register.json`** must have every item `resolved: true` before Stop when it exists.
