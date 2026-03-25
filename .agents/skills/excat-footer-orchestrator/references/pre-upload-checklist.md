# Pre-Upload Checklist — excat-footer-orchestrator

Per `docs/skill-development-guide.md` Section 8.

## Before you start

- [x] Identified 2–3 concrete use cases (footer from URL, validate footer structure, EDS footer build)
- [x] Tools identified (built-in or MCP): Playwright MCP, `validate-output.js`, `validate-footer-content.js`, compare-* scripts
- [x] Reviewed skill development guide and navigation orchestrator (parity reference)
- [x] Planned folder structure: `SKILL.md`, `scripts/`, `references/`, sub-agents (`desktop-footer-agent`, `mobile-footer-agent`, `validation-agent`)

## During development

- [x] Folder name in kebab-case: `excat-footer-orchestrator`
- [x] `SKILL.md` exists (exact spelling)
- [x] YAML frontmatter has `---` delimiters
- [x] `name`: kebab-case, no spaces, no capitals
- [x] `description`: WHAT and WHEN, no XML (no `<` or `>`)
- [x] Instructions clear and actionable
- [x] Error handling included (`references/troubleshooting.md`, hook blocks)
- [x] Examples provided (User says / flow)
- [x] References clearly linked (`reference-index.md`, `validation-artifacts.md`)

## Before upload

- [x] Trigger tests: "Migrate footer", "Build footer from URL", "Footer migration for [URL]"
- [ ] Functional tests: run `node .agents/skills/excat-footer-orchestrator/scripts/validate-output.js <fixture.json> .agents/skills/excat-footer-orchestrator/references/<matching-schema>.json` (or workspace copies) after changing schemas or sub-agent output shapes
- [x] Tool integration: `npm install` in `.agents/skills/excat-footer-orchestrator/scripts/` for Playwright + Ajv
- [ ] Compressed as `.zip` if required by target

## After upload

- [ ] Test in real conversations
- [ ] Monitor over/under-triggering
- [ ] Collect feedback and iterate
- [ ] Update `metadata.version` in `SKILL.md` frontmatter when you change the skill (current 1.3)

## Validation vs docs/skill-development-guide.md

- **Structure:** `SKILL.md`, `references/`, `scripts/` — no `README.md` at skill root (guide: use `SKILL.md` or `references/`).
- **Frontmatter (main + sub-agents):** Main `SKILL.md` has `name`, `description` (WHAT + WHEN, no angle brackets), optional `compatibility` and `metadata`. Sub-agent folders use `SKILL.md` with the same frontmatter pattern (parity with `excat-navigation-orchestrator` sub-agents).
- **Progressive disclosure:** Core flow in `SKILL.md`; deep detail in `references/`; link one level deep via `reference-index.md`.
- **Examples:** SKILL.md includes User says → Actions → Result; avoid brand-specific URLs in examples (use placeholders).
- **Patterns (guide §4 / §6):** Sequential workflow; hooks (`.agents/hooks/footer-validation-gate.js`) for deterministic gates; **bundled scripts** for critical checks (section detection, content validation, image audit, structural/behavior/appearance **including `layoutSpacing` via `compare-footer-appearance.js`**, mobile compares, pre-completion) — matches “prefer bundled scripts over prose-only rules.”
- **Appearance parity:** `footer-appearance-mapping-schema.json` requires **`layoutSpacing`**; hooks block `footer.css` until filled; agents must measure source + migrated with `getComputedStyle` (documented in desktop-footer-agent / validation-agent). Optional blocks **`promoMediaBand`** / **`primaryLinkBand`** gate hero/image-band and desktop nav-column parity when filled on source.
- **Nav parity (intentional differences):** Footer has no megamenu, row-elements register, style registers, component critique, or `mobile-dimensional-gate.js` (nav-specific menu width checks). Footer adds programmatic **mobile source** structure (`detect-footer-mobile-sections.js`) + **mobile behavior compare** (`compare-footer-mobile-behavior.js`).

## Notes

- **`validate-output.js`:** Run after sub-agent writes phase JSON (optional but recommended):  
  `node migration-work/footer-validation/scripts/validate-output.js <file.json> <path-to-schema.json>`  
  Schemas live under the skill `references/*-schema.json` (copy paths into workspace or reference skill bundle).
- **Workflow start message:** `references/workflow-start-message.md` — display before `session.json`; set `workflowStartMessageDisplayed: true` (hook enforces).
- **Avoid plan vs code drift:** Gate behavior is defined in `.agents/hooks/footer-validation-gates/` and `.agents/hooks/footer-validation-gate.js`. Changing rules there requires updating `references/footer-validation-gates-summary.md` (and SKILL or troubleshooting when user-visible). The skill’s `scripts/pre-completion-check.js` is canonical; workspaces must recopy from `.agents/skills/excat-footer-orchestrator/scripts/` when the skill changes.
- **Unchecklistable gap:** Step 7 (customer confirmation before mobile) is prompt-only — hooks enforce technical readiness, not human approval.
