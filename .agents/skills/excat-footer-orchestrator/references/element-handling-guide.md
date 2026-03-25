# Footer Element Handling Guide

Detailed handling instructions for every footer element type.

## Multi-Column Link Groups

The most common footer pattern — 3–6 columns of categorized links.

**Analysis**: Count columns, count links per column, record column headers.
**Content**: Each column is a top-level `<div>` in `footer.plain.html` with a heading and `<ul>` of links.
**Behavior**: Hover underline/color change on each link. Click navigates.
**Mobile**: Columns stack vertically. Often collapse into accordions with chevron icons.

## Newsletter / Contact Forms

Two sub-types:

### CTA Link Form (`formType: "cta-link"`)
A button/link that navigates to a separate signup page. Treat as a regular link with special styling.

### Inline Form (`formType: "inline-form"`)
Email input + submit button rendered directly in the footer.

**Content**: Form markup lives in `footer.plain.html`. Include `<input>`, `<button>`, placeholder text.
**Behavior**: Validate email format, submit handler, success/error states.
**Fields**: Record `fieldCount`, field types (`email`, `text`, `checkbox`), button label, placeholder text.
**Checkboxes**: Privacy consent checkboxes — content-first (label text in HTML).

**EDS / authoring pipeline**: `decorateButtons()` may rewrite `<strong><a href="…">Label</a></strong>` into `<p class="button-wrapper"><a class="button primary">Label</a></p>` (exact class names can vary). **`footer.js` must not assume** the original `<strong>` wrapper still exists — select submit/CTA links using the **decorated** structure (e.g. `.button-wrapper a`, `a.button`) so consent/order logic still runs after load.

## Social Icons

Row of social media icons (Facebook, Twitter/X, Instagram, LinkedIn, YouTube, TikTok, etc.).

**Analysis**: Count icons, identify platforms, record icon type (SVG inline, `<img>`, font icon).
**Content**: Each icon is an `<a>` wrapping an `<img>` or inline SVG in `footer.plain.html`.
**Behavior**: Hover effect (opacity, scale, color change). Click opens new tab.
**Images**: Download all social icon SVGs/PNGs to `content/images/`.

## Locale / Language Selector

A dropdown, grid, or panel that lets users switch country/language.

**CRITICAL**: Extract ALL options — not just the visible trigger.

**Analysis**:
1. Click the locale trigger
2. Screenshot the expanded dropdown/panel
3. Extract every entry: label, URL, flag image
4. Record `selectorType`: `country-grid`, `language-list`, `region-tabs`, `simple-dropdown`
5. Record `entryCount`, `hasFlags`, `flagCount`

**Content**: ALL locale entries (country names + flag images) MUST be in `footer.plain.html`.
**JavaScript**: `footer.js` reads locale entries from the DOM — NEVER hardcode country names or flag URLs.
**Images**: Download all flag images to `content/images/`.

## Brand / Division Logos

Multiple brand logos (e.g. parent company + sub-brands) — common in corporate footers.

**Analysis**: Count logos, record dimensions, identify if they link anywhere.
**Content**: `<img>` tags in `footer.plain.html`.
**Images**: Download all logos to `content/images/`.

## Video Background

A video playing behind the footer content (e.g. Asian Paints).

**Analysis**: Record video source URL, autoplay, loop, muted, poster image.
**Content**: `<video>` element in `footer.plain.html` with poster fallback.
**Mobile**: Typically poster-only on mobile (bandwidth). Record `videoMobileBehavior`.
**Implementation**: CSS `position: absolute` behind content with `z-index` layering.

## Back-to-Top Button

Floating or inline button that scrolls to page top.

**Analysis**: Position (inline in footer, fixed bottom-right), visibility (always, on-scroll).
**Behavior**: Smooth scroll to top. May have hover animation.
**Implementation**: Can be in `footer.js` with scroll listener.

## Legal / Disclaimer Text

Copyright notice, legal links, privacy policy, terms of use.

**Analysis**: Record exact text, year, entity name. Record all legal links.
**Content**: Text and links in `footer.plain.html`.
**Note**: Copyright year should use current year or match source exactly.

## Contact Information

Phone numbers, email addresses, physical addresses.

**Analysis**: Record all contact details, check for `tel:` and `mailto:` links.
**Content**: Text in `footer.plain.html` with proper link protocols.

## Sticky Footer

Footer that sticks to the bottom of the viewport when content is short.

**Analysis**: Check `position: sticky` or `position: fixed` on footer.
**Implementation**: CSS only — `min-height: 100vh` on body, `margin-top: auto` on footer.
