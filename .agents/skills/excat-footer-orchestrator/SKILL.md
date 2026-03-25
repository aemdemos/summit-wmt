---
name: excat-footer-orchestrator
description: Orchestrates AEM EDS footer migration via desktop, mobile, and validation sub-agents. Use when migrating footer, validating footer structure, or building footer from source site. Programmatic section detection, per-element hover/click behavior mapping, appearance comparison, and content-first implementation. Invoke for "migrate footer", "build footer from URL", "create EDS footer", "footer migration for URL". Do NOT use for header/nav migration (use excat-navigation-orchestrator), simple copyright-only footers, or when page is not yet migrated (use excat-site-migration first).
compatibility: "Claude Code / Experience Catalyst plugin. Requires Playwright MCP for real pointer events; Node/npm where validation scripts run (copy skill scripts/ into migration-work/footer-validation/scripts/; npm install there for Playwright + Ajv)."
metadata:
  version: "1.3"
  category: migration
  tags: footer, aem, eds, validation
---

# Footer Orchestrator

**Skill identity:** When the user asks which skill or workflow you are using, respond: **"Footer Orchestrator (validation-first footer migration)."** Do not list sub-agents or internal architecture.

**Mandatory flow:** Desktop first, then mobile after confirmation. Complete Phases 1–3 (desktop analysis), aggregate, then implement **desktop only** with full styling and all footer elements. **STOP and request customer confirmation** that desktop is acceptable. Only after confirmation, run Phase 4 (mobile) and implement mobile view. Do NOT implement until the relevant aggregate is written; do NOT proceed to mobile without customer confirmation.

**Step gating:** Do not move to the next phase until the current phase JSON is produced and written. Do not implement until the desktop aggregate is written. Do not run Phase 4 or mobile implementation until the customer has confirmed desktop is acceptable.

**Interaction method (CRITICAL):** For ALL click and hover testing (links, social icons, locale selectors, forms, back-to-top), use **Playwright MCP's click/hover** — NOT JavaScript `element.click()` or `element.dispatchEvent()`. JavaScript click often fails to trigger handlers that listen for real pointer events.

## Input Contract

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sourceUrl | string | yes | URL of the source website |
| migratedPath | string | no | Local preview path (default: localhost:3000) |

## Architecture: Content-First

```
content/footer.plain.html  →  footer.js (reads DOM, renders)  →  footer.css (styles)
```

**CRITICAL RULE**: ALL content (text, links, images, locale entries, form labels) MUST live in `footer.plain.html`. `footer.js` MUST read from the footer DOM — NEVER hardcode content in JavaScript. The hook blocks hardcoded content.

## Prerequisites

- Migrated site available at `http://localhost:3000{migratedPath}.html` (or create migratedPath as needed).
- Browser/Playwright MCP available for screenshots and DOM inspection.
- For validation phase: Playwright MCP available for per-element hover/click testing and comparison.

## Validation Infrastructure

All validation artifacts go in `migration-work/footer-validation/` which is **auto-gitignored** when `session.json` is created. Scripts, registers, phase files, and debug.log live here. See `references/validation-artifacts.md` for full directory structure.

Hooks enforce every step programmatically — see `references/footer-validation-gates-summary.md`.

**Execution flow — first message (MANDATORY):** When footer orchestration starts, **read and output `references/workflow-start-message.md`** before writing `session.json` or running Step 1. When you write `session.json`, set **`workflowStartMessageDisplayed: true`** (only after displaying that message). The hook blocks `session.json` if the flag is missing or false — same contract as the navigation orchestrator.

**Reference map (progressive disclosure):** For a single index of schemas, scripts, and artifacts, see **`references/reference-index.md`**. Deeper checklists: **`references/implementation-flowchart.md`**, **`references/troubleshooting.md`**, **`references/pre-upload-checklist.md`** (aligns with `docs/skill-development-guide.md` Section 8). **Repo docs (gates + Mermaid flowcharts, same style as nav):** `docs/main branch - footer orchestrator workflow.md` in the Experience Catalyst repository.

## Zero-Hallucination Rules

**Do not skip validation steps.** Take your time with each phase; the hook blocks until prerequisites are met. Skipping steps causes rework.

