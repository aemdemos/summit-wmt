/* eslint-disable */
/* global WebImporter */

/**
 * Parser for hero block.
 * Base: hero. Source: walmart.com/cp/get-it-fast/6545138
 * Target table: 1 column, 1 row - single cell with [image, heading, subheading, CTA]
 *
 * Handles 4 hero variants in source:
 * - Skinny banner ([data-testid="skinny-banner"]): bg img, heading span, subtext span, CTA link
 * - Adjustable banner (M:F1F94AD6C9): bg img, eyebrow p, heading p, CTA link
 * - Flowers banner (M:6D7CF9AB52): bg img, heading h2, subtext p, CTA link
 * - FanCards region (div.mv3[role=region]): h2 heading, hero image in section.w-50, CTA link
 */
/**
 * Deduplicate text doubled by JSDOM parsing of Walmart's paired CTA links.
 * e.g., "Shop nowShop now" → "Shop now"
 */
function deduplicateText(text) {
  if (!text || text.length < 2) return text;
  const len = text.length;
  if (len % 2 === 0) {
    const half = text.substring(0, len / 2);
    if (text === half + half) return half;
  }
  return text;
}

export default function parse(element, { document }) {
  // Find background/hero image - multiple patterns from source DOM
  const bgImage = element.querySelector(
    'img[class*="absolute--fill"], img.absolute, img[aria-hidden="true"], section.w-50 img'
  );

  // Find heading - try multiple patterns from source DOM
  // Exclude headings inside nested sections (e.g., carousel inside hero parent section)
  let heading = null;
  const headingCandidates = element.querySelectorAll(
    'h1, h2, span.b[class*="f-subheadline"], span.b[class*="f1-ns"]'
  );
  for (const h of headingCandidates) {
    const nestedSection = h.closest('section[data-dca-id]');
    // Skip only if the heading is inside a nested child section (not a parent section)
    if (nestedSection && nestedSection !== element && element.contains(nestedSection)) continue;
    heading = h;
    break;
  }

  // For adjustable banners with p.b tags: heading is the larger text
  const altHeading = !heading
    ? element.querySelector('p.b[class*="f12"], p.b[class*="f10"], p.b[id^="heading-"]')
    : null;

  const finalHeading = heading || altHeading;

  // Find subheading/eyebrow - smaller text elements different from heading
  const subCandidates = element.querySelectorAll(
    'h3, span.tc[class*="f6"], p.fw4[class*="lh-11"], p.b.f4[class*="lh-title"], p[class*="f6"]'
  );
  let subheading = null;
  for (const s of subCandidates) {
    if (s !== finalHeading && s.textContent.trim()) {
      subheading = s;
      break;
    }
  }

  // Find CTA link - exclude carousel nav buttons and image-only wrapper links
  const ctaCandidates = element.querySelectorAll(
    'a[link-identifier]:not([aria-label*="Previous"]):not([aria-label*="Next"]):not([class*="nav-control"]), a[class*="br-pill"]:not([class*="nav-control"])'
  );
  let cta = null;
  for (const link of ctaCandidates) {
    // Skip links that only wrap images (no visible text)
    const textOnly = link.textContent.replace(/\s+/g, '').replace(link.querySelector('img')?.alt || '', '');
    if (textOnly || (!link.querySelector('img') && link.textContent.trim())) {
      cta = link;
      break;
    }
  }
  // Fallback to first candidate if none had text
  if (!cta && ctaCandidates.length > 0) cta = ctaCandidates[0];

  // Find overlay images (e.g., "Express Delivery" badge) that sit on top of the background
  // Only capture images that are direct decorative overlays within the same banner,
  // excluding product images inside carousels, list items, or nested sections
  const overlayImages = [];
  if (bgImage) {
    const bgParent = bgImage.parentElement;
    if (bgParent) {
      const siblingImgs = bgParent.querySelectorAll('img[class*="absolute"]');
      siblingImgs.forEach((img) => {
        if (img === bgImage) return;
        if (!img.src) return;
        // Skip if it's an absolute--fill (another background)
        if (img.className.includes('absolute--fill')) return;
        // Skip if inside a carousel, list item, or product tile
        if (img.closest('li, ul, [role="group"], [data-testid*="carousel"]')) return;
        overlayImages.push(img);
      });
    }
  }

  // Build single cell with all content (matching hero library: 1 col, 1 row)
  const contentCell = [];

  if (bgImage) {
    const img = document.createElement('img');
    img.src = bgImage.src || bgImage.getAttribute('src') || '';
    img.alt = bgImage.alt || bgImage.getAttribute('alt') || '';
    contentCell.push(img);
  }

  // Add overlay images (e.g., Express Delivery badge, decorative flower images)
  // Wrap in an <em> tag so the hero block JS can identify and position them as overlays
  if (overlayImages.length > 0) {
    const wrapper = document.createElement('em');
    overlayImages.forEach((overlayImg) => {
      const img = document.createElement('img');
      img.src = overlayImg.src || overlayImg.getAttribute('src') || '';
      img.alt = overlayImg.alt || overlayImg.getAttribute('alt') || '';
      wrapper.append(img);
    });
    contentCell.push(wrapper);
  }

  if (finalHeading) {
    const h = document.createElement('h1');
    h.textContent = finalHeading.textContent.trim();
    contentCell.push(h);
  }

  if (subheading) {
    const p = document.createElement('p');
    p.textContent = subheading.textContent.trim();
    contentCell.push(p);
  }

  if (cta) {
    const a = document.createElement('a');
    a.href = cta.href || cta.getAttribute('href') || '';
    a.textContent = deduplicateText(cta.textContent.trim()) || 'Learn more';
    const strong = document.createElement('strong');
    strong.append(a);
    contentCell.push(strong);
  }

  // cells: [[contentCell]] = 1 row with 1 cell containing all elements
  const cells = [[contentCell]];

  const block = WebImporter.Blocks.createBlock(document, { name: 'hero', cells });
  element.replaceWith(block);
}
