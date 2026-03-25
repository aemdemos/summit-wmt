/**
 * Browser-side footer section detection — passed to page.evaluate(fn, mode).
 * Self-contained (no module-level helpers) so Playwright serializes the full function.
 *
 * @param {'desktop'|'mobile'} mode
 * @returns {object} phase-1 shape + optional error
 */
export function runFooterSectionDetection(mode) {
  function pickBestFooterCandidate(nodes) {
    const out = [];
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const r = n.getBoundingClientRect();
      const st = window.getComputedStyle(n);
      if (r.height < 40 || st.display === 'none' || st.visibility === 'hidden') continue;
      out.push({ n, r, area: r.width * r.height, bottom: r.bottom });
    }
    if (out.length === 0) return null;
    out.sort((a, b) => b.bottom - a.bottom || b.area - a.area);
    return out[0].n;
  }

  function findFooterRoot() {
    const semantic = document.querySelector('footer, [role="contentinfo"]');
    if (semantic) return semantic;

    const idHits = [];
    const withId = document.querySelectorAll('[id]');
    for (let i = 0; i < withId.length; i++) {
      const node = withId[i];
      const id = (node.id || '').toLowerCase().replace(/[-_]/g, '');
      if (/\bfooter\b|pagefooter|sitefooter|globalfooter/.test(id)) idHits.push(node);
    }
    if (idHits.length > 0) {
      const picked = pickBestFooterCandidate(idHits);
      if (picked) return picked;
    }

    const classHits = [];
    const blocks = document.querySelectorAll('div, section, aside');
    for (let i = 0; i < blocks.length; i++) {
      const node = blocks[i];
      const cls = (node.className || '').toString().toLowerCase();
      if (!cls) continue;
      if (/\bfooter\b|site-footer|page-footer|global-footer|pagefooter/.test(cls)) classHits.push(node);
    }
    if (classHits.length > 0) {
      const picked = pickBestFooterCandidate(classHits);
      if (picked) return picked;
    }

    return null;
  }

  const footer = findFooterRoot();
  if (!footer) {
    return {
      sectionCount: 0,
      sections: [],
      error: 'no footer found',
      totalHeightPx: 0,
      footerHeightForSanity: 0,
    };
  }

  const sections = [];
  const directChildren = footer.querySelectorAll(':scope > div, :scope > section, :scope > nav, :scope > form');
  const isDesktop = mode === 'desktop';

  if (directChildren.length === 0) {
    const rect = footer.getBoundingClientRect();
    if (isDesktop) {
      sections.push({
        index: 0,
        tag: footer.tagName.toLowerCase(),
        heightPx: Math.round(rect.height),
        hasImages: footer.querySelectorAll('img, svg').length > 0,
        hasLinks: footer.querySelectorAll('a').length > 0,
        linkCount: footer.querySelectorAll('a').length,
        hasForm: footer.querySelectorAll('form, input, textarea').length > 0,
        hasSocialIcons: !!footer.querySelector('[class*="social"], [class*="icon"], [aria-label*="social"]'),
        hasVideo: footer.querySelectorAll('video').length > 0,
        bg: window.getComputedStyle(footer).backgroundColor,
      });
    } else {
      sections.push({
        index: 0,
        tag: footer.tagName.toLowerCase(),
        heightPx: Math.round(rect.height),
        hasImages: footer.querySelectorAll('img, svg').length > 0,
        imageCount: footer.querySelectorAll('img, svg').length,
        linkCount: footer.querySelectorAll('a').length,
        hasForm: footer.querySelectorAll('form, input, textarea').length > 0,
        hasSocialIcons: !!footer.querySelector('[class*="social"], [class*="icon"], [aria-label*="social"]'),
        hasVideo: footer.querySelectorAll('video').length > 0,
        hasLocaleSelector: footer.querySelectorAll('select, [class*="locale"], [class*="language"], [class*="country"]').length > 0,
      });
    }
  } else {
    directChildren.forEach((el, i) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      if (rect.height <= 0 || style.display === 'none' || style.visibility === 'hidden') return;
      const links = el.querySelectorAll('a');
      const imgs = el.querySelectorAll('img, svg');
      const forms = el.querySelectorAll('form, input[type="email"], input[type="text"], textarea');
      const socialEl = el.querySelector('[class*="social"], [class*="icon"], [aria-label*="social"]');
      const videos = el.querySelectorAll('video');
      const selects = el.querySelectorAll('select, [class*="locale"], [class*="language"], [class*="country"]');

      if (isDesktop) {
        sections.push({
          index: i,
          tag: el.tagName.toLowerCase(),
          className: (el.className || '').toString().slice(0, 80),
          top: Math.round(rect.top),
          heightPx: Math.round(rect.height),
          hasImages: imgs.length > 0,
          imageCount: imgs.length,
          hasLinks: links.length > 0,
          linkCount: links.length,
          hasForm: forms.length > 0,
          formFieldCount: forms.length,
          hasSocialIcons: !!socialEl,
          hasVideo: videos.length > 0,
          hasLocaleSelector: selects.length > 0,
          bg: style.backgroundColor,
        });
      } else {
        sections.push({
          index: i,
          tag: el.tagName.toLowerCase(),
          heightPx: Math.round(rect.height),
          hasImages: imgs.length > 0,
          imageCount: imgs.length,
          linkCount: links.length,
          hasForm: forms.length > 0,
          hasSocialIcons: !!socialEl,
          hasVideo: videos.length > 0,
          hasLocaleSelector: selects.length > 0,
        });
      }
    });
  }

  const footerRect = footer.getBoundingClientRect();
  return {
    sectionCount: sections.length,
    sections,
    totalHeightPx: Math.round(footerRect.height),
    footerHeightForSanity: footerRect.height,
  };
}
