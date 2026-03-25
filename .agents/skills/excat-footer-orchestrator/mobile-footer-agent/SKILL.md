---
name: mobile-footer-agent
description: Phase 4 mobile footer analysis at 375×812 for AEM EDS. Use when desktop footer is validated, registers pass, and customer confirmed mobile work. Documents stacking, accordions, and mobile-specific behavior. Invoked by excat-footer-orchestrator. Do NOT use before desktop completes or for header migration.
---

# Mobile Footer Agent

Sub-agent for Phase 4: mobile footer analysis and data collection.

## Prerequisites

- Desktop phases 1–3 COMPLETE
- Desktop implementation COMPLETE (footer.js, footer.css, footer.plain.html validated)
- All desktop registers allValidated: true
- Customer confirmation received

## Role

Analyze the source website footer at mobile viewport (375×812) using Playwright MCP. Document how the footer adapts from desktop to mobile.

## Workflow

### Step 1: Mobile Screenshot + Structure Analysis

1. Set Playwright viewport to 375×812
2. Scroll to footer, take full screenshot
3. Document:
   - **Stacking order**: How desktop sections reorder on mobile
   - **Accordion behavior**: Do link columns collapse into accordions?
   - **Form layout change**: Does the form go from horizontal to vertical?
   - **Social icons layout**: Centered? Larger touch targets?
   - **Locale selector**: Same as desktop or different mobile UX?
   - **Video behavior**: Autoplay, poster-only, or hidden?

### Step 2: Accordion Deep Analysis (if applicable)

If footer link columns collapse into accordions on mobile:
1. Click each accordion header — record expand/collapse behavior
2. Record `expandMode`: single (one at a time) or multi
3. Record animation: type, duration, chevron rotation
4. Record which sections collapse and which stay visible

### Step 3: Mobile-Specific Content

Check for content that appears ONLY on mobile:
- Back-to-top button (if mobile-only)
- Additional contact info
- App store badges
- Different social icon set

Add mobile-only content to `content/footer.plain.html` in a mobile-only section.
Record in `mobile/missing-content-register.json` if items need to be added.

### Step 4: Write phase-4-mobile.json

Conform to `references/mobile-footer-agent-schema.json`. **Recommended:** run `validate-output.js` after writing:

```bash
node migration-work/footer-validation/scripts/validate-output.js \
  migration-work/footer-validation/phase-4-mobile.json \
  <path-to-skill>/references/mobile-footer-agent-schema.json
```

Required fields:
- `breakpointPx`, `stackingOrder`, `hasAccordionSections`
- `hasForm`, `formLayoutChange`
- `hasLocaleSelector`, `localeSelectorMobileBehavior`
- `hasSocialIcons`, `socialIconsLayoutChange`
- `hasVideo`, `videoMobileBehavior`
- `columnStackingDetails`

## Output

- `phase-4-mobile.json`
- `mobile/missing-content-register.json` (if mobile has extra content)
- Mobile screenshots in validation directory

## Zero-Hallucination Rules

- Test EVERY accordion section by clicking
- Do not assume mobile layout from desktop — always verify with Playwright at 375×812
- Record actual animation durations from CSS inspection
