/* eslint-disable */
/* global WebImporter */

/**
 * Parser for cards-article variant. Base: cards.
 * Source: https://wknd-trendsetters.site/
 * Selector: main > section.section:nth-of-type(4) .grid-layout.desktop-4-column
 * Model: container with card items (image, text). Article cards with link, tag, date, heading.
 */
export default function parse(element, { document }) {
  // Each card is an <a> with class article-card
  const cards = Array.from(element.querySelectorAll(':scope > a.article-card, :scope > a.card-link'));

  const cells = [];

  cards.forEach((card) => {
    const img = card.querySelector('.article-card-image img, img');
    const body = card.querySelector('.article-card-body');
    const tag = body ? body.querySelector('.tag') : null;
    const date = body ? body.querySelector('.paragraph-sm, .article-card-meta .paragraph-sm') : null;
    const heading = body ? body.querySelector('h3, h4, h2') : null;

    // Column 1: image field
    const imageFrag = document.createDocumentFragment();
    if (img) {
      imageFrag.appendChild(document.createComment(' field:image '));
      imageFrag.appendChild(img);
    }

    // Column 2: text field (heading as link + tag + date)
    const textFrag = document.createDocumentFragment();
    textFrag.appendChild(document.createComment(' field:text '));

    // Create a linked heading using the card's href
    const href = card.getAttribute('href');
    if (heading && href) {
      const link = document.createElement('a');
      link.setAttribute('href', href);
      link.textContent = heading.textContent;
      const h = document.createElement(heading.tagName);
      h.appendChild(link);
      textFrag.appendChild(h);
    } else if (heading) {
      textFrag.appendChild(heading);
    }

    if (tag) {
      const p = document.createElement('p');
      p.textContent = tag.textContent;
      textFrag.appendChild(p);
    }

    if (date) {
      const p = document.createElement('p');
      p.textContent = date.textContent;
      textFrag.appendChild(p);
    }

    cells.push([imageFrag, textFrag]);
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards-article', cells });
  element.replaceWith(block);
}
