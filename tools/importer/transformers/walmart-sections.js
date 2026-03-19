/* eslint-disable */
/* global WebImporter */

/**
 * Transformer: Walmart section breaks and section-metadata.
 *
 * Uses a two-phase approach because parsers run between beforeTransform and
 * afterTransform, replacing original DOM elements with block tables. Section
 * selectors would fail after parsing. So:
 *
 * Phase 1 (beforeTransform): Insert hidden marker divs at section boundaries
 *   while original selectors still exist in the DOM.
 * Phase 2 (afterTransform): Walk the entire DOM tree depth-first, collect all
 *   meaningful content and markers in order, then rebuild a flat structure with
 *   <hr> section breaks and Section Metadata blocks.
 */
const TransformHook = { beforeTransform: 'beforeTransform', afterTransform: 'afterTransform' };
const MARKER_ATTR = 'data-section-marker';

/**
 * Find the element matching a section selector.
 * Supports:
 *   - Single selector string: 'div.foo'
 *   - Selector with nth occurrence: 'div.foo@nth(1)' (0-based index)
 *   - Array of selectors (tried in order)
 */
function findSectionElement(main, selector) {
  if (Array.isArray(selector)) {
    for (const sel of selector) {
      const el = findSectionElement(main, sel);
      if (el) return el;
    }
    return null;
  }

  // Support @nth(N) suffix for nth occurrence
  const nthMatch = selector.match(/^(.+)@nth\((\d+)\)$/);
  if (nthMatch) {
    const baseSelector = nthMatch[1];
    const index = parseInt(nthMatch[2], 10);
    const elements = main.querySelectorAll(baseSelector);
    return elements[index] || null;
  }

  return main.querySelector(selector);
}

/**
 * Collect all block instance selectors from the template configuration.
 * These are selectors that parsers will match and replace with block tables.
 */
function getBlockInstanceSelectors(template) {
  if (!template || !template.blocks) return [];
  const selectors = [];
  template.blocks.forEach((blockDef) => {
    blockDef.instances.forEach((sel) => selectors.push(sel));
  });
  return selectors;
}

/**
 * Check if an element is inside (or is) a block instance element.
 * If so, return the outermost block instance ancestor so the marker
 * can be placed before it (outside the element that parsers will replace).
 */
function findOutermostBlockAncestor(el, root, blockSelectors) {
  let outermost = null;
  let current = el;
  while (current && current !== root) {
    for (const sel of blockSelectors) {
      try {
        if (current.matches && current.matches(sel)) {
          outermost = current;
        }
      } catch (e) {
        // selector may contain spaces or special chars that fail matches()
      }
    }
    current = current.parentElement;
  }
  return outermost;
}

export default function transform(hookName, element, payload) {
  const doc = element.ownerDocument || document;
  const sections = payload && payload.template && payload.template.sections;
  if (!sections || sections.length < 2) return;

  if (hookName === TransformHook.beforeTransform) {
    // Phase 1: Insert marker divs at section boundaries while selectors work.
    // Process in reverse to preserve DOM positions.
    const reversedSections = [...sections].reverse();
    const blockSelectors = getBlockInstanceSelectors(payload.template);

    let markersInserted = 0;
    for (const section of reversedSections) {
      const sectionEl = findSectionElement(element, section.selector);
      if (!sectionEl) {
        console.warn(`[sections] Section "${section.id}" selector not found: ${JSON.stringify(section.selector)}`);
        continue;
      }

      // Insert a marker div BEFORE the section element (except first section)
      if (section.id !== sections[0].id) {
        const marker = doc.createElement('div');
        marker.setAttribute(MARKER_ATTR, section.id);
        if (section.style) {
          marker.setAttribute('data-section-style', section.style);
        }
        marker.style.display = 'none';

        // Check if sectionEl is inside a block instance element.
        // If so, place marker before the outermost block ancestor to
        // prevent the marker from being destroyed when parsers replace
        // the block instance with a table.
        const blockAncestor = findOutermostBlockAncestor(sectionEl, element, blockSelectors);
        if (blockAncestor) {
          blockAncestor.before(marker);
        } else {
          sectionEl.before(marker);
        }
        markersInserted++;
      }
    }

    // Phase 1b: Extract default content elements that are trapped inside block
    // instance elements. Parsers will replace block instances with tables,
    // destroying anything inside them. Move default content (headings, etc.)
    // just before the outermost block ancestor so they survive parsing.
    for (const section of sections) {
      if (!section.defaultContent || section.defaultContent.length === 0) continue;

      for (const dcSelector of section.defaultContent) {
        const dcElements = element.querySelectorAll(dcSelector);
        dcElements.forEach((dcEl) => {
          const blockAncestor = findOutermostBlockAncestor(dcEl, element, blockSelectors);
          if (blockAncestor) {
            // Move element out of the block instance, placing it just before
            blockAncestor.before(dcEl);
          }
        });
      }
    }
  }

  if (hookName === TransformHook.afterTransform) {
    // Phase 2: Walk the DOM tree depth-first to collect all meaningful content
    // and markers in document order. Content may be deeply nested inside wrapper
    // divs; markers are siblings of the (now-replaced) block elements.
    const items = [];
    (function collect(node) {
      const children = node.children ? [...node.children] : [];
      children.forEach((child) => {
        if (child.nodeType !== 1) return;

        // Section marker
        if (child.hasAttribute(MARKER_ATTR)) {
          items.push({ type: 'marker', style: child.getAttribute('data-section-style') || null });
          return;
        }

        // Block table (created by parsers — identified by having a <th> header)
        if (child.tagName === 'TABLE' && child.querySelector('th')) {
          items.push({ type: 'content', node: child });
          return;
        }

        // Headings (default content)
        if (/^H[1-6]$/.test(child.tagName)) {
          items.push({ type: 'content', node: child });
          return;
        }

        // Paragraphs with text or images
        if (child.tagName === 'P' && (child.textContent.trim() || child.querySelector('img, picture'))) {
          items.push({ type: 'content', node: child });
          return;
        }

        // Standalone spans with text (e.g. Terms & Conditions content)
        if (child.tagName === 'SPAN' && child.textContent.trim().length > 20) {
          items.push({ type: 'content', node: child });
          return;
        }

        // Recurse into container elements (divs, sections, etc.)
        collect(child);
      });
    })(element);

    // Group collected items into sections (markers delimit section boundaries)
    const sectionGroups = [{ style: null, nodes: [] }]; // Section 1 has no marker

    for (const item of items) {
      if (item.type === 'marker') {
        sectionGroups.push({ style: item.style, nodes: [] });
      } else {
        sectionGroups[sectionGroups.length - 1].nodes.push(item.node);
      }
    }

    // Clear the root element
    while (element.firstChild) element.firstChild.remove();

    // Rebuild flat structure with section breaks
    sectionGroups.forEach((section, i) => {
      // Add <hr> section break before each section except the first
      if (i > 0) {
        element.appendChild(doc.createElement('hr'));
      }

      // Add section content
      section.nodes.forEach((node) => element.appendChild(node));

      // Add Section Metadata at the end of the section (if it has a style)
      if (section.style) {
        element.appendChild(WebImporter.Blocks.createBlock(doc, {
          name: 'Section Metadata',
          cells: { style: section.style },
        }));
      }
    });
  }
}