1. **Never fabricate** section counts, link counts, or image paths — use `detect-footer-sections.js`
2. **Never guess** hover/click behavior — test every element with Playwright
3. **Never self-assess** similarity — run comparison scripts
4. **Never skip** a step — hooks enforce sequential execution
5. **Never hardcode** content in `footer.js` — hook warns on hardcoded patterns
6. **Never write** phase-1 manually — the detection script produces it
7. **Never write** `mobile-footer-structure-detection.json` manually — use `detect-footer-mobile-sections.js`
8. **Never start** mobile before desktop validation passes — hook blocks
9. **If source has content missing from footer file:** STOP. Write `missing-content-register.json`, add the content, set `resolved: true`, re-run validate-footer-content.js. Do NOT proceed with a note that content was omitted.
10. **If uncertainty > 20%:** Request clarification; do not proceed.

## Do NOT

- Suggest UX improvements, redesign layout, simplify sections, or normalize spacing without validation.
- Write `footer.plain.html` to root — must be `content/footer.plain.html`.
- Create `footer.plain.html` or footer implementation before the desktop aggregate is written.
- Proceed to Phase 4 (mobile) before customer confirms desktop.
- Skip any phase (1–3) or skip writing phase JSON.
- Deliver desktop with raw unstyled markup — full styling required.
- Assume elements have no hover — test hover and click separately for every element.
- Proceed while any register is pending or structural compare is below threshold / not allValidated.
- Call missing images "simplification" — if source has images, footer.plain.html MUST have them.
- Hardcode country names, flag URLs, or locale data in footer.js — ALL belongs in `footer.plain.html`.
- Use pipe-delimited or custom formats for images — use `<img src="images/filename.ext" alt="...">`.
- Create site-specific function names — ALL functions in footer.js must be generic and reusable.
- Let mobile-only content affect desktop — hide on desktop, show only in `@media` for mobile.

## User Communication (MANDATORY — announce EVERY step)

The user must ALWAYS know which step you are currently executing. At the START of each step, output a clear status banner:

```
━━━ [DESKTOP] Step 2/11: Section Detection (programmatic) ━━━
```
```
━━━ [DESKTOP] Step 5/11: Implementation — footer.plain.html + footer.js + footer.css ━━━
```
```
━━━ [MOBILE] Step 8/11: Mobile Analysis — accordion + stacking + touch targets ━━━
```

Use `[DESKTOP]` for steps 1–7, `[MOBILE]` for steps 8–10, `[FINAL]` for step 11. When a step COMPLETES:
```
✅ [DESKTOP] Step 6 COMPLETE: Desktop validation — all 3 registers allValidated: true
```
```
🚫 [DESKTOP] Step 6 BLOCKED: Structural compare failed — similarity or per-section strict match. Fixing...
```

## Debug Logging (MANDATORY)

The debug log at `migration-work/footer-validation/debug.log` is the ONLY way to verify what happened during a run. After running each script, **read the last 20 lines of debug.log** to confirm the entry appeared:
- After `detect-footer-sections.js` — confirm `[SCRIPT:detect-footer-sections]` entry
- After `validate-footer-content.js` — confirm `[SCRIPT:validate-footer-content]` entry
- After `audit-footer-images.js` — confirm `[SCRIPT:audit-footer-images]` entry
- After each compare script — confirm its `[SCRIPT:compare-footer-*]` entry (including `compare-footer-mobile-structural-schema`, `compare-footer-mobile-behavior`)
- After `detect-footer-mobile-sections.js` — confirm `[SCRIPT:detect-footer-mobile-sections]`
- Before announcing completion — confirm `[SCRIPT:pre-completion-check] [PASS]`

If a script log entry is MISSING, the script was NOT actually executed. Go back and run it.

---

## Workflow: 11 Steps

### Step 1: Initialize Session

