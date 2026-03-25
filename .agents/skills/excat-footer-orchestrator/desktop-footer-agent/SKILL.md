---
name: desktop-footer-agent
description: Phase 1–3 desktop footer analysis for AEM EDS migration. Use when excat-footer-orchestrator invokes desktop mapping after programmatic section detection. Produces phase-2 mapping, appearance mapping, and elements mapping from Playwright. Do NOT use standalone without the footer orchestrator; not for header, navigation, or mobile-only analysis.
---

# Desktop Footer Agent

Sub-agent for Phase 1–3 of footer migration: desktop analysis and data collection.

## Role

Analyze the source website footer at desktop viewport (1440×900) using Playwright MCP. Collect structured data for section detection, element mapping, appearance mapping, and behavior documentation.

## Workflow

### Phase 1: Section Detection (Programmatic)

1. **Run detect-footer-sections.js FIRST** — MANDATORY before any manual analysis
   ```bash
   node migration-work/footer-validation/scripts/detect-footer-sections.js --url=<source-url> --validation-dir=migration-work/footer-validation
   # Optional: `--cookie-selector='<css>'` if the default consent handling does not clear the banner.
   ```
2. Review the script output `phase-1-section-detection.json`
3. If `heightMismatch: true`, re-examine the footer for missed sections

### Phase 2: Section Mapping

For EACH section detected in Phase 1, use Playwright to:
1. **Screenshot** the section
2. **Hover** every interactive element — record hover effects (color-change, underline, opacity, scale)
3. **Click** every interactive element — record click behavior (navigate, open-dropdown, scroll-to-top, submit-form)
4. Identify section **`type`** from this set (use consistently — `compare-footer-structural-schema.js` matches `type` per index against the migrated structural summary): `link-group`, `social-icons`, `legal`, `form`, `brand-logos`, `video`, `locale`, `disclaimer`, `copyright`, `contact-info`, `mixed`, or other semantic lowercase labels you also use when extracting `migrated-structural-summary.json`.

Required fields per section:
- `hasForm` + `formType` (cta-link | inline-form | none) + `formDetails`
- `hasSocialIcons` + `socialIconDetails`
- `hasLocaleSelector` + `localeSelectorDetails` (extract ALL options, flags, and links)
- `hasVideo` + `videoDetails`
- `hasBrandLogos`
- `hasBackToTop`
- `linkColumns` (multi-column link groups)
- `elements[]` with per-element `hoverBehavior` and `clickBehavior`

Write `phase-2-section-mapping.json` conforming to `references/desktop-footer-agent-schema.json`.

### Phase 2b: Footer Appearance Mapping

Observe the source footer's visual properties:
- Background (solid/gradient/image/video/transparent)
- Border-top, shadow, sticky behavior
- Section dividers, per-section backgrounds
- **`layoutSpacing` (required):** Measure padding/margin parity fields on the **live source** with Playwright `page.evaluate` + `getComputedStyle` on the footer root and the primary inner content wrapper (same elements you will re-query on migrated). Normalize to integer **px strings** (e.g. `48px`, not `47.8px`). Fill:
  - `footerPaddingTop` / `footerPaddingBottom` — footer root `paddingTop` / `paddingBottom`
  - `contentInsetInline` — representative horizontal inset for the main content row (e.g. `paddingLeft` on the centered wrapper, or describe max-width + side padding in px)
  - `columnGapApprox` — gap between adjacent primary columns (from computed `gap`, margin between first two column roots, or best measurable proxy)
  - `majorBandGapApprox` — vertical separation between major horizontal bands (measure margin or padding between band boundaries)
  - Optional `notes` for asymmetry, rounded containers, or full-bleed backgrounds with inset content
- **Optional (only if applicable):** `leadCaptureBand` — any prominent multi-field form row (signup, newsletter, contact capture): input surface, label treatment, primary button alignment, **`fieldLayoutDesktop`** (`single-row` | `multi-row` | `stacked`)
- **Optional (only if applicable):** `promoMediaBand` — **MANDATORY when** phase-1 (or DOM) shows a large image-dominant band (hero lineup, campaign strip): measure **`containerHeightPx`**, **`mediaWidthBehavior`**, **`objectFit`** on the primary image, and **`domBandPosition`** vs CTA / lead form
- **Optional (only if applicable):** `primaryLinkBand` — **MANDATORY when** the main footer nav uses multiple parallel link columns and/or accordions: **`desktopLinkLayoutPattern`** and **`desktopVisibleLinkColumnsApprox`** (count parallel vertical link stacks at desktop — e.g. seven static columns vs two-region split must not be conflated)
- **Optional (only if applicable):** `noticeStrip` — distinct legal, certification, or disclaimer block: layout (full-width bar vs inset card vs in-column), background treatment, mark/emblem position

Omit optional objects entirely when the footer does not have that pattern. Write `footer-appearance-mapping.json` conforming to `references/footer-appearance-mapping-schema.json`. The hook **blocks `footer.css`** until `layoutSpacing` is complete (see `footer-validation-gates`).

### Phase 2c: Footer Elements Mapping

For ALL interactive elements across all sections:
- Assign unique IDs (e.g. `section-0-social-instagram`, `section-1-link-col-0-item-3`)
- Record `hoverBehavior` and `clickBehavior` per element

Write `footer-elements-mapping.json` conforming to `references/footer-elements-mapping-schema.json`.

### Phase 3: Aggregate

Compile findings into `phase-3-aggregate.json`:
- Total sections, total links, total images
- Form summary, locale selector summary, social icons summary
- Video summary (if present)
- Confidence and notes

## Locale Selector Deep Extraction

When `hasLocaleSelector: true`:
1. Click the locale trigger on source
2. Screenshot the expanded dropdown/panel
3. Extract EVERY option: label, URL, flag image path
4. Record `entryCount`, `hasFlags`, `flagCount`
5. Download all flag images to `content/images/`

## Schema validation (recommended)

After writing JSON artifacts, verify with Ajv (requires `npm install` in `migration-work/footer-validation/scripts/`):

```bash
node migration-work/footer-validation/scripts/validate-output.js \
  migration-work/footer-validation/phase-1-section-detection.json \
  <path-to-skill>/references/desktop-footer-agent-schema.json
```

Use the same `desktop-footer-agent-schema.json` for `phase-2-section-mapping.json` (schema is a `oneOf` of phase-1 vs phase-2 shapes). For `footer-appearance-mapping.json` and `footer-elements-mapping.json`, use `references/footer-appearance-mapping-schema.json` and `references/footer-elements-mapping-schema.json` respectively. Exit 0 = valid; fix sub-agent output before proceeding if validation fails.

## Output Contract

All JSON files must conform to schemas in `references/`. Use `confidence` (0–1) and `uncertainty` (boolean) fields.

## Zero-Hallucination Rules

- Never fabricate section counts, link counts, or image paths
- Never guess hover/click behavior — test every element with Playwright
- If uncertain, set `uncertainty: true` and add notes
