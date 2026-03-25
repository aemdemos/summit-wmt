# Footer Migration — Workflow Overview

I'll migrate the footer from the source site to AEM Edge Delivery Services. Here's what will happen:

## Process Overview

| Phase | What Happens |
|-------|-------------|
| **1. Section Detection** | Programmatic scan of the source footer to detect all sections (link groups, social icons, forms, legal text, locale selectors, etc.) |
| **2. Section Mapping** | Deep analysis of each section — every element's hover/click behavior, images, forms, locale options; appearance mapping includes large **promo image bands** and **desktop link-column layout** when present (see `footer-appearance-mapping-schema.json`) |
| **3. Aggregate** | Compile all findings into a complete footer blueprint |
| **4. Content Creation** | Build `content/footer.plain.html` with all text, links, images — content-first architecture |
| **5. Desktop Implementation** | Create `footer.js` + `footer.css` that reads from the content DOM |
| **6. Desktop Validation** | Programmatic comparison: structural schema (100% + strict sections), element behavior, appearance — all must pass |
| **7. Customer Confirmation** | You review the desktop footer before we proceed to mobile |
| **8. Mobile Analysis** | Analyze footer at 375×812 — accordions, stacking, touch targets |
| **9. Mobile Implementation** | Responsive CSS + JS for mobile footer behavior |
| **10. Mobile Validation** | At 375×812: run `detect-footer-mobile-sections.js` on the source URL, extract migrated structure/behavior, run `compare-footer-mobile-structural-schema.js` and `compare-footer-mobile-behavior.js` until both mobile registers pass |
| **11. Final Gates** | Pre-completion check: all registers validated, ESLint clean |

## Key Principles

- **Scripts dependencies:** After copying the skill `scripts/` into `migration-work/footer-validation/scripts/`, run **`npm install`** in that folder once per workspace (Playwright for detection scripts, Ajv for `validate-output.js`).
- **Content-first**: All text, links, images, and locale data live in `footer.plain.html`. `footer.js` only reads from the DOM — never hardcodes content.
- **Validation-first**: Every step is verified programmatically. No self-assessment.
- **Zero hallucination**: Section counts, link counts, and behaviors are measured with Playwright — never guessed from screenshots.
- **100% parity**: We match the source site exactly — hover effects, click behavior, colors, spacing, animations.

## What I Need From You

- The source website URL
- Confirmation after desktop implementation before proceeding to mobile
- Final review and approval

Let's begin!