1. Read and display `references/workflow-start-message.md` to the user
2. Create `migration-work/footer-validation/` directory and copy scripts from skill `scripts/` directory into `migration-work/footer-validation/scripts/` (includes `package.json` — run **`npm install`** inside `migration-work/footer-validation/scripts/` so Playwright + Ajv work for detection and `validate-output.js`)
3. Create `migration-work/footer-validation/session.json`:
   ```json
   { "sourceUrl": "...", "migratedPath": "...", "startedAt": "...", "workflowStartMessageDisplayed": true }
   ```
   The hook auto-appends `migration-work/footer-validation/` to `.gitignore`. The hook **blocks** session.json if `workflowStartMessageDisplayed` is missing or false.

### Step 2: Desktop Analysis — Phase 1 (Programmatic Section Detection)

**MANDATORY — run detect-footer-sections.js first.** Never set sectionCount from screenshot alone. The gate **BLOCKS** phase-1 and phase-2 until the script has run.

```bash
node migration-work/footer-validation/scripts/detect-footer-sections.js --url=<source-url> --validation-dir=migration-work/footer-validation
# If a consent layer hides the footer, add e.g. --cookie-selector='#site-cookie-accept'
```

The script writes `phase-1-section-detection.json` and `.section-detection-complete`. **Do NOT write phase-1 manually** — the script produces it.

**Verify:** Read last 20 lines of `debug.log`. Confirm `[SCRIPT:detect-footer-sections] [PASS]`. If missing, re-run the script.

If `heightMismatch: true`, re-examine the footer for missed sections.

### Step 3: Desktop Analysis — Phase 2 (Section Mapping)

Invoke `desktop-footer-agent` sub-agent. For EACH section:

1. **Screenshot** the section with Playwright
2. **Hover** every interactive element — record effect (color-change, underline, opacity, scale)
3. **Click** every interactive element — record behavior (navigate, open-dropdown, scroll-to-top)
4. Identify section type and required fields

Per section, the following fields are **MANDATORY** (hook-enforced):
- `hasForm` + `formType` (`cta-link` | `inline-form` | `none`)
- `hasSocialIcons` + details
- `hasLocaleSelector` + `localeSelectorDetails` (extract ALL options and flags)
- `hasVideo`, `hasBrandLogos`, `hasBackToTop`
- `elements[]` with per-element `hoverBehavior` and `clickBehavior`

Also create:
- `footer-appearance-mapping.json` — background, border, shadow, sticky, section dividers; **required** `layoutSpacing` (px strings from source `getComputedStyle` for padding/margin parity); **optional** `leadCaptureBand`, **`promoMediaBand`** (large image / hero strip inside footer), **`primaryLinkBand`** (desktop multi-column vs accordion nav), `noticeStrip` when those patterns exist (see schema). The hook **BLOCKS** `footer.css` until this file exists **and** `layoutSpacing` is filled.
- `footer-elements-mapping.json` — all interactive elements with unique IDs

See `references/element-handling-guide.md` for detailed handling per element type.

### Step 4: Desktop Analysis — Phase 3 (Aggregate)

Write `phase-3-aggregate.json` compiling all findings: section count, total links, images, forms, locale, social icons, video, confidence, notes. Do not implement until this file exists.

### Step 5: Desktop Implementation

**Sequential implementation (do NOT parallelize):** Do NOT use parallel agents or concurrent writes to `footer.plain.html` / `footer.js` / `footer.css` or phase JSON. Work step-by-step:

**Safe to run in parallel (read-only):** After artifacts exist, you may run multiple `validate-output.js` invocations or other read-only checks concurrently; hooks still enforce phase order and register completeness.

