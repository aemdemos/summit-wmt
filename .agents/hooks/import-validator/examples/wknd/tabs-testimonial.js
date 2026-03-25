/* eslint-disable */
/* global WebImporter */

/**
 * Parser for tabs-testimonial variant. Base: tabs.
 * Source: https://wknd-trendsetters.site/
 * Selector: .tabs-wrapper
 * Model: container with tabs-testimonial-item children.
 * Item fields: title (text), content_heading (text), content_headingType (collapsed),
 *   content_image (reference), content_richtext (richtext)
 * Grouped: content_* fields in one cell; title in separate cell.
 */
export default function parse(element, { document }) {
  // Tab panes contain the panel content
  const tabPanes = Array.from(element.querySelectorAll('.tab-pane'));
  // Tab buttons contain the tab labels
  const tabButtons = Array.from(element.querySelectorAll('.tab-menu-link'));

  const cells = [];

  tabPanes.forEach((pane, index) => {
    const button = tabButtons[index];

    // Column 1: title field (tab label - person's name from button)
    const titleFrag = document.createDocumentFragment();
    titleFrag.appendChild(document.createComment(' field:title '));
    if (button) {
      const nameEl = button.querySelector('strong');
      const titleText = nameEl ? nameEl.textContent.trim() : button.textContent.trim();
      titleFrag.appendChild(document.createTextNode(titleText));
    }

    // Column 2: grouped content_* fields — order must match model:
    // content_heading (text), content_headingType (collapsed/skipped),
    // content_image (reference), content_richtext (richtext)
    const contentFrag = document.createDocumentFragment();

    // content_heading: person name (plain text field — no extra paragraphs)
    const nameDiv = pane.querySelector('.paragraph-xl strong, strong');
    const nameText = nameDiv ? nameDiv.textContent.trim() : '';
    if (nameText) {
      contentFrag.appendChild(document.createComment(' field:content_heading '));
      const h3 = document.createElement('h3');
      h3.textContent = nameText;
      contentFrag.appendChild(h3);
    }

    // content_image: person image from tab pane
    const paneImage = pane.querySelector('img.cover-image, img');
    if (paneImage) {
      contentFrag.appendChild(document.createComment(' field:content_image '));
      contentFrag.appendChild(paneImage);
    }

    // content_richtext: role text + testimonial quote
    const roleDiv = pane.querySelector('.paragraph-xl + div, .paragraph-xl ~ div:not(.paragraph-xl)');
    const roleText = roleDiv && !roleDiv.querySelector('strong') ? roleDiv.textContent.trim() : '';
    const quote = pane.querySelector('p.paragraph-xl');
    if (roleText || quote) {
      contentFrag.appendChild(document.createComment(' field:content_richtext '));
      if (roleText) {
        const roleP = document.createElement('p');
        roleP.textContent = roleText;
        contentFrag.appendChild(roleP);
      }
      if (quote) {
        contentFrag.appendChild(quote);
      }
    }

    cells.push([titleFrag, contentFrag]);
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'tabs-testimonial', cells });
  element.replaceWith(block);
}
