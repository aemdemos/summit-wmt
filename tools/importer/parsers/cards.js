/* eslint-disable */
/* global WebImporter */

/**
 * Parser for cards block.
 * Base: cards. Source: walmart.com/cp/get-it-fast/6545138
 * Target table: 2 columns per row - [image] | [title + description + CTA]
 *
 * Handles 3 card variants in source:
 * - HubSpokesNxM (sections 3 & 4): 6-card grid with circular images + label links
 *   Structure: div[role=listitem] > a > img + span.ld_A3
 * - PrismCollectionCarousel (section 7): 5-tile bento grid with bg images, headings, CTAs
 *   Structure: div with bg img, heading p.b, CTA a[link-identifier]
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
  const cells = [];

  // Pattern 1: HubSpokesNxM - category cards with images and labels
  const hubCards = element.querySelectorAll('[role="listitem"]');
  if (hubCards.length > 0) {
    hubCards.forEach((card) => {
      const img = card.querySelector('img');
      const label = card.querySelector('span.ld_A3, span[class*="mid-gray"]');
      const link = card.querySelector('a[link-identifier], a[href]');

      const imageCell = [];
      if (img) {
        const newImg = document.createElement('img');
        newImg.src = img.src || img.getAttribute('src') || '';
        newImg.alt = label ? label.textContent.trim() : (img.alt || '');
        imageCell.push(newImg);
      }

      const textCell = [];
      if (label) {
        const strong = document.createElement('strong');
        if (link) {
          const a = document.createElement('a');
          a.href = link.href || link.getAttribute('href') || '';
          a.textContent = label.textContent.trim();
          strong.append(a);
        } else {
          strong.textContent = label.textContent.trim();
        }
        textCell.push(strong);
      }

      if (imageCell.length || textCell.length) {
        cells.push([imageCell, textCell]);
      }
    });
  }

  // Pattern 2: PrismCollectionCarousel - collection tiles with bg images, headings, CTAs
  // Each tile is a .card-wrapper containing a bg img, heading p.b, and CTA a[link-identifier]
  if (hubCards.length === 0) {
    const cardWrappers = element.querySelectorAll('.card-wrapper');

    cardWrappers.forEach((wrapper) => {
      const img = wrapper.querySelector('img[id*="PrismCollectionCarousel"]');
      if (!img) return; // skip non-PrismCollectionCarousel card-wrappers

      const heading = wrapper.querySelector('p.b[id^="heading-"]');
      const eyebrow = wrapper.querySelector('p.b:not([id^="heading-"])');
      const cta = wrapper.querySelector('a[link-identifier]:not(.absolute)');

      const imageCell = [];
      const newImg = document.createElement('img');
      newImg.src = img.src || img.getAttribute('src') || '';
      newImg.alt = heading ? heading.textContent.trim() : (img.alt || '');
      imageCell.push(newImg);

      const textCell = [];
      if (heading) {
        const strong = document.createElement('strong');
        strong.textContent = heading.textContent.trim();
        textCell.push(strong);
      }
      if (eyebrow) {
        const p = document.createElement('p');
        p.textContent = eyebrow.textContent.trim();
        textCell.push(p);
      }
      if (cta) {
        const a = document.createElement('a');
        a.href = cta.href || cta.getAttribute('href') || '';
        a.textContent = deduplicateText(cta.textContent.trim());
        textCell.push(a);
      }

      if (imageCell.length || textCell.length) {
        cells.push([imageCell, textCell]);
      }
    });
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards', cells });
  element.replaceWith(block);
}
