import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

const PRIVACY_ICON_SRC = '//i5.walmartimages.com/dfw/63fd9f59-4be1/0e321069-d42a-42ae-9b17-6987bf35d3ad/v1/privacy-choices-dweb.png';

/**
 * Find the first link inside an element.
 * AEM wraps links in <p> tags in .plain.html.
 */
function findLink(el) {
  return el.querySelector(':scope > a') || el.querySelector(':scope > p > a');
}

/**
 * Build the feedback band (section 1).
 * @param {Element} section The first section div from the fragment
 * @returns {HTMLElement}
 */
function buildFeedbackBand(section) {
  const band = document.createElement('div');
  band.className = 'footer-feedback';
  band.setAttribute('role', 'region');
  band.setAttribute('aria-label', 'Give feedback');

  const inner = document.createElement('div');
  inner.className = 'footer-feedback-inner';

  // Heading
  const heading = section.querySelector('h2, h3, h1');
  if (heading) {
    const h = document.createElement('span');
    h.className = 'footer-feedback-heading';
    h.textContent = heading.textContent.trim();
    inner.append(h);
  }

  // CTA button
  const link = findLink(section) || section.querySelector('a');
  if (link) {
    const btn = document.createElement('a');
    btn.className = 'footer-feedback-btn';
    btn.href = link.href || '#';
    btn.textContent = link.textContent.trim();
    if (link.getAttribute('target')) btn.target = link.getAttribute('target');
    if (link.getAttribute('rel')) btn.rel = link.getAttribute('rel');
    inner.append(btn);
  }

  band.append(inner);
  return band;
}

/**
 * Build the legal/links band (section 2).
 * @param {Element} section The second section div from the fragment
 * @returns {HTMLElement}
 */
function buildLegalBand(section) {
  const band = document.createElement('div');
  band.className = 'footer-legal';

  const inner = document.createElement('div');
  inner.className = 'footer-legal-inner';

  // Link list
  const ul = section.querySelector('ul');
  if (ul) {
    const list = document.createElement('ul');
    list.className = 'footer-links';

    ul.querySelectorAll(':scope > li').forEach((li) => {
      const a = li.querySelector('a');
      if (!a) return;

      const item = document.createElement('li');
      item.className = 'footer-link-item';

      const link = document.createElement('a');
      link.className = 'footer-link';
      link.href = a.href || a.getAttribute('href') || '#';
      link.textContent = a.textContent.trim();

      // Preserve external link attributes
      if (a.getAttribute('target')) link.target = a.getAttribute('target');
      if (a.getAttribute('rel')) link.rel = a.getAttribute('rel');
      if (a.getAttribute('aria-label')) link.setAttribute('aria-label', a.getAttribute('aria-label'));
      if (a.getAttribute('title')) link.title = a.getAttribute('title');

      // Privacy choices icon
      if (a.classList.contains('privacy-choices')
        || a.textContent.trim().toLowerCase().includes('your privacy choices')) {
        const icon = document.createElement('img');
        icon.src = PRIVACY_ICON_SRC;
        icon.width = 29;
        icon.height = 14;
        icon.loading = 'lazy';
        icon.alt = '';
        icon.setAttribute('aria-hidden', 'true');
        icon.className = 'footer-privacy-icon';
        link.prepend(icon);
        link.classList.add('footer-link-privacy');
      }

      item.append(link);
      list.append(item);
    });

    inner.append(list);
  }

  // Copyright
  const paragraphs = section.querySelectorAll('p');
  paragraphs.forEach((p) => {
    // Skip paragraphs that only contain links (those are inside the ul already)
    if (p.querySelector('a') && !p.textContent.includes('©') && !p.textContent.includes('trademark')) return;
    if (p.textContent.trim() && (p.textContent.includes('©') || p.textContent.includes('trademark') || p.textContent.includes('Walmart'))) {
      const copy = document.createElement('p');
      copy.className = 'footer-copyright';
      copy.textContent = p.textContent.trim();
      inner.append(copy);
    }
  });

  band.append(inner);
  return band;
}

/**
 * Loads and decorates the footer.
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  const footerMeta = getMetadata('footer');
  const footerPath = footerMeta ? new URL(footerMeta, window.location).pathname : '/footer';
  const fragment = await loadFragment(footerPath);

  block.textContent = '';

  if (!fragment) return;

  // Collect all sections from the fragment
  const sections = [...fragment.querySelectorAll(':scope .section')];

  // Section 0 = feedback band, Section 1 = legal/links band
  const feedbackSection = sections[0];
  const legalSection = sections[1];

  if (feedbackSection) {
    block.append(buildFeedbackBand(feedbackSection));
  }

  if (legalSection) {
    block.append(buildLegalBand(legalSection));
  }
}
