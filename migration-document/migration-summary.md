# Migration Summary: Walmart "Get It Fast" Page

**Source URL:** https://www.walmart.com/cp/get-it-fast/6545138
**Target Platform:** Adobe Experience Manager Edge Delivery Services (AEM EDS)
**Migration Date:** March 18, 2026
**Status:** Complete

---

## Table of Contents

1. [Overview](#overview)
2. [Phase 1 — Design System Extraction](#phase-1--design-system-extraction)
3. [Phase 2 — Page Analysis & Block Mapping](#phase-2--page-analysis--block-mapping)
4. [Phase 3 — Import Infrastructure](#phase-3--import-infrastructure)
5. [Phase 4 — Block Development](#phase-4--block-development)
6. [Phase 5 — Content Import & Verification](#phase-5--content-import--verification)
7. [Phase 6 — Post-Import Fixes](#phase-6--post-import-fixes)
8. [Files Created & Modified](#files-created--modified)
9. [Known Limitations](#known-limitations)

---

## Overview

The Walmart "Get It Fast" category page was migrated from a static HTML capture (Wayback Machine archive) to AEM Edge Delivery Services. The page features hero banners, category card grids, product carousels, and promotional content arranged across 9 sections.

The migration was performed using the EXCAT (Experience Catalyst) migration framework with custom parsers, transformers, and block implementations.

---

## Phase 1 — Design System Extraction

Extracted Walmart's design tokens from the source page and applied them to the EDS global stylesheet.

### What Was Extracted

| Category | Details |
|----------|---------|
| **Colors** | 13 CSS custom properties — brand blue (`#0053e2`), navy (`#001e60`), yellow (`#ffc220`), red (`#de1c24`), green (`#2a8703`), and semantic tokens |
| **Typography** | Helvetica Neue font stack (fallback for Walmart's proprietary EverydaySans), heading scale from H1 (36px) to H6 (16px) |
| **Buttons** | 3 pill-shaped variants — Primary (blue), Secondary (outlined), Accent (yellow) with `border-radius: 1000px` |
| **Spacing** | 6-step scale from `--spacing-xs` (4px) to `--spacing-xxl` (48px) |
| **Sections** | Light (gray), Dark (navy), and Accent (light blue) background variants |
| **Layout** | 1440px max width, 84px nav height, mobile-first breakpoints at 600/900/1200px |

### Files Modified

- `styles/styles.css` — Full design token replacement (375 lines)
- `styles/fonts.css` — Walmart font stack with EverydaySans preparation (35 lines)

Full design details are documented in `migration-document/design-implementation.md`.

---

## Phase 2 — Page Analysis & Block Mapping

Analyzed the source page to identify content structure, section boundaries, and block types.

### Section-to-Block Mapping

| # | Section | Block Type | Notes |
|---|---------|-----------|-------|
| 1 | Page title "Get It Fast" | Default content | H1 heading |
| 2 | "Get delivery in as fast as an hour" | **Hero** | Skinny banner with bg image, heading, subheading, CTA |
| 3 | "Get your weekly musts fast" (6 cards) | **Cards** | Circular category images in grid |
| 4 | "Delivered as soon as 1 hour?" (6 cards) | **Cards** | Category cards grid |
| 5L | "A faster way to a clean home" | **Hero** | Spring cleaning promotional banner |
| 5R | Product carousel (19 items) | **Card-carousel-bidirectional** | Scrollable product tiles with bidirectional arrows |
| 6 | "Get spring flowers delivered" | **Hero** | Flowers banner with overlay image |
| 7 | Allergy relief mosaic (5 tiles) | **Cards** | Multi-size category tiles |
| 8L | "University FanCards" | **Hero** | FanCards promotional banner |
| 8R | FanCards carousel (3 items) | **Card-carousel-bidirectional** | Gift card product tiles (few-slides variant) |
| 9 | Terms & Conditions | Default content | Legal text |

### Block Types Used

- **Hero** — 4 instances (skinny banner, adjustable banner, flowers banner, FanCards region)
- **Cards** — 3 instances (weekly musts, delivery categories, allergy relief)
- **Card-carousel-bidirectional** — 2 instances (19 product cards + 3 gift card products)
- **Default content** — 2 instances (page title, terms & conditions)

---

## Phase 3 — Import Infrastructure

Built custom parsers and transformers to convert the Walmart source HTML into EDS block tables.

### Parsers Created

| Parser | File | Purpose |
|--------|------|---------|
| Hero | `tools/importer/parsers/hero.js` | Handles 4 hero variants: skinny banner, adjustable banner, flowers banner, FanCards region. Extracts background images, overlay images (Express Delivery badge), headings, subheadings, and CTAs. |
| Cards | `tools/importer/parsers/cards.js` | Parses HubSpokesNxM and PrismCollectionCarousel patterns into 2-column card rows (image + text). |
| Card-carousel-bidirectional | `tools/importer/parsers/card-carousel-bidirectional.js` | Extracts product tiles from scrollable carousel with images, titles, prices, and "+Add" CTA links. |

### Transformers Created

| Transformer | File | Purpose |
|-------------|------|---------|
| Walmart Cleanup | `tools/importer/transformers/walmart-cleanup.js` | Site-wide DOM cleanup — removes scripts, ads, navigation chrome, tracking pixels |
| Walmart Sections | `tools/importer/transformers/walmart-sections.js` | Inserts section breaks at correct boundaries, adds Section Metadata blocks for styled sections |

### Import Script

- `tools/importer/import-get-it-fast.js` — Main import script combining parsers and transformers
- `tools/importer/import-get-it-fast.bundle.js` — Bundled version for execution
- `tools/importer/urls-get-it-fast.txt` — URL list for bulk import

---

## Phase 4 — Block Development

Implemented EDS block JavaScript and CSS for each block type.

### Hero Block (`blocks/hero/`)

- **hero.js** (49 lines) — Decorates hero block with background image handling, overlay image extraction (wrapped in `<em>` tags), and text content positioning
- **hero.css** (94 lines) — Full-width hero with:
  - Background image covering entire block
  - Overlay images positioned absolutely with `z-index: 0`
  - Text content with `z-index: 1` to render above overlays
  - Responsive padding and font sizing
  - CTA button styling using global design tokens

### Cards Block (`blocks/cards/`)

- **cards.js** (24 lines) — Grid layout decoration for category cards
- **cards.css** (29 lines) — Responsive grid with circular images and card styling

### Card-carousel-bidirectional Block (`blocks/card-carousel-bidirectional/`)

- **card-carousel-bidirectional.js** (74 lines) — Horizontal scrollable carousel with bidirectional navigation arrows, product tile rendering
- **card-carousel-bidirectional.css** (141 lines) — Carousel layout with scroll snap, navigation buttons, product tile styling with images, titles, prices, and "+Add" buttons

### Card-carousel-bidirectional — Few-Slides Variant

When 3 or fewer items are present (e.g., FanCards section), the carousel automatically adds a `few-slides` CSS class that widens cards to ~45% width, showing 2 cards at a time instead of the default 3–4. This replaces the previously separate `card-carousel-onedirection` block.

---

## Phase 5 — Content Import & Verification

Ran the bundled import script to generate the final HTML content.

### Import Pipeline

1. **Bundle** — `aem-import-bundle.sh` combines parsers, transformers, and import script into a single bundle
2. **Execute** — `run-bulk-import.js` processes the source HTML through the bundle to generate EDS-compatible HTML
3. **Output** — `content/index.plain.html` containing all 9 sections with proper block tables
4. **Report** — `tools/importer/reports/import-get-it-fast.report.xlsx` with import status

### Verification

All sections verified at localhost:3000 preview server:
- 9 sections rendered correctly
- All hero banners display background images and CTAs
- Category card grids show correct images and labels
- Product carousels scroll with proper navigation
- Terms & Conditions text renders as default content

---

## Phase 6 — Post-Import Fixes

After initial import, several content accuracy issues were identified and corrected through iterative review.

### Fix 1: Hero Parser — Express Delivery Badge Overlay

**Problem:** The Express Delivery badge image was not appearing on the hero banner.

**Root Cause:** The hero parser only captured the main background image, ignoring overlay images (positioned with `position: absolute`) that sit on top of the hero background.

**Solution:** Added overlay image detection in `hero.js` parser:
- Scans for `img[class*="absolute"]` siblings of the background image
- Excludes absolute-fill backgrounds, carousel images, and list item product images
- Wraps overlay images in `<em>` tags for the block JS to identify and position

**CSS Fix:** Added z-index stacking in `hero.css`:
```css
.hero h1,
.hero p:not(.hero-bg) {
  position: relative;
  z-index: 1;
}
```

### Fix 2: Hero Parser — FanCards Subheading Missing

**Problem:** The FanCards hero section was missing the subheading text "Fast digital delivery. Use anywhere Mastercard is accepted."

**Root Cause:** The subheading selector pattern did not include `p[class*="f6"]` which was the CSS class used for the FanCards description text.

**Solution:** Added `p[class*="f6"]` to the subheading candidate selectors in `hero.js`.

### Fix 3: Hero Parser — FanCards CTA Showing "Learn more" Instead of "Shop all"

**Problem:** The FanCards hero CTA button displayed "Learn more" (default fallback) instead of "Shop all".

**Root Cause:** The parser used `element.querySelector('a[link-identifier]...')` which found the first matching link — an image wrapper `<a class="h-100 w-100">` containing only an `<img>` element with no visible text. Since `cta.textContent.trim()` returned empty string, the fallback `'Learn more'` was used.

**Solution:** Changed from single `querySelector` to `querySelectorAll` with iteration:
```javascript
const ctaCandidates = element.querySelectorAll(
  'a[link-identifier]:not([aria-label*="Previous"]):not([aria-label*="Next"])...'
);
let cta = null;
for (const link of ctaCandidates) {
  const textOnly = link.textContent.replace(/\s+/g, '')
    .replace(link.querySelector('img')?.alt || '', '');
  if (textOnly || (!link.querySelector('img') && link.textContent.trim())) {
    cta = link;
    break;
  }
}
if (!cta && ctaCandidates.length > 0) cta = ctaCandidates[0];
```

### Fix 4: Bidirectional Carousel — CTA Text "Shop now" Changed to "+Add"

**Problem:** The spring cleaning product carousel (19 items) showed "Shop now" on each card, but the original Walmart page had "+Add" (Add to cart) buttons.

**Root Cause:** CTA text was hardcoded as `'Shop now'` in `card-carousel-bidirectional.js` (line 48).

**Solution:** Changed `a.textContent = 'Shop now'` to `a.textContent = '+Add'` in the parser. Re-bundled and re-imported to verify all 19 product cards now display "+Add".

### Fix 5: Consolidated Carousel — Replaced card-carousel-onedirection with card-carousel-bidirectional

**Problem:** The FanCards section used a separate `card-carousel-onedirection` block, creating unnecessary code duplication.

**Solution:** Consolidated to a single `card-carousel-bidirectional` block with a `few-slides` CSS modifier that automatically activates when the carousel has 3 or fewer items. This shows ~2 cards at a time (45% width) instead of the default 3–4. The separate `card-carousel-onedirection` block, parser, and all references were removed.

---

## Files Created & Modified

### Styles (Global)

| File | Lines | Description |
|------|-------|-------------|
| `styles/styles.css` | 375 | Full design token replacement — colors, typography, buttons, sections, spacing |
| `styles/fonts.css` | 35 | Walmart font stack with EverydaySans preparation |

### Blocks

| File | Lines | Description |
|------|-------|-------------|
| `blocks/hero/hero.js` | 49 | Hero block decoration with overlay support |
| `blocks/hero/hero.css` | 94 | Hero styling with z-index stacking |
| `blocks/hero/_hero.json` | — | Block metadata |
| `blocks/hero/hero-tokens.css` | — | Design tokens |
| `blocks/cards/cards.js` | 24 | Cards grid decoration |
| `blocks/cards/cards.css` | 29 | Cards responsive grid styling |
| `blocks/cards/_cards.json` | — | Block metadata |
| `blocks/cards/cards-tokens.css` | — | Design tokens |
| `blocks/card-carousel-bidirectional/card-carousel-bidirectional.js` | 74 | Bidirectional carousel decoration |
| `blocks/card-carousel-bidirectional/card-carousel-bidirectional.css` | 141 | Carousel styling with scroll snap |

### Import Infrastructure

| File | Description |
|------|-------------|
| `tools/importer/parsers/hero.js` | Hero parser (4 variants) |
| `tools/importer/parsers/cards.js` | Cards parser (HubSpokesNxM + PrismCollectionCarousel) |
| `tools/importer/parsers/card-carousel-bidirectional.js` | Bidirectional carousel parser |
| `tools/importer/transformers/walmart-cleanup.js` | Site-wide DOM cleanup |
| `tools/importer/transformers/walmart-sections.js` | Section boundary detection |
| `tools/importer/import-get-it-fast.js` | Main import script |
| `tools/importer/import-get-it-fast.bundle.js` | Bundled import script |
| `tools/importer/urls-get-it-fast.txt` | URL list |

### Content Output

| File | Description |
|------|-------------|
| `content/index.plain.html` | Final migrated page content (9 sections) |

### Migration Artifacts

| File | Description |
|------|-------------|
| `migration-work/raw-source.html` | Scraped source HTML from Wayback Machine |
| `migration-work/authoring-analysis.json` | Section/block analysis results |
| `migration-work/metadata.json` | Page metadata |
| `migration-work/page-structure.json` | Page structure analysis |
| `migration-work/migration-plan.md` | Step-by-step migration plan with status |
| `migration-document/design-implementation.md` | Design system documentation |

---

## Known Limitations

1. **Dynamic carousel content**: The FanCards carousel (section 8R) items are empty in the static HTML capture because they are lazy-loaded on walmart.com. The parser uses hardcoded fallback product data (3 university gift cards) extracted from embedded JSON in the raw source.

2. **Image URLs**: All images reference Walmart CDN URLs (`i5.walmartimages.com`). These are not downloaded locally — they load from the original source at render time.

3. **Proprietary font**: Walmart uses a proprietary font (EverydaySans) not available for download. The migration uses Helvetica Neue as the closest available alternative, with `@font-face` declarations prepared in `fonts.css` ready to activate when font files are available.

4. **Bot protection**: The live walmart.com site has bot protection, so the source HTML was obtained from the Wayback Machine archive. Some dynamic content may differ from the live site.
