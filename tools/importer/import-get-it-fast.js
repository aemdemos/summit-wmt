/* eslint-disable */
/* global WebImporter */

// PARSER IMPORTS
import heroParser from './parsers/hero.js';
import cardsParser from './parsers/cards.js';
import cardCarouselBidirectionalParser from './parsers/card-carousel-bidirectional.js';

// TRANSFORMER IMPORTS
import walmartCleanupTransformer from './transformers/walmart-cleanup.js';
import walmartSectionsTransformer from './transformers/walmart-sections.js';

// PARSER REGISTRY
const parsers = {
  'hero': heroParser,
  'cards': cardsParser,
  'card-carousel-bidirectional': cardCarouselBidirectionalParser,
};

// PAGE TEMPLATE CONFIGURATION
const PAGE_TEMPLATE = {
  name: 'get-it-fast',
  description: 'Walmart Get It Fast fulfillment landing page with hero banners, category card grids, product carousels, and promotional tiles',
  urls: [
    'http://localhost:8888/'
  ],
  blocks: [
    {
      name: 'hero',
      instances: [
        '[data-testid="skinny-banner"]',
        '[data-dca-id="M:F1F94AD6C9"]',
        '[data-dca-id="M:6D7CF9AB52"]',
        'div.mv3[role=region]'
      ]
    },
    {
      name: 'cards',
      instances: [
        '[data-testid="HubSpokesNxM"]',
        '[data-dca-id="M:7841184E2C"]'
      ]
    },
    {
      name: 'card-carousel-bidirectional',
      instances: [
        '[data-testid="horizontal-scroller-Product Carousel"]'
      ]
    },
    {
      name: 'card-carousel-bidirectional',
      instances: [
        '[data-testid="horizontal-scroller-One and two sku"]'
      ]
    }
  ],
  sections: [
    {
      id: 'section-1',
      name: 'Page Title',
      selector: 'main h1',
      style: null,
      blocks: [],
      defaultContent: ['main h1']
    },
    {
      id: 'section-2',
      name: 'Hero Banner - Delivery Promise',
      selector: '[data-dca-id="M:8C60EE984E"]',
      style: null,
      blocks: ['hero'],
      defaultContent: []
    },
    {
      id: 'section-3',
      name: 'Weekly Musts Category Cards',
      selector: 'section[data-dca-id="M:1F5D2073D5"]@nth(0)',
      style: null,
      blocks: ['cards'],
      defaultContent: ['section[data-dca-id="M:1F5D2073D5"]:first-of-type h2']
    },
    {
      id: 'section-4',
      name: '1-Hour Delivery Category Cards',
      selector: 'section[data-dca-id="M:1F5D2073D5"]@nth(1)',
      style: null,
      blocks: ['cards'],
      defaultContent: ['section[data-dca-id="M:1F5D2073D5"]:last-of-type h2']
    },
    {
      id: 'section-5',
      name: 'Spring Cleaning Hero + Product Carousel',
      selector: [
        '[data-dca-id="M:F1F94AD6C9"]',
        '[data-dca-id="M:9B63096861"]'
      ],
      style: null,
      blocks: ['hero', 'card-carousel-bidirectional'],
      defaultContent: [
        '[data-dca-id="M:DF16D9EFF8"] h2',
        '[data-dca-id="M:DF16D9EFF8"] h3'
      ]
    },
    {
      id: 'section-6',
      name: 'Spring Flowers Banner',
      selector: '[data-dca-id="M:6D7CF9AB52"]',
      style: 'light-grey',
      blocks: ['hero'],
      defaultContent: []
    },
    {
      id: 'section-7',
      name: 'Allergy Relief & Essentials Collection',
      selector: '[data-dca-id="M:7841184E2C"]',
      style: null,
      blocks: ['cards'],
      defaultContent: []
    },
    {
      id: 'section-8',
      name: 'University FanCards',
      selector: '[data-dca-id="M:470F3095A8"]',
      style: null,
      blocks: ['hero', 'card-carousel-bidirectional'],
      defaultContent: []
    },
    {
      id: 'section-9',
      name: 'Terms & Conditions',
      selector: 'div.dark-gray.mh3.mh0-l.mv3.mv4-l',
      style: null,
      blocks: [],
      defaultContent: ['div.dark-gray.mh3 h1', 'div.dark-gray.mh3 span']
    }
  ]
};

// TRANSFORMER REGISTRY
const transformers = [
  walmartCleanupTransformer,
  ...(PAGE_TEMPLATE.sections && PAGE_TEMPLATE.sections.length > 1 ? [walmartSectionsTransformer] : []),
];

/**
 * Execute all page transformers for a specific hook
 */
function executeTransformers(hookName, element, payload) {
  const enhancedPayload = {
    ...payload,
    template: PAGE_TEMPLATE,
  };

  transformers.forEach((transformerFn) => {
    try {
      transformerFn.call(null, hookName, element, enhancedPayload);
    } catch (e) {
      console.error(`Transformer failed at ${hookName}:`, e);
    }
  });
}

/**
 * Find all blocks on the page based on embedded template configuration
 */
function findBlocksOnPage(document, template) {
  const pageBlocks = [];

  template.blocks.forEach((blockDef) => {
    blockDef.instances.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      if (elements.length === 0) {
        console.warn(`Block "${blockDef.name}" selector not found: ${selector}`);
      }
      elements.forEach((element) => {
        pageBlocks.push({
          name: blockDef.name,
          selector,
          element,
          section: blockDef.section || null,
        });
      });
    });
  });

  console.log(`Found ${pageBlocks.length} block instances on page`);
  return pageBlocks;
}

export default {
  transform: (payload) => {
    const { document, url, html, params } = payload;
    const main = document.body;

    // 1. Execute beforeTransform transformers (initial cleanup)
    executeTransformers('beforeTransform', main, payload);

    // 2. Find blocks on page using embedded template
    const pageBlocks = findBlocksOnPage(document, PAGE_TEMPLATE);

    // 3. Parse each block using registered parsers
    pageBlocks.forEach((block) => {
      const parser = parsers[block.name];
      if (parser) {
        try {
          console.log(`Parsing block: ${block.name} (${block.selector})`);
          parser(block.element, { document, url, params });
          console.log(`Parsed block: ${block.name} OK`);
        } catch (e) {
          console.error(`Failed to parse ${block.name} (${block.selector}):`, e.message || e);
        }
      } else {
        console.warn(`No parser found for block: ${block.name}`);
      }
    });

    // 4. Execute afterTransform transformers (final cleanup + section breaks/metadata)
    executeTransformers('afterTransform', main, payload);

    // 5. Apply WebImporter built-in rules
    const hr = document.createElement('hr');
    main.appendChild(hr);
    WebImporter.rules.createMetadata(main, document);
    WebImporter.rules.transformBackgroundImages(main, document);
    WebImporter.rules.adjustImageUrls(main, url, params.originalURL);

    // 6. Generate sanitized path (avoid sanitizePath which requires Node.js process.cwd)
    const sourceUrl = (params && params.originalURL) || url;
    let path;
    try {
      path = new URL(sourceUrl).pathname.replace(/\/$/, '').replace(/\.html$/, '') || '/index';
    } catch (e) {
      path = '/index';
    }

    return [{
      element: main,
      path,
      report: {
        title: document.title,
        template: PAGE_TEMPLATE.name,
        blocks: pageBlocks.map((b) => b.name),
      },
    }];
  },
};
