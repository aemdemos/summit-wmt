var CustomImportScript = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // tools/importer/import-get-it-fast.js
  var import_get_it_fast_exports = {};
  __export(import_get_it_fast_exports, {
    default: () => import_get_it_fast_default
  });

  // tools/importer/parsers/hero.js
  function deduplicateText(text) {
    if (!text || text.length < 2) return text;
    const len = text.length;
    if (len % 2 === 0) {
      const half = text.substring(0, len / 2);
      if (text === half + half) return half;
    }
    return text;
  }
  function parse(element, { document: document2 }) {
    const bgImage = element.querySelector(
      'img[class*="absolute--fill"], img.absolute, img[aria-hidden="true"], section.w-50 img'
    );
    let heading = null;
    const headingCandidates = element.querySelectorAll(
      'h1, h2, span.b[class*="f-subheadline"], span.b[class*="f1-ns"]'
    );
    for (const h of headingCandidates) {
      const nestedSection = h.closest("section[data-dca-id]");
      if (nestedSection && nestedSection !== element && element.contains(nestedSection)) continue;
      heading = h;
      break;
    }
    const altHeading = !heading ? element.querySelector('p.b[class*="f12"], p.b[class*="f10"], p.b[id^="heading-"]') : null;
    const finalHeading = heading || altHeading;
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
    const ctaCandidates = element.querySelectorAll(
      'a[link-identifier]:not([aria-label*="Previous"]):not([aria-label*="Next"]):not([class*="nav-control"]), a[class*="br-pill"]:not([class*="nav-control"])'
    );
    let cta = null;
    for (const link of ctaCandidates) {
      const textOnly = link.textContent.replace(/\s+/g, "").replace(link.querySelector("img")?.alt || "", "");
      if (textOnly || !link.querySelector("img") && link.textContent.trim()) {
        cta = link;
        break;
      }
    }
    if (!cta && ctaCandidates.length > 0) cta = ctaCandidates[0];
    const overlayImages = [];
    if (bgImage) {
      const bgParent = bgImage.parentElement;
      if (bgParent) {
        const siblingImgs = bgParent.querySelectorAll('img[class*="absolute"]');
        siblingImgs.forEach((img) => {
          if (img === bgImage) return;
          if (!img.src) return;
          if (img.className.includes("absolute--fill")) return;
          if (img.closest('li, ul, [role="group"], [data-testid*="carousel"]')) return;
          overlayImages.push(img);
        });
      }
    }
    const contentCell = [];
    if (bgImage) {
      const img = document2.createElement("img");
      img.src = bgImage.src || bgImage.getAttribute("src") || "";
      img.alt = bgImage.alt || bgImage.getAttribute("alt") || "";
      contentCell.push(img);
    }
    if (overlayImages.length > 0) {
      const wrapper = document2.createElement("em");
      overlayImages.forEach((overlayImg) => {
        const img = document2.createElement("img");
        img.src = overlayImg.src || overlayImg.getAttribute("src") || "";
        img.alt = overlayImg.alt || overlayImg.getAttribute("alt") || "";
        wrapper.append(img);
      });
      contentCell.push(wrapper);
    }
    if (finalHeading) {
      const h = document2.createElement("h1");
      h.textContent = finalHeading.textContent.trim();
      contentCell.push(h);
    }
    if (subheading) {
      const p = document2.createElement("p");
      p.textContent = subheading.textContent.trim();
      contentCell.push(p);
    }
    if (cta) {
      const a = document2.createElement("a");
      a.href = cta.href || cta.getAttribute("href") || "";
      a.textContent = deduplicateText(cta.textContent.trim()) || "Learn more";
      const strong = document2.createElement("strong");
      strong.append(a);
      contentCell.push(strong);
    }
    const cells = [[contentCell]];
    const block = WebImporter.Blocks.createBlock(document2, { name: "hero", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/cards.js
  function deduplicateText2(text) {
    if (!text || text.length < 2) return text;
    const len = text.length;
    if (len % 2 === 0) {
      const half = text.substring(0, len / 2);
      if (text === half + half) return half;
    }
    return text;
  }
  function parse2(element, { document: document2 }) {
    const cells = [];
    const hubCards = element.querySelectorAll('[role="listitem"]');
    if (hubCards.length > 0) {
      hubCards.forEach((card) => {
        const img = card.querySelector("img");
        const label = card.querySelector('span.ld_A3, span[class*="mid-gray"]');
        const link = card.querySelector("a[link-identifier], a[href]");
        const imageCell = [];
        if (img) {
          const newImg = document2.createElement("img");
          newImg.src = img.src || img.getAttribute("src") || "";
          newImg.alt = label ? label.textContent.trim() : img.alt || "";
          imageCell.push(newImg);
        }
        const textCell = [];
        if (label) {
          const strong = document2.createElement("strong");
          if (link) {
            const a = document2.createElement("a");
            a.href = link.href || link.getAttribute("href") || "";
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
    if (hubCards.length === 0) {
      const cardWrappers = element.querySelectorAll(".card-wrapper");
      cardWrappers.forEach((wrapper) => {
        const img = wrapper.querySelector('img[id*="PrismCollectionCarousel"]');
        if (!img) return;
        const heading = wrapper.querySelector('p.b[id^="heading-"]');
        const eyebrow = wrapper.querySelector('p.b:not([id^="heading-"])');
        const cta = wrapper.querySelector("a[link-identifier]:not(.absolute)");
        const imageCell = [];
        const newImg = document2.createElement("img");
        newImg.src = img.src || img.getAttribute("src") || "";
        newImg.alt = heading ? heading.textContent.trim() : img.alt || "";
        imageCell.push(newImg);
        const textCell = [];
        if (heading) {
          const strong = document2.createElement("strong");
          strong.textContent = heading.textContent.trim();
          textCell.push(strong);
        }
        if (eyebrow) {
          const p = document2.createElement("p");
          p.textContent = eyebrow.textContent.trim();
          textCell.push(p);
        }
        if (cta) {
          const a = document2.createElement("a");
          a.href = cta.href || cta.getAttribute("href") || "";
          a.textContent = deduplicateText2(cta.textContent.trim());
          textCell.push(a);
        }
        if (imageCell.length || textCell.length) {
          cells.push([imageCell, textCell]);
        }
      });
    }
    const block = WebImporter.Blocks.createBlock(document2, { name: "cards", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/card-carousel-bidirectional.js
  function parse3(element, { document: document2 }) {
    const cells = [];
    const items = element.querySelectorAll('ul[data-testid="carousel-container"] > li');
    items.forEach((item) => {
      const img = item.querySelector('img[data-testid="productTileImage"]');
      const titleEl = item.querySelector("span.ld_A3 h3, h3.normal");
      const link = item.querySelector('a[href*="/ip/"]');
      const priceScreen = item.querySelector("span.ld_FS");
      const priceText = priceScreen ? priceScreen.textContent.trim() : "";
      const priceMatch = priceText.match(/current price \$([\d.]+)/);
      const imageCell = [];
      if (img) {
        const newImg = document2.createElement("img");
        newImg.src = img.src || img.getAttribute("src") || "";
        newImg.alt = titleEl ? titleEl.textContent.trim() : img.alt || "";
        imageCell.push(newImg);
      }
      const textCell = [];
      if (titleEl) {
        const strong = document2.createElement("strong");
        strong.textContent = titleEl.textContent.trim();
        textCell.push(strong);
      }
      if (priceMatch) {
        const p = document2.createElement("p");
        p.textContent = `$${priceMatch[1]}`;
        textCell.push(p);
      }
      if (link) {
        const a = document2.createElement("a");
        a.href = link.href || link.getAttribute("href") || "";
        a.textContent = "+Add";
        textCell.push(a);
      }
      if (imageCell.length || textCell.length) {
        cells.push([imageCell, textCell]);
      }
    });
    const block = WebImporter.Blocks.createBlock(document2, { name: "card-carousel-bidirectional", cells });
    element.replaceWith(block);
  }

  // tools/importer/transformers/walmart-cleanup.js
  var TransformHook = { beforeTransform: "beforeTransform", afterTransform: "afterTransform" };
  function transform(hookName, element, payload) {
    if (hookName === TransformHook.beforeTransform) {
      WebImporter.DOMUtils.remove(element, ["script", "style", "noscript", "link"]);
      const carouselSelectors = [
        '[data-testid="horizontal-scroller-Product Carousel"]',
        '[data-testid="horizontal-scroller-One and two sku"]'
      ];
      carouselSelectors.forEach((sel) => {
        const carousel = element.querySelector(sel);
        if (!carousel) return;
        const heroParent = carousel.closest('[data-dca-id="M:F1F94AD6C9"]') || carousel.closest('div.mv3[role="region"]');
        if (heroParent && heroParent.contains(carousel)) {
          heroParent.after(carousel);
        }
      });
    }
    if (hookName === TransformHook.afterTransform) {
      WebImporter.DOMUtils.remove(element, ["header", "footer", "nav", "iframe"]);
      element.querySelectorAll("*").forEach((el) => {
        el.removeAttribute("data-track");
        el.removeAttribute("onclick");
        el.removeAttribute("data-dca-guid");
      });
    }
  }

  // tools/importer/transformers/walmart-sections.js
  var TransformHook2 = { beforeTransform: "beforeTransform", afterTransform: "afterTransform" };
  var MARKER_ATTR = "data-section-marker";
  function findSectionElement(main, selector) {
    if (Array.isArray(selector)) {
      for (const sel of selector) {
        const el = findSectionElement(main, sel);
        if (el) return el;
      }
      return null;
    }
    const nthMatch = selector.match(/^(.+)@nth\((\d+)\)$/);
    if (nthMatch) {
      const baseSelector = nthMatch[1];
      const index = parseInt(nthMatch[2], 10);
      const elements = main.querySelectorAll(baseSelector);
      return elements[index] || null;
    }
    return main.querySelector(selector);
  }
  function getBlockInstanceSelectors(template) {
    if (!template || !template.blocks) return [];
    const selectors = [];
    template.blocks.forEach((blockDef) => {
      blockDef.instances.forEach((sel) => selectors.push(sel));
    });
    return selectors;
  }
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
        }
      }
      current = current.parentElement;
    }
    return outermost;
  }
  function transform2(hookName, element, payload) {
    const doc = element.ownerDocument || document;
    const sections = payload && payload.template && payload.template.sections;
    if (!sections || sections.length < 2) return;
    if (hookName === TransformHook2.beforeTransform) {
      const reversedSections = [...sections].reverse();
      const blockSelectors = getBlockInstanceSelectors(payload.template);
      let markersInserted = 0;
      for (const section of reversedSections) {
        const sectionEl = findSectionElement(element, section.selector);
        if (!sectionEl) {
          console.warn(`[sections] Section "${section.id}" selector not found: ${JSON.stringify(section.selector)}`);
          continue;
        }
        if (section.id !== sections[0].id) {
          const marker = doc.createElement("div");
          marker.setAttribute(MARKER_ATTR, section.id);
          if (section.style) {
            marker.setAttribute("data-section-style", section.style);
          }
          marker.style.display = "none";
          const blockAncestor = findOutermostBlockAncestor(sectionEl, element, blockSelectors);
          if (blockAncestor) {
            blockAncestor.before(marker);
          } else {
            sectionEl.before(marker);
          }
          markersInserted++;
        }
      }
      for (const section of sections) {
        if (!section.defaultContent || section.defaultContent.length === 0) continue;
        for (const dcSelector of section.defaultContent) {
          const dcElements = element.querySelectorAll(dcSelector);
          dcElements.forEach((dcEl) => {
            const blockAncestor = findOutermostBlockAncestor(dcEl, element, blockSelectors);
            if (blockAncestor) {
              blockAncestor.before(dcEl);
            }
          });
        }
      }
    }
    if (hookName === TransformHook2.afterTransform) {
      const items = [];
      (function collect(node) {
        const children = node.children ? [...node.children] : [];
        children.forEach((child) => {
          if (child.nodeType !== 1) return;
          if (child.hasAttribute(MARKER_ATTR)) {
            items.push({ type: "marker", style: child.getAttribute("data-section-style") || null });
            return;
          }
          if (child.tagName === "TABLE" && child.querySelector("th")) {
            items.push({ type: "content", node: child });
            return;
          }
          if (/^H[1-6]$/.test(child.tagName)) {
            items.push({ type: "content", node: child });
            return;
          }
          if (child.tagName === "P" && (child.textContent.trim() || child.querySelector("img, picture"))) {
            items.push({ type: "content", node: child });
            return;
          }
          if (child.tagName === "SPAN" && child.textContent.trim().length > 20) {
            items.push({ type: "content", node: child });
            return;
          }
          collect(child);
        });
      })(element);
      const sectionGroups = [{ style: null, nodes: [] }];
      for (const item of items) {
        if (item.type === "marker") {
          sectionGroups.push({ style: item.style, nodes: [] });
        } else {
          sectionGroups[sectionGroups.length - 1].nodes.push(item.node);
        }
      }
      while (element.firstChild) element.firstChild.remove();
      sectionGroups.forEach((section, i) => {
        if (i > 0) {
          element.appendChild(doc.createElement("hr"));
        }
        section.nodes.forEach((node) => element.appendChild(node));
        if (section.style) {
          element.appendChild(WebImporter.Blocks.createBlock(doc, {
            name: "Section Metadata",
            cells: { style: section.style }
          }));
        }
      });
    }
  }

  // tools/importer/import-get-it-fast.js
  var parsers = {
    "hero": parse,
    "cards": parse2,
    "card-carousel-bidirectional": parse3
  };
  var PAGE_TEMPLATE = {
    name: "get-it-fast",
    description: "Walmart Get It Fast fulfillment landing page with hero banners, category card grids, product carousels, and promotional tiles",
    urls: [
      "http://localhost:8888/"
    ],
    blocks: [
      {
        name: "hero",
        instances: [
          '[data-testid="skinny-banner"]',
          '[data-dca-id="M:F1F94AD6C9"]',
          '[data-dca-id="M:6D7CF9AB52"]',
          "div.mv3[role=region]"
        ]
      },
      {
        name: "cards",
        instances: [
          '[data-testid="HubSpokesNxM"]',
          '[data-dca-id="M:7841184E2C"]'
        ]
      },
      {
        name: "card-carousel-bidirectional",
        instances: [
          '[data-testid="horizontal-scroller-Product Carousel"]'
        ]
      },
      {
        name: "card-carousel-bidirectional",
        instances: [
          '[data-testid="horizontal-scroller-One and two sku"]'
        ]
      }
    ],
    sections: [
      {
        id: "section-1",
        name: "Page Title",
        selector: "main h1",
        style: null,
        blocks: [],
        defaultContent: ["main h1"]
      },
      {
        id: "section-2",
        name: "Hero Banner - Delivery Promise",
        selector: '[data-dca-id="M:8C60EE984E"]',
        style: null,
        blocks: ["hero"],
        defaultContent: []
      },
      {
        id: "section-3",
        name: "Weekly Musts Category Cards",
        selector: 'section[data-dca-id="M:1F5D2073D5"]@nth(0)',
        style: null,
        blocks: ["cards"],
        defaultContent: ['section[data-dca-id="M:1F5D2073D5"]:first-of-type h2']
      },
      {
        id: "section-4",
        name: "1-Hour Delivery Category Cards",
        selector: 'section[data-dca-id="M:1F5D2073D5"]@nth(1)',
        style: null,
        blocks: ["cards"],
        defaultContent: ['section[data-dca-id="M:1F5D2073D5"]:last-of-type h2']
      },
      {
        id: "section-5",
        name: "Spring Cleaning Hero + Product Carousel",
        selector: [
          '[data-dca-id="M:F1F94AD6C9"]',
          '[data-dca-id="M:9B63096861"]'
        ],
        style: null,
        blocks: ["hero", "card-carousel-bidirectional"],
        defaultContent: [
          '[data-dca-id="M:DF16D9EFF8"] h2',
          '[data-dca-id="M:DF16D9EFF8"] h3'
        ]
      },
      {
        id: "section-6",
        name: "Spring Flowers Banner",
        selector: '[data-dca-id="M:6D7CF9AB52"]',
        style: "light-grey",
        blocks: ["hero"],
        defaultContent: []
      },
      {
        id: "section-7",
        name: "Allergy Relief & Essentials Collection",
        selector: '[data-dca-id="M:7841184E2C"]',
        style: null,
        blocks: ["cards"],
        defaultContent: []
      },
      {
        id: "section-8",
        name: "University FanCards",
        selector: '[data-dca-id="M:470F3095A8"]',
        style: null,
        blocks: ["hero", "card-carousel-bidirectional"],
        defaultContent: []
      },
      {
        id: "section-9",
        name: "Terms & Conditions",
        selector: "div.dark-gray.mh3.mh0-l.mv3.mv4-l",
        style: null,
        blocks: [],
        defaultContent: ["div.dark-gray.mh3 h1", "div.dark-gray.mh3 span"]
      }
    ]
  };
  var transformers = [
    transform,
    ...PAGE_TEMPLATE.sections && PAGE_TEMPLATE.sections.length > 1 ? [transform2] : []
  ];
  function executeTransformers(hookName, element, payload) {
    const enhancedPayload = {
      ...payload,
      template: PAGE_TEMPLATE
    };
    transformers.forEach((transformerFn) => {
      try {
        transformerFn.call(null, hookName, element, enhancedPayload);
      } catch (e) {
        console.error(`Transformer failed at ${hookName}:`, e);
      }
    });
  }
  function findBlocksOnPage(document2, template) {
    const pageBlocks = [];
    template.blocks.forEach((blockDef) => {
      blockDef.instances.forEach((selector) => {
        const elements = document2.querySelectorAll(selector);
        if (elements.length === 0) {
          console.warn(`Block "${blockDef.name}" selector not found: ${selector}`);
        }
        elements.forEach((element) => {
          pageBlocks.push({
            name: blockDef.name,
            selector,
            element,
            section: blockDef.section || null
          });
        });
      });
    });
    console.log(`Found ${pageBlocks.length} block instances on page`);
    return pageBlocks;
  }
  var import_get_it_fast_default = {
    transform: (payload) => {
      const { document: document2, url, html, params } = payload;
      const main = document2.body;
      executeTransformers("beforeTransform", main, payload);
      const pageBlocks = findBlocksOnPage(document2, PAGE_TEMPLATE);
      pageBlocks.forEach((block) => {
        const parser = parsers[block.name];
        if (parser) {
          try {
            console.log(`Parsing block: ${block.name} (${block.selector})`);
            parser(block.element, { document: document2, url, params });
            console.log(`Parsed block: ${block.name} OK`);
          } catch (e) {
            console.error(`Failed to parse ${block.name} (${block.selector}):`, e.message || e);
          }
        } else {
          console.warn(`No parser found for block: ${block.name}`);
        }
      });
      executeTransformers("afterTransform", main, payload);
      const hr = document2.createElement("hr");
      main.appendChild(hr);
      WebImporter.rules.createMetadata(main, document2);
      WebImporter.rules.transformBackgroundImages(main, document2);
      WebImporter.rules.adjustImageUrls(main, url, params.originalURL);
      const sourceUrl = params && params.originalURL || url;
      let path;
      try {
        path = new URL(sourceUrl).pathname.replace(/\/$/, "").replace(/\.html$/, "") || "/index";
      } catch (e) {
        path = "/index";
      }
      return [{
        element: main,
        path,
        report: {
          title: document2.title,
          template: PAGE_TEMPLATE.name,
          blocks: pageBlocks.map((b) => b.name)
        }
      }];
    }
  };
  return __toCommonJS(import_get_it_fast_exports);
})();
