# Carousel Block Consolidation: card-carousel-onedirection Removed

**Date:** March 19, 2026
**Change Type:** Block consolidation and cleanup
**Impact:** Sections 5 and 8 of the migrated page

---

## Summary

The `card-carousel-onedirection` block was removed and consolidated into the existing `card-carousel-bidirectional` block. A new `few-slides` CSS variant was introduced to handle carousels with 3 or fewer items, making the separate block unnecessary.

---

## Page Sections (Final State)

| # | Section Name | Layout | Blocks | Notes |
|---|-------------|--------|--------|-------|
| 1 | Page Title | Single column | Default content | H1 heading |
| 2 | Hero Banner - Delivery Promise | Single column | **Hero** | Skinny banner with bg image, heading, subheading, CTA |
| 3 | Weekly Musts Category Cards | Single column | **Cards** | 6 circular category images in grid |
| 4 | 1-Hour Delivery Category Cards | Single column | **Cards** | 6 category cards grid |
| 5 | Spring Cleaning | Two-column (hero + carousel) | **Hero** + **Card-carousel-bidirectional** | 19 product cards, shows ~3 cards at tablet / ~4 at desktop |
| 6 | Spring Flowers Banner | Single column | **Hero** | `light-grey` section style |
| 7 | Allergy Relief & Essentials | Single column | **Cards** | 5 multi-size category tiles |
| 8 | University FanCards | Two-column (hero + carousel) | **Hero** + **Card-carousel-bidirectional** | 3 gift cards, `few-slides` variant shows ~2 cards |
| 9 | Terms & Conditions | Single column | Default content | Legal text |

---

## Block Inventory (Final State)

| Block | Instances | Variant | Description |
|-------|-----------|---------|-------------|
| **hero** | 4 | — | Full-width banners with bg image, overlay, heading, subheading, CTA |
| **cards** | 3 | — | Responsive grid of category cards |
| **card-carousel-bidirectional** | 2 | Default (19 items) | Scrollable carousel with prev/next nav, ~3-4 visible cards |
| **card-carousel-bidirectional** | — | `few-slides` (3 or fewer items) | Same carousel with wider cards (~2 visible) |
| **card** | — | — | Shared card component used by both cards and carousel blocks |

---

## Variant: `few-slides`

**Trigger:** Automatically applied when carousel has 3 or fewer slides.

**Behavior:** The JS adds class `few-slides` to the block element. CSS overrides `grid-auto-columns` from the default responsive values to `45%` at all breakpoints, showing approximately 2 cards at a time instead of 3-4.

| Breakpoint | Default Cards Visible | Few-Slides Cards Visible |
|------------|----------------------|--------------------------|
| Mobile (<600px) | ~2 (45%) | ~2 (45%) |
| Tablet (>=600px) | ~3 (31%) | ~2 (45%) |
| Desktop (>=900px) | ~4 (23%) | ~2 (45%) |

---

## Files Changed

### Removed

| File | Description |
|------|-------------|
| `blocks/card-carousel-onedirection/card-carousel-onedirection.js` | Block decoration JS (139 lines) |
| `blocks/card-carousel-onedirection/card-carousel-onedirection.css` | Block styles (113 lines) |
| `blocks/card-carousel-onedirection/card-carousel-onedirection-tokens.css` | CSS custom properties |
| `blocks/card-carousel-onedirection/_card-carousel-onedirection.json` | Block metadata |
| `tools/importer/parsers/card-carousel-onedirection.js` | Import parser for onedirection carousel |

### Modified — Block Code

| File | Change |
|------|--------|
| `blocks/card-carousel-bidirectional/card-carousel-bidirectional.js` | Added `few-slides` class logic when slide count <= 3; replaced `requestAnimationFrame` with `ResizeObserver` for reliable button visibility |
| `blocks/card-carousel-bidirectional/card-carousel-bidirectional.css` | Added `.few-slides` modifier CSS at base, tablet (600px), and desktop (900px) breakpoints — sets `grid-auto-columns: 45%` |

### Modified — Global Styles

| File | Change |
|------|--------|
| `styles/styles.css` | Removed 4 duplicate `card-carousel-onedirection` selectors from two-column layout rules (lines 386-412) |

### Modified — Content

| File | Change |
|------|--------|
| `content/index.plain.html` | Changed section 8 block class from `card-carousel-onedirection` to `card-carousel-bidirectional` |

### Modified — Import Infrastructure

| File | Change |
|------|--------|
| `tools/importer/import-get-it-fast.js` | Removed onedirection parser import and registry entry; remapped FanCards selector to `card-carousel-bidirectional` |
| `tools/importer/import-get-it-fast.bundle.js` | Regenerated bundle (esbuild) — no onedirection references |
| `tools/importer/page-templates.json` | Changed block name from `card-carousel-onedirection` to `card-carousel-bidirectional` in blocks array and section-8 |
| `tools/importer/reports/index.report.json` | Updated block list to reflect both carousels as `card-carousel-bidirectional` |

### Modified — Documentation

| File | Change |
|------|--------|
| `migration-document/migration-summary.md` | Updated block types, section mapping, file listings, and added Fix 5 describing the consolidation |

---

## Parsers (Final State)

| Parser | File | Registered Name |
|--------|------|-----------------|
| Hero | `tools/importer/parsers/hero.js` | `hero` |
| Cards | `tools/importer/parsers/cards.js` | `cards` |
| Card Carousel Bidirectional | `tools/importer/parsers/card-carousel-bidirectional.js` | `card-carousel-bidirectional` |

---

## Transformers (Unchanged)

| Transformer | File | Hook |
|-------------|------|------|
| Walmart Cleanup | `tools/importer/transformers/walmart-cleanup.js` | `beforeTransform` |
| Walmart Sections | `tools/importer/transformers/walmart-sections.js` | `afterTransform` |

---

## Verification

- Zero references to `card-carousel-onedirection` in: `content/`, `blocks/`, `styles/`, `scripts/`, `tools/importer/`
- Only historical mentions remain in `migration-document/migration-summary.md` (Fix 5 changelog)
- Page renders correctly at preview with both carousels working
- Section 5 carousel: 19 cards, ~3 visible, bidirectional nav buttons
- Section 8 carousel: 3 cards, ~2 visible (`few-slides`), bidirectional nav buttons
