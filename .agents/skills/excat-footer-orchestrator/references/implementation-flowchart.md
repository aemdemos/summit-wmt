# Footer Orchestrator — Implementation Flowchart

End-to-end flow from **session init** through **desktop + mobile validation complete**. Nav orchestrator is the richer reference (megamenu, critique, style registers); this chart matches the **11-step footer** workflow.

```mermaid
flowchart TB
    subgraph START["Run start"]
        S0["Create migration-work/footer-validation/"]
        S1["Copy skill scripts/ → migration-work/footer-validation/scripts/"]
        S2["session.json + workflowStartMessageDisplayed: true"]
    end

    subgraph D1["[DESKTOP] Steps 2–4 — Analysis"]
        P1["detect-footer-sections.js → phase-1 + .section-detection-complete"]
        P2["phase-2-section-mapping.json + appearance + elements mapping"]
        P3["phase-3-aggregate.json"]
    end

    subgraph D2["[DESKTOP] Step 5 — Implement"]
        I1["content/footer.plain.html"]
        I2["validate-footer-content.js → .footer-content-validated"]
        I3["audit-footer-images.js → .image-audit-passed"]
        I4["blocks/footer/footer.js + footer.css"]
    end

    subgraph D3["[DESKTOP] Step 6 — Validate"]
        V1["migrated-structural-summary + compare → schema-register"]
        V2["migrated elements mapping + compare → behavior register"]
        V3["migrated appearance + compare → appearance register"]
    end

    subgraph D4["[DESKTOP] Step 7 — Confirm"]
        C1["Customer confirms desktop"]
    end

    subgraph M1["[MOBILE] Steps 8–9"]
        M0["phase-4-mobile.json"]
        M1a["detect-footer-mobile-sections.js on SOURCE → mobile detection + marker"]
        M2["Responsive footer.css / footer.js"]
    end

    subgraph M2["[MOBILE] Step 10 — Validate"]
        M3["migrated-mobile-structural-summary + compare-mobile-structural → mobile-schema-register"]
        M4["migrated-mobile-behavior-mapping + compare-mobile-behavior → mobile-behavior-register"]
    end

    subgraph END["Step 11 — Final"]
        F1["pre-completion-check.js exit 0"]
        F2["Completion message"]
    end

    START --> D1 --> D2 --> D3 --> D4 --> M1 --> M2 --> END
```

## Optional sub-agent quality gate

After any phase JSON is written from a sub-agent, run:

`node migration-work/footer-validation/scripts/validate-output.js <file.json> <schema.json>`

Use schemas from `references/*-agent-schema.json` (see `reference-index.md`).

---

## Plan revalidation (narrative vs enforcement)

**Verdict:** The original plan — **11 steps**, **desktop-first**, **three desktop compares** (structural, elements behavior, appearance), **programmatic section detection** (desktop + mobile source), **hooks + scripts** as two layers, then **pre-completion** — is still the right shape. Repeated “gaps” in implementation were not from a bad sequence; they came from **(1)** keeping several documents and the hook code in sync when edge cases appeared, and **(2)** limits hooks cannot cover.

**What hooks cannot enforce (by design):**

| Planned item | Why it still “gaps” if ignored |
|--------------|--------------------------------|
| **Step 7 — customer confirmation before mobile** | No API for “user said yes”; only SKILL.md / prompts. Phase 4 is blocked on **technical** desktop completion, not on a human flag. |
| **Sub-agent honesty** | Hooks see files on disk, not whether Playwright was actually used. Mitigation: debug.log script markers + SKILL rules. |
| **Stale `migration-work/footer-validation/scripts/`** | Step 1 copies from the skill; the repo hook bundle under `.agents/hooks/` is canonical for gate logic. Old workspace copies diverge from `.agents/skills/excat-footer-orchestrator/scripts/`. |

**Single source of truth for gate logic:** `.agents/hooks/footer-validation-gates/checks.js`, `gate-table.js`, and `.agents/hooks/footer-validation-gate.js` (Stop). When behavior changes, update in code **and** `references/footer-validation-gates-summary.md` (and SKILL bullets if user-facing text is wrong).

**Appearance (must match `compare-footer-appearance.js`):** Phase 2 produces **source** `footer-appearance-mapping.json` with **required `layoutSpacing`** (px strings) plus optional `leadCaptureBand`, **`promoMediaBand`** (large image strips), **`primaryLinkBand`** (desktop link grid vs accordion), and `noticeStrip`. Desktop validation produces **migrated** mapping + run compare → `footer-appearance-register.json` (includes `layoutSpacingMatch`). `checkDesktopComplete` / Stop / `pre-completion-check.js` require: if source exists → migrated file + register with `allValidated` before Phase 4 / completion; migrated without source is invalid.

**Step → engine map (quick):**

| Steps | Planned outcome | Enforcement |
|-------|-----------------|-------------|
| 2 | Phase 1 + marker | `MANDATORY_SCRIPTS`, Stop |
| 3 | Phase 2 + source appearance + elements (`layoutSpacing` before CSS) | Phase 2 / CSS gates, `checkFooterAppearanceMappingBeforeImplementation` |
| 5 | Content + audit + `footer.js` / `footer.css` | `MANDATORY_SCRIPTS`, image / content gates |
| 6 | Migrated artifacts + 3 compares | `checkDesktopComplete`, Stop, compare nudges in `MANDATORY_SCRIPTS` |
| 8–10 | Phase 4 + mobile detection + compares | `DESKTOP_COMPLETE`, mobile markers + mobile compares in gates |
| 11 | Done | Stop + `pre-completion-check.js` |
