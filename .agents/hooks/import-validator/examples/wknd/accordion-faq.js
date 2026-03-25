/* eslint-disable */
/* global WebImporter */

/**
 * Parser for accordion-faq variant. Base: accordion.
 * Source: https://wknd-trendsetters.site/
 * Selector: .faq-list
 * Model: container with accordion-faq-item children.
 * Item fields: summary (text), text (richtext)
 */
export default function parse(element, { document }) {
  // Each FAQ item is a <details> element with class faq-item
  const faqItems = Array.from(element.querySelectorAll('details.faq-item, details'));

  const cells = [];

  faqItems.forEach((item) => {
    // Column 1: summary field (question text from <summary>)
    const summaryEl = item.querySelector('summary');
    const questionSpan = summaryEl ? summaryEl.querySelector('span') : null;
    const questionText = questionSpan ? questionSpan.textContent.trim() : (summaryEl ? summaryEl.textContent.trim() : '');

    const summaryFrag = document.createDocumentFragment();
    if (questionText) {
      summaryFrag.appendChild(document.createComment(' field:summary '));
      summaryFrag.appendChild(document.createTextNode(questionText));
    }

    // Column 2: text field (answer content from .faq-answer)
    const answerDiv = item.querySelector('.faq-answer');
    const textFrag = document.createDocumentFragment();
    if (answerDiv) {
      textFrag.appendChild(document.createComment(' field:text '));
      // Move all child nodes from the answer div
      while (answerDiv.firstChild) {
        textFrag.appendChild(answerDiv.firstChild);
      }
    }

    cells.push([summaryFrag, textFrag]);
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'accordion-faq', cells });
  element.replaceWith(block);
}
