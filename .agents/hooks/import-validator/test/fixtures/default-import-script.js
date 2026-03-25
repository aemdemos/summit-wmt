/* global WebImporter */

/**
 * Minimal test import script for bulk-import testing
 * This is browser-compatible (no Node.js imports)
 */

const config = {
  /**
   * Transform the DOM - basic cleanup
   */
  transformDOM: ({ document, url }) => {
    console.log('[Test Import] Processing:', url);

    // Get main content
    const main = document.querySelector('main') || document.body;

    // Remove non-content elements
    WebImporter.DOMUtils.remove(main, [
      'header',
      '.header',
      'nav',
      '.nav',
      'footer',
      '.footer',
      'iframe',
      'noscript',
      '.cookie-banner',
      '#cookie-consent',
    ]);

    console.log('[Test Import] Cleanup complete');
    return main;
  },

  /**
   * Generate document path from URL
   */
  generateDocumentPath: ({ url }) => {
    const urlObj = new URL(url);
    let path = urlObj.pathname;

    // Remove trailing slash
    if (path.endsWith('/')) {
      path = path.slice(0, -1);
    }

    // Use /index for root
    if (path === '') {
      path = '/index';
    }

    // Remove .html extension
    path = path.replace(/\.html?$/, '');

    return WebImporter.FileUtils.sanitizePath(path);
  },
};

// Export for browser
if (typeof window !== 'undefined') {
  window.IMPORT_CONFIG = config;
}

// Export for Node.js (if needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = config;
}

console.log('[Test Import] Script loaded successfully');

