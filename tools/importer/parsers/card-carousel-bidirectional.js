/* eslint-disable */
/* global WebImporter */

/**
 * Parser for card-carousel-bidirectional block.
 * Base: card-carousel-bidirectional. Source: walmart.com/cp/get-it-fast/6545138
 * Target table: 2 columns per row - [image] | [title + price + link]
 *
 * Source: horizontal-scroller "Product Carousel" (section 5)
 * - 19 product cards in a scrollable carousel
 * - Structure: li > div[role=group] > a.absolute(link) + div > img + title + price
 */
export default function parse(element, { document }) {
  const cells = [];

  const items = element.querySelectorAll('ul[data-testid="carousel-container"] > li');

  items.forEach((item) => {
    const img = item.querySelector('img[data-testid="productTileImage"]');
    const titleEl = item.querySelector('span.ld_A3 h3, h3.normal');
    const link = item.querySelector('a[href*="/ip/"]');
    const priceScreen = item.querySelector('span.ld_FS');
    const priceText = priceScreen ? priceScreen.textContent.trim() : '';
    const priceMatch = priceText.match(/current price \$([\d.]+)/);

    const imageCell = [];
    if (img) {
      const newImg = document.createElement('img');
      newImg.src = img.src || img.getAttribute('src') || '';
      newImg.alt = titleEl ? titleEl.textContent.trim() : (img.alt || '');
      imageCell.push(newImg);
    }

    const textCell = [];
    if (titleEl) {
      const strong = document.createElement('strong');
      strong.textContent = titleEl.textContent.trim();
      textCell.push(strong);
    }
    if (priceMatch) {
      const p = document.createElement('p');
      p.textContent = `$${priceMatch[1]}`;
      textCell.push(p);
    }
    if (link) {
      const a = document.createElement('a');
      a.href = link.href || link.getAttribute('href') || '';
      a.textContent = '+Add';
      textCell.push(a);
    }

    if (imageCell.length || textCell.length) {
      cells.push([imageCell, textCell]);
    }
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'card-carousel-bidirectional', cells });
  element.replaceWith(block);
}
