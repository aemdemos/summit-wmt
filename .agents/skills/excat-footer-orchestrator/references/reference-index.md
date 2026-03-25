# Reference Index — Footer Orchestrator

| Category | Files |
|----------|-------|
| **Implementation flowchart** | End-to-end desktop + mobile — `references/implementation-flowchart.md` |
| **Validation artifacts** | Files under `migration-work/footer-validation/` — `references/validation-artifacts.md` |
| **Workflow start message** | First user-facing overview — `references/workflow-start-message.md` (before `session.json`) |
| **Troubleshooting** | Common issues — `references/troubleshooting.md` |
| **Pre-upload checklist** | Skill guide Section 8 — `references/pre-upload-checklist.md` |
| **Gates & hooks summary** | PostToolUse + Stop — `references/footer-validation-gates-summary.md` |
| **Workflow doc (repo, Mermaid)** | Gates, hook stdin/stdout, full pipeline — `docs/main branch - footer orchestrator workflow.md` (Experience Catalyst repo; mirrors nav orchestrator doc style) |
| **Output schema** | `references/output-contract.json` |
| **Sub-agent schemas** | `references/desktop-footer-agent-schema.json`, `references/mobile-footer-agent-schema.json`, `references/validation-agent-schema.json` |
| **Structural summary (migrated)** | `references/structural-summary-schema.json` |
| **Footer elements mapping** | `references/footer-elements-mapping-schema.json` |
| **Footer appearance mapping** | `references/footer-appearance-mapping-schema.json` (required `layoutSpacing` for padding/margin parity; optional `leadCaptureBand`, `promoMediaBand`, `primaryLinkBand`, `noticeStrip`) |
| **Missing content** | `references/missing-content-register-schema.json` |
| **Mobile behavior mapping (migrated)** | `references/migrated-mobile-behavior-mapping-schema.json` |
| **Programmatic section detection (desktop)** | `scripts/detect-footer-sections.js` — Phase 1; writes `phase-1-section-detection.json` + `.section-detection-complete` |
| **Programmatic structure detection (mobile source)** | `scripts/detect-footer-mobile-sections.js` — once `phase-4-mobile.json` exists, run **before** `mobile/migrated-mobile-structural-summary.json`; source URL at 375×812; writes `mobile/mobile-footer-structure-detection.json` + `.mobile-footer-structure-detection-complete` |
| **Content validation** | `scripts/validate-footer-content.js` — after `content/footer.plain.html` writes; `.footer-content-validated` |
| **Image audit** | `scripts/audit-footer-images.js` — after content validation; `.image-audit-passed` |
| **Desktop structural compare** | `scripts/compare-footer-structural-schema.js` — default threshold 100% + `allValidated`; `schema-register.json` |
| **Desktop element behavior** | `scripts/compare-footer-elements-behavior.js` — `footer-elements-behavior-register.json` |
| **Desktop appearance** | `scripts/compare-footer-appearance.js` — `footer-appearance-register.json` (optional blocks compared when either mapping defines them) |
| **Mobile structural compare** | `scripts/compare-footer-mobile-structural-schema.js` — `mobile/mobile-schema-register.json` |
| **Mobile behavior compare** | `scripts/compare-footer-mobile-behavior.js` — `phase-4-mobile.json` vs `mobile/migrated-mobile-behavior-mapping.json` → `mobile/mobile-behavior-register.json` |
| **JSON schema gate (sub-agents)** | `scripts/validate-output.js` — `node validate-output.js <output.json> <schema.json>` (requires `npm install` in `scripts/`) |
| **Pre-completion** | `scripts/pre-completion-check.js` — before completion message |
| **Enforcement** | `.agents/hooks/footer-validation-gate.js` — PostToolUse + Stop; logs to `migration-work/footer-validation/debug.log` |
| **Element handling** | `references/element-handling-guide.md` |
| **Debug log** | `migration-work/footer-validation/debug.log` |
