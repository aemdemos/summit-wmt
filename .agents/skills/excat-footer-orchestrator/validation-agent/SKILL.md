---
name: footer-validation-agent
description: Desktop and mobile footer validation using structural, behavior, and appearance compare scripts plus Playwright MCP for migrated mappings. Use when excat-footer-orchestrator needs registers after implementation. Produces schema-register and related JSON. Do NOT use for navigation or header validation workflows.
---

# Footer Validation Agent

Sub-agent for desktop and mobile validation: structural comparison, behavior comparison, and appearance comparison.

## Role

Compare the migrated footer against the source footer using programmatic scripts and Playwright MCP. Produce validation registers that gate workflow progress.

## Desktop Validation Workflow

### Step 1: Structural Comparison

1. Extract `migrated-structural-summary.json` from the migrated page (same schema as phase-1/2)
2. Run comparison script:
   ```bash
   node migration-work/footer-validation/scripts/compare-footer-structural-schema.js \
     migration-work/footer-validation/phase-1-section-detection.json \
     migration-work/footer-validation/phase-2-section-mapping.json \
     migration-work/footer-validation/migrated-structural-summary.json \
     --threshold=100 \
     --output-register=migration-work/footer-validation/schema-register.json
   ```
3. If the compare fails (similarity below threshold or any section not `validated`), fix implementation and re-run. Extract `migrated-structural-summary.json` with sections in **the same top-to-bottom order** as phase-2 and **matching `type`** strings per index.

### Step 2: Elements Behavior Comparison

1. Extract `migrated-footer-elements-mapping.json` by hovering+clicking every element on the migrated footer
2. Run comparison:
   ```bash
   node migration-work/footer-validation/scripts/compare-footer-elements-behavior.js \
     migration-work/footer-validation/footer-elements-mapping.json \
     migration-work/footer-validation/migrated-footer-elements-mapping.json \
     --output=migration-work/footer-validation/footer-elements-behavior-register.json
   ```
3. Fix failed elements until allValidated: true

### Step 3: Appearance Comparison

1. Extract `migrated-footer-appearance-mapping.json` from migrated page. Mirror the **source** mapping for all required fields, including **`layoutSpacing`**: re-run the same `getComputedStyle` measurements on the **migrated** footer root and content wrapper so each px string matches source (adjust `footer.css` until `compare-footer-appearance.js` passes). Optional blocks (`leadCaptureBand`, `noticeStrip`, **`promoMediaBand`**, **`primaryLinkBand`**): if the source defines a block, migrated must define it too with matching fields (except `notes`). If the source omits a block, omit it on migrated (omitted on both sides = compare skips that block).
2. Run comparison:
   ```bash
   node migration-work/footer-validation/scripts/compare-footer-appearance.js \
     migration-work/footer-validation/footer-appearance-mapping.json \
     migration-work/footer-validation/migrated-footer-appearance-mapping.json \
     --output=migration-work/footer-validation/footer-appearance-register.json
   ```
3. Fix mismatches until allValidated: true

## Mobile Validation Workflow

At **375×812** viewport. Confirm `debug.log` after each script.

### Step 4: Mobile structural comparison

1. Run **source** detection (if not already done):
   ```bash
   node migration-work/footer-validation/scripts/detect-footer-mobile-sections.js \
     --url=<source-url> \
     --validation-dir=migration-work/footer-validation
   ```
   Produces `mobile/mobile-footer-structure-detection.json` and `.mobile-footer-structure-detection-complete`.

2. Extract `mobile/migrated-mobile-structural-summary.json` from the **migrated** page.

3. Run:
   ```bash
   node migration-work/footer-validation/scripts/compare-footer-mobile-structural-schema.js \
     migration-work/footer-validation/mobile/mobile-footer-structure-detection.json \
     migration-work/footer-validation/mobile/migrated-mobile-structural-summary.json \
     --threshold=100 \
     --output-register=migration-work/footer-validation/mobile/mobile-schema-register.json
   ```

### Step 5: Mobile behavior comparison

1. Extract `mobile/migrated-mobile-behavior-mapping.json` from the migrated page. Conform to `references/migrated-mobile-behavior-mapping-schema.json` in the footer orchestrator skill.

2. Run:
   ```bash
   node migration-work/footer-validation/scripts/compare-footer-mobile-behavior.js \
     migration-work/footer-validation/phase-4-mobile.json \
     migration-work/footer-validation/mobile/migrated-mobile-behavior-mapping.json \
     --output=migration-work/footer-validation/mobile/mobile-behavior-register.json
   ```

3. Fix mismatches until `mobile-behavior-register.json` has `allValidated: true`.

## Optional: validate extracted JSON (Ajv)

After writing migrated summaries or mappings, you can verify shape before compares:

```bash
node migration-work/footer-validation/scripts/validate-output.js \
  migration-work/footer-validation/migrated-structural-summary.json \
  <path-to-skill>/references/structural-summary-schema.json
```

Use `references/footer-elements-mapping-schema.json` / `references/footer-appearance-mapping-schema.json` for the migrated behavior and appearance files when applicable.

## Remediation Loop

When any register has `allValidated: false`:
1. Read the register's failed items
2. For each failed item, edit `footer.js` / `footer.css` / `footer.plain.html` to match source
3. Re-extract migrated mapping (and re-run mobile detection on source if structural source baseline changed)
4. Re-run comparison script
5. Repeat until allValidated: true

## Output Contract

Conform to `references/validation-agent-schema.json`:
- `status`: PASS or FAIL
- `similarityScore`: 0–1
- Per-aspect match booleans
- `mismatches[]` with descriptions
- `notes[]`