1. **Image download (CRITICAL — #1 failure mode):** Read phase-2 sections. For each element with `hasImages`, `hasSocialIcons`, `hasBrandLogos`, or locale flags: visit the source URL, identify image URLs from the DOM, download EVERY image to `content/images/`. Use relative paths only (e.g. `images/icon.svg`, not `/content/images/icon.svg`).
2. **Write** `content/footer.plain.html` with ALL content from phases.
3. **Run content validation (MANDATORY — exit 0 required):**
   ```bash
   node migration-work/footer-validation/scripts/validate-footer-content.js content/footer.plain.html migration-work/footer-validation
   ```
   **Verify:** Read `debug.log`, confirm `[SCRIPT:validate-footer-content] [PASS]`. Fix and re-run until exit 0.
4. **Run image audit (MANDATORY — exit 0 required):**
   ```bash
   node migration-work/footer-validation/scripts/audit-footer-images.js content/footer.plain.html migration-work/footer-validation
   ```
   **Verify:** Read `debug.log`, confirm `[SCRIPT:audit-footer-images] [PASS]`. The hook **BLOCKS** until `.image-audit-passed` exists.
5. **Write** `blocks/footer/footer.js` — reads from DOM, renders sections. NEVER hardcode content.
6. **Write** `blocks/footer/footer.css` — matches source appearance exactly. Extract exact styles from source. No raw unstyled markup.

**Missing content:** If source has content not yet in `footer.plain.html`, STOP. Write `missing-content-register.json` with the omission (`location`, `description`, `resolved: false`). Add the content, set `resolved: true`, re-run validate-footer-content.js. The hook **BLOCKS** until all items are resolved.

### Step 6: Desktop Validation

Invoke `validation-agent` sub-agent. Three comparison scripts must ALL pass:

1. **Structural**: Extract `migrated-structural-summary.json` from the migrated page. Run:
   ```bash
   node migration-work/footer-validation/scripts/compare-footer-structural-schema.js \
     migration-work/footer-validation/phase-1-section-detection.json \
     migration-work/footer-validation/phase-2-section-mapping.json \
     migration-work/footer-validation/migrated-structural-summary.json \
     --threshold=100 --output-register=migration-work/footer-validation/schema-register.json
   ```
2. **Behavior**: Extract `migrated-footer-elements-mapping.json` by hovering+clicking every element on the **migrated** page (NOT from code). Run:
   ```bash
   node migration-work/footer-validation/scripts/compare-footer-elements-behavior.js \
     migration-work/footer-validation/footer-elements-mapping.json \
     migration-work/footer-validation/migrated-footer-elements-mapping.json \
     --output=migration-work/footer-validation/footer-elements-behavior-register.json
   ```
3. **Appearance**: Extract `migrated-footer-appearance-mapping.json`. Run:
   ```bash
   node migration-work/footer-validation/scripts/compare-footer-appearance.js \
     migration-work/footer-validation/footer-appearance-mapping.json \
     migration-work/footer-validation/migrated-footer-appearance-mapping.json \
     --output=migration-work/footer-validation/footer-appearance-register.json
   ```

**Verify logging** after each script. All three registers must have `allValidated: true`. If not, fix implementation and re-run. The hook blocks Stop if any register is incomplete.

**Remediation:** For each failed item: fix footer.js/footer.css/footer.plain.html → re-extract migrated mapping → re-run comparison → repeat until `allValidated: true`.

### Step 7: Customer Confirmation

Before asking, verify: all 3 desktop registers `allValidated: true`, all markers exist (`.section-detection-complete`, `.footer-content-validated`, `.image-audit-passed`), `missing-content-register.json` all resolved. Review WORKFLOW PROGRESS DASHBOARD in `debug.log`.

Present desktop footer to user. Show side-by-side screenshots (source vs migrated), including **any tall promo/hero image band** and **lead form + link grid** called out in `promoMediaBand` / `primaryLinkBand` / `leadCaptureBand` when present. Request: **"Desktop footer validation complete. Please confirm to proceed to mobile."**

### Step 8: Mobile Analysis — Phase 4

Invoke `mobile-footer-agent` sub-agent at 375×812 viewport. Analyze: section stacking order, accordion collapse behavior, form layout changes, locale selector mobile behavior, social icons layout, video behavior, back-to-top button, mobile-only content.

Write `phase-4-mobile.json`. The hook blocks this file until desktop validation is complete.

**Programmatic source baseline (mobile viewport):** Before any `mobile/migrated-mobile-structural-summary.json`, run detection on the **source** URL:

```bash
node migration-work/footer-validation/scripts/detect-footer-mobile-sections.js --url=<source-url> --validation-dir=migration-work/footer-validation
```

This writes `mobile/mobile-footer-structure-detection.json` and `.mobile-footer-structure-detection-complete`. **Do not** author the detection JSON manually — the gate blocks it.

**Verify:** `debug.log` must show `[SCRIPT:detect-footer-mobile-sections] [PASS]`.

**Mobile-only content:** If mobile has items not on desktop, add to `footer.plain.html` in a mobile-only section (hidden on desktop with `display: none`, shown only in `@media` for mobile). Record in `mobile/missing-content-register.json`.

### Step 9: Mobile Implementation

1. Add responsive CSS in `footer.css` using `@media` queries
2. Add mobile behavior in `footer.js` (accordion toggle, touch handling)
3. Mobile-only content must NOT affect desktop — hide with CSS by default

### Step 10: Mobile Validation

Invoke `validation-agent` sub-agent. At **375×812**:

1. **Structural:** Ensure `detect-footer-mobile-sections.js` has run (marker present). Extract `mobile/migrated-mobile-structural-summary.json`. Run:
   ```bash
   node migration-work/footer-validation/scripts/compare-footer-mobile-structural-schema.js \
     migration-work/footer-validation/mobile/mobile-footer-structure-detection.json \
     migration-work/footer-validation/mobile/migrated-mobile-structural-summary.json \
     --threshold=100 \
     --output-register=migration-work/footer-validation/mobile/mobile-schema-register.json
   ```
2. **Behavior:** Extract `mobile/migrated-mobile-behavior-mapping.json` (see `references/migrated-mobile-behavior-mapping-schema.json`). Run:
   ```bash
   node migration-work/footer-validation/scripts/compare-footer-mobile-behavior.js \
     migration-work/footer-validation/phase-4-mobile.json \
     migration-work/footer-validation/mobile/migrated-mobile-behavior-mapping.json \
     --output=migration-work/footer-validation/mobile/mobile-behavior-register.json
   ```
3. **Verify logging** in `debug.log` for both compare scripts. Both mobile registers must have `allValidated: true`.

### Step 11: Final Gates + Completion

1. **Run pre-completion check (MANDATORY — do NOT skip):**
   ```bash
   node migration-work/footer-validation/scripts/pre-completion-check.js
   ```
   - **If exit code 1:** Do NOT send completion message. Show: **"Doing a final validation..."** and continue fixing. Re-run until exit 0.
   - **If exit code 0:** Only then proceed.
2. **Review** `debug.log` — confirm ALL milestones show ✅ in the WORKFLOW PROGRESS DASHBOARD.
3. Display completion message:

> Footer migration complete! ✅
>
> **Built**: `content/footer.plain.html`, `blocks/footer/footer.js`, `blocks/footer/footer.css`
>
> **Validated**: [X] sections, [Y] interactive elements, [Z] images — structural compare at 100% + `allValidated`; behavior + appearance registers pass.
>
> **Mobile**: Responsive at 375px with [accordion/stacking/etc.] behavior.

---

## Enforcement (Two Layers — Script + Hook)

- **Layer 1 — Scripts:** Deterministic validation (content, images, desktop + mobile structural/behavior compares, appearance comparison, pre-completion). Exit non-zero = do not proceed.
- **Layer 2 — Hook:** `.agents/hooks/footer-validation-gate.js` — PostToolUse gates + Stop checks covering desktop + mobile. Logs to `migration-work/footer-validation/debug.log` with WORKFLOW PROGRESS DASHBOARD.

## Sub-Agents

| Agent | Role | When |
|-------|------|------|
| `desktop-footer-agent` | Phase 1–3 analysis at 1440×900 | Steps 2–4 |
| `mobile-footer-agent` | Phase 4 analysis at 375×812 | Step 8 |
| `validation-agent` | Structural + behavior + appearance comparison | Steps 6, 10 |

## Scripts Reference

| Script | Purpose | Mandatory |
|--------|---------|-----------|
| `detect-footer-sections.js` | Phase 1 programmatic detection | Yes — before phase-1 |
| `validate-footer-content.js` | Content validation (images, structure) | Yes — after content write |
| `audit-footer-images.js` | Image audit (expected vs actual) | Yes — after content validation |
| `compare-footer-structural-schema.js` | Structural similarity 100% + per-section strict (`allValidated`) | Yes — desktop validation |
| `compare-footer-elements-behavior.js` | Per-element hover/click match | Yes — desktop validation |
| `compare-footer-appearance.js` | Appearance + **`layoutSpacing`** (padding/margins) + optional `leadCaptureBand`, `promoMediaBand`, `primaryLinkBand`, `noticeStrip` | Yes — desktop validation |
| `detect-footer-mobile-sections.js` | Source footer structure at 375×812 | Yes — before mobile migrated structural summary |
| `compare-footer-mobile-structural-schema.js` | Mobile structural 100% + `allValidated` | Yes — mobile validation |
| `compare-footer-mobile-behavior.js` | Mobile behavior vs phase-4-mobile.json | Yes — mobile validation |
| `validate-output.js` | Ajv validate sub-agent JSON vs schema | Recommended — after each phase/mapping JSON |
| `pre-completion-check.js` | Final gate (registers + ESLint on `blocks/footer/footer.js` only) | Yes — before completion |

## Examples

**User says:** "Migrate the footer from https://example.com"
→ **Actions:** Initialize session (workflow start message + `session.json`) → run `detect-footer-sections.js` → invoke desktop-footer-agent for phase-2/appearance/elements → phase-3 aggregate → implement `footer.plain.html` + `footer.js` + `footer.css` with validation scripts → invoke validation-agent → customer confirmation → mobile phases → pre-completion.
→ **Result:** Footer block and content validated against source; registers `allValidated`; `debug.log` shows each script PASS.

**User says:** "Our EDS preview footer does not match the live site — fix validation"
→ **Actions:** Open `migration-work/footer-validation/` registers and `debug.log` → identify failing compare → re-extract migrated mappings from preview with Playwright MCP → fix implementation → re-run compare scripts until hooks pass.
→ **Result:** `schema-register.json`, behavior register, and appearance register show `allValidated: true` (and mobile equivalents when phase-4 exists).

## Troubleshooting

Short table below; full list: **`references/troubleshooting.md`**.

| Problem | Cause | Fix |
|---------|-------|-----|
| Hook blocks phase-2 | detect-footer-sections.js not run | Run the detection script first |
| Hook blocks footer.css | Missing appearance mapping or incomplete `layoutSpacing` | Phase 2b: full mapping + measured `layoutSpacing` before `footer.css` |
| Structural / validation fails | Missing sections, wrong order/types, or count mismatches | Check phase-1 heightMismatch; align migrated summary order + `type` with phase-2 |
| Image audit fails | Images not downloaded to disk | Download to `content/images/`, reference in footer file |
| Pre-completion fails | Register not allValidated | Re-run comparison scripts after fixes |
| Script log entry missing | Script was not actually executed | Go back and run it; verify in debug.log |
| Sub-agent JSON invalid | Schema mismatch | Run `validate-output.js` against the matching `references/*-schema.json` |

## Testing

**Trigger (use this skill):** "Migrate footer from https://example.com", "Build footer from this site", "Create EDS footer", "Footer migration for [URL]".
**Paraphrased:** "We need the site footer migrated", "Can you replicate this site's footer in EDS?".
**Do NOT use for:** Header/nav migration (use excat-navigation-orchestrator); pages not yet migrated; simple copyright text without complex footer.

## Output Contract

See `references/output-contract.json` for the final output schema.

## References

**Index:** `references/reference-index.md` — all schemas, scripts, and runtime paths in one table.

**Key schemas:** `references/desktop-footer-agent-schema.json`, `references/mobile-footer-agent-schema.json`, `references/structural-summary-schema.json`, `references/footer-elements-mapping-schema.json`, `references/footer-appearance-mapping-schema.json`, `references/migrated-mobile-behavior-mapping-schema.json`, `references/validation-agent-schema.json`.

**Key docs:** `references/element-handling-guide.md`, `references/validation-artifacts.md`, `references/footer-validation-gates-summary.md`, `references/workflow-start-message.md`, `references/implementation-flowchart.md` (includes **plan vs enforcement** — why gaps happen and what hooks cannot check), `references/troubleshooting.md`, `references/pre-upload-checklist.md` (maps to repository `docs/skill-development-guide.md` Section 8).
