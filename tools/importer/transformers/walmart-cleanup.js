/* eslint-disable */
/* global WebImporter */

/**
 * Transformer: Walmart cleanup.
 * Selectors from captured DOM (Wayback Machine archive) of walmart.com/cp/get-it-fast/6545138
 * Removes non-authorable structural wrappers, tracking attributes, and shell elements.
 */
const TransformHook = { beforeTransform: 'beforeTransform', afterTransform: 'afterTransform' };

export default function transform(hookName, element, payload) {
  if (hookName === TransformHook.beforeTransform) {
    // Remove any remaining script/style tags (from captured DOM)
    WebImporter.DOMUtils.remove(element, ['script', 'style', 'noscript', 'link']);

    // Extract carousel elements from their hero parent containers.
    // Carousels are nested inside hero sections but need independent parsing.
    // Move each carousel to be a sibling right after its parent hero element.
    const carouselSelectors = [
      '[data-testid="horizontal-scroller-Product Carousel"]',
      '[data-testid="horizontal-scroller-One and two sku"]',
    ];
    carouselSelectors.forEach((sel) => {
      const carousel = element.querySelector(sel);
      if (!carousel) return;
      // Find the hero ancestor that will be parsed (the block instance element)
      const heroParent = carousel.closest('[data-dca-id="M:F1F94AD6C9"]')
        || carousel.closest('div.mv3[role="region"]');
      if (heroParent && heroParent.contains(carousel)) {
        // Move carousel to be a sibling after its hero parent
        heroParent.after(carousel);
      }
    });
  }
  if (hookName === TransformHook.afterTransform) {
    // Remove non-authorable site shell elements (from captured DOM)
    WebImporter.DOMUtils.remove(element, ['header', 'footer', 'nav', 'iframe']);

    // Clean data-* tracking attributes (found on captured DOM elements)
    element.querySelectorAll('*').forEach((el) => {
      el.removeAttribute('data-track');
      el.removeAttribute('onclick');
      el.removeAttribute('data-dca-guid');
    });
  }
}
