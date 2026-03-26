import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

const MQ_DESKTOP = window.matchMedia('(min-width: 900px)');

/* eslint-disable max-len, browser-security/no-innerhtml */
/* ── Inline SVG icons (static, trusted strings) ──────────── */
const ICON = {
  hamburger: '<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
  close: '<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>',
  search: '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="10" cy="10" r="7"/><line x1="15" y1="15" x2="19" y2="19"/></svg>',
  person: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  cart: '<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
  heart: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  location: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>',
  chevronDown: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 8 11 13 6"/></svg>',
  store: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9l1-4h16l1 4"/><path d="M3 9v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9"/><path d="M9 21V13h6v8"/><path d="M3 9c0 1.1.9 2 2 2s2-.9 2-2m0 0c0 1.1.9 2 2 2s2-.9 2-2m0 0c0 1.1.9 2 2 2s2-.9 2-2m0 0c0 1.1.9 2 2 2s2-.9 2-2"/></svg>',
  chevronRight: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 3 11 8 6 13"/></svg>',
  mapPin: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
};
/* eslint-enable max-len */

/* ── Helpers ────────────────────────────────────────────── */

function closeAllMenus(nav) {
  nav.querySelectorAll('.nav-megamenu-trigger[aria-expanded="true"]').forEach((t) => {
    t.setAttribute('aria-expanded', 'false');
  });
  nav.querySelectorAll('.nav-megamenu-panel.is-open').forEach((p) => {
    p.classList.remove('is-open');
  });
  const overlay = nav.querySelector('.nav-overlay');
  if (overlay) overlay.classList.remove('is-open');
}

function activateRailItem(panel, index) {
  panel.querySelectorAll('.megamenu-rail-item').forEach((ri, i) => {
    ri.classList.toggle('is-active', i === index);
    ri.setAttribute('aria-selected', i === index ? 'true' : 'false');
  });
  panel.querySelectorAll('.megamenu-subpanel').forEach((sp, i) => {
    sp.classList.toggle('is-active', i === index);
  });
}

/* ── Promo card data for special megamenu categories ──── */
const MEGAMENU_PROMOS = {
  'Local Finds': {
    img: 'https://i5.walmartimages.com/dfw/4ff9c6c9-6a06/k2-_2b831da9-f697-492d-85b7-5d3b03527088.v1.png?odnHeight=142px&odnWidth=142px&odnBg=FFFFFF',
    title: 'LocalFinds',
    desc: 'Specialty goods from the neighborhood.',
    cta: 'Shop Now',
    href: 'https://www.walmart.com/global/localfinds?povid=GlobalNav_rWeb_LocalFinds',
  },
};

function buildMegamenuPanel(menuLi) {
  const panel = document.createElement('div');
  panel.className = 'nav-megamenu-panel';
  panel.setAttribute('role', 'region');

  const rail = document.createElement('div');
  rail.className = 'megamenu-rail';
  rail.setAttribute('role', 'listbox');

  const content = document.createElement('div');
  content.className = 'megamenu-content';

  const menuLink = menuLi.querySelector(':scope > a');
  const menuName = menuLink ? menuLink.textContent.trim() : '';
  const railTitle = document.createElement('div');
  railTitle.className = 'megamenu-rail-title';
  railTitle.textContent = `All ${menuName}`;
  rail.append(railTitle);

  const categories = menuLi.querySelectorAll(':scope > ul > li');
  categories.forEach((cat, i) => {
    const catLink = cat.querySelector(':scope > a');
    if (!catLink) return;

    // Rail button
    const railBtn = document.createElement('button');
    railBtn.className = 'megamenu-rail-item';
    railBtn.type = 'button';
    railBtn.setAttribute('role', 'option');
    railBtn.setAttribute('aria-selected', 'false');
    railBtn.textContent = catLink.textContent;

    railBtn.addEventListener('mouseenter', () => activateRailItem(panel, i));
    railBtn.addEventListener('focus', () => activateRailItem(panel, i));
    railBtn.addEventListener('click', () => activateRailItem(panel, i));
    rail.append(railBtn);

    // Sub-panel
    const subpanel = document.createElement('div');
    subpanel.className = 'megamenu-subpanel';

    const catName = catLink.textContent.trim();
    const promo = MEGAMENU_PROMOS[catName];

    if (promo) {
      // Promotional card subpanel (e.g. LocalFinds)
      subpanel.classList.add('megamenu-subpanel-promo');
      const card = document.createElement('div');
      card.className = 'megamenu-promo-card';
      const img = document.createElement('img');
      img.src = promo.img;
      img.alt = promo.title;
      img.width = 142;
      img.height = 142;
      img.loading = 'lazy';
      card.append(img);
      const title = document.createElement('h2');
      title.className = 'megamenu-promo-title';
      title.textContent = promo.title;
      card.append(title);
      const desc = document.createElement('p');
      desc.className = 'megamenu-promo-desc';
      desc.textContent = promo.desc;
      card.append(desc);
      const cta = document.createElement('a');
      cta.className = 'megamenu-promo-cta';
      cta.href = promo.href;
      cta.textContent = promo.cta;
      card.append(cta);
      subpanel.append(card);
    } else {
      const heading = document.createElement('a');
      heading.className = 'megamenu-subpanel-heading';
      heading.href = catLink.href;
      heading.textContent = catLink.title || catLink.textContent;
      subpanel.append(heading);

      // Detect subsection groups (indicated by <strong> in child items)
      const hasSubsections = cat.querySelector(':scope > ul > li > strong') !== null;

      if (hasSubsections) {
        const groups = document.createElement('div');
        groups.className = 'megamenu-subpanel-groups';
        cat.querySelectorAll(':scope > ul > li').forEach((subLi) => {
          const strong = subLi.querySelector(':scope > strong');
          if (!strong) return;
          const group = document.createElement('div');
          group.className = 'megamenu-subpanel-group';
          const groupTitle = document.createElement('div');
          groupTitle.className = 'megamenu-group-title';
          groupTitle.textContent = strong.textContent;
          group.append(groupTitle);
          const groupLinks = document.createElement('ul');
          groupLinks.className = 'megamenu-subpanel-links';
          subLi.querySelectorAll(':scope > ul > li').forEach((linkLi) => {
            const a = linkLi.querySelector('a');
            if (!a) return;
            const li = document.createElement('li');
            const link = document.createElement('a');
            link.href = a.href;
            link.textContent = a.textContent;
            li.append(link);
            groupLinks.append(li);
          });
          group.append(groupLinks);
          groups.append(group);
        });
        subpanel.append(groups);
      } else {
        const linkList = document.createElement('ul');
        linkList.className = 'megamenu-subpanel-links';
        cat.querySelectorAll(':scope > ul > li').forEach((subLi) => {
          const a = subLi.querySelector('a');
          if (!a) return;
          const li = document.createElement('li');
          const link = document.createElement('a');
          link.href = a.href;
          link.textContent = a.textContent;
          li.append(link);
          linkList.append(li);
        });
        subpanel.append(linkList);
      }
    }
    content.append(subpanel);
  });

  panel.append(rail, content);
  return panel;
}

function buildSearchForm(anchor) {
  const wrapper = document.createElement('div');
  wrapper.className = 'nav-search';

  const form = document.createElement('form');
  form.className = 'nav-search-form';
  form.action = anchor.href;
  form.method = 'get';
  form.setAttribute('role', 'search');

  const input = document.createElement('input');
  input.type = 'search';
  input.name = 'q';
  input.className = 'nav-search-input';
  input.placeholder = anchor.textContent;
  input.setAttribute('aria-label', anchor.textContent);
  input.autocomplete = 'off';

  const btn = document.createElement('button');
  btn.type = 'submit';
  btn.className = 'nav-search-btn';
  btn.setAttribute('aria-label', 'Search');
  btn.innerHTML = ICON.search;

  form.append(input, btn);
  wrapper.append(form);
  return wrapper;
}

function buildFulfillmentPanel() {
  const panel = document.createElement('div');
  panel.className = 'nav-fulfillment-panel';

  // Fulfillment options row
  const options = document.createElement('div');
  options.className = 'fulfillment-options';

  [
    { src: 'https://i5.walmartimages.com/dfw/4ff9c6c9-486e/k2-_4be6f532-b0b2-4480-bb65-d53586e87193.v1.png', label: 'Shipping' },
    { src: 'https://i5.walmartimages.com/dfw/4ff9c6c9-944a/k2-_333618e2-7327-4081-990e-7870dd062248.v1.png', label: 'Pickup' },
    { src: 'https://i5.walmartimages.com/dfw/4ff9c6c9-4637/k2-_c8d39665-dac4-474a-9fb7-ab5feeb647b5.v1.png', label: 'Delivery' },
  ].forEach(({ src, label }) => {
    const opt = document.createElement('button');
    opt.type = 'button';
    opt.className = 'fulfillment-option';
    const optIcon = document.createElement('span');
    optIcon.className = 'fulfillment-option-icon';
    const img = document.createElement('img');
    img.src = src;
    img.width = 50;
    img.height = 50;
    img.alt = '';
    img.loading = 'lazy';
    img.setAttribute('aria-hidden', 'true');
    optIcon.append(img);
    const optLabel = document.createElement('span');
    optLabel.className = 'fulfillment-option-label';
    optLabel.textContent = label;
    opt.append(optIcon, optLabel);
    options.append(opt);
  });
  panel.append(options);

  // Address card
  const addrCard = document.createElement('div');
  addrCard.className = 'fulfillment-card';
  const addrBody = document.createElement('div');
  addrBody.className = 'fulfillment-card-body';
  const addrIcon = document.createElement('span');
  addrIcon.className = 'fulfillment-card-icon';
  addrIcon.innerHTML = ICON.mapPin;
  const addrText = document.createElement('div');
  addrText.className = 'fulfillment-card-text';
  const addrHeading = document.createElement('span');
  addrHeading.className = 'fulfillment-card-heading';
  addrHeading.textContent = 'Add an address for shipping and delivery';
  const addrSub = document.createElement('span');
  addrSub.className = 'fulfillment-card-sub';
  addrSub.textContent = 'San Jose, CA 95134';
  addrText.append(addrHeading, addrSub);
  addrBody.append(addrIcon, addrText);
  const addrAction = document.createElement('button');
  addrAction.type = 'button';
  addrAction.className = 'fulfillment-card-btn';
  addrAction.textContent = 'Add address';
  addrCard.append(addrBody, addrAction);
  panel.append(addrCard);

  // Store card
  const storeCard = document.createElement('div');
  storeCard.className = 'fulfillment-card fulfillment-card-store';
  const storeBody = document.createElement('div');
  storeBody.className = 'fulfillment-card-body';
  const storeIcon = document.createElement('span');
  storeIcon.className = 'fulfillment-card-icon';
  storeIcon.innerHTML = ICON.store;
  const storeText = document.createElement('div');
  storeText.className = 'fulfillment-card-text';
  const storeHeading = document.createElement('span');
  storeHeading.className = 'fulfillment-card-heading';
  storeHeading.textContent = 'Milpitas Supercenter';
  const storeSub = document.createElement('span');
  storeSub.className = 'fulfillment-card-sub';
  storeSub.textContent = '301 RANCH DR, Milpitas, CA 95035';
  storeText.append(storeHeading, storeSub);
  const storeChevron = document.createElement('span');
  storeChevron.className = 'fulfillment-card-chevron';
  storeChevron.innerHTML = ICON.chevronRight;
  storeBody.append(storeIcon, storeText, storeChevron);
  storeCard.append(storeBody);
  panel.append(storeCard);

  return panel;
}

function toggleMobileMenu(nav, force) {
  const open = force !== undefined
    ? force
    : nav.getAttribute('aria-expanded') !== 'true';
  nav.setAttribute('aria-expanded', open ? 'true' : 'false');

  const btn = nav.querySelector('.nav-hamburger');
  if (btn) {
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    btn.innerHTML = open ? ICON.close : ICON.hamburger;
  }
  document.body.style.overflow = open && !MQ_DESKTOP.matches ? 'hidden' : '';
}

/* ── Main decorate ─────────────────────────────────────── */

// eslint-disable-next-line sonarjs/cognitive-complexity
export default async function decorate(block) {
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';
  const fragment = await loadFragment(navPath);
  if (!fragment) return;

  block.textContent = '';
  const nav = document.createElement('nav');
  nav.id = 'nav';
  nav.setAttribute('aria-label', 'Main navigation');
  nav.setAttribute('aria-expanded', 'false');

  // Move fragment sections into nav temporarily to read content
  while (fragment.firstElementChild) nav.append(fragment.firstElementChild);

  // 4 sections from nav.plain.html: brand, utilities, megamenus, pills
  const sectionEls = [...nav.querySelectorAll('.section')];
  const brandW = sectionEls[0]?.querySelector('.default-content-wrapper');
  const utilW = sectionEls[1]?.querySelector('.default-content-wrapper');
  const menuW = sectionEls[2]?.querySelector('.default-content-wrapper');
  const pillW = sectionEls[3]?.querySelector('.default-content-wrapper');

  // Clear nav — we rebuild the DOM
  nav.textContent = '';

  /* ── Row 0: Primary bar ──────────────────────────── */
  const primary = document.createElement('div');
  primary.className = 'nav-primary';

  const primaryInner = document.createElement('div');
  primaryInner.className = 'nav-primary-inner';

  // Hamburger
  const hamburger = document.createElement('button');
  hamburger.className = 'nav-hamburger';
  hamburger.type = 'button';
  hamburger.setAttribute('aria-label', 'Open navigation');
  hamburger.setAttribute('aria-expanded', 'false');
  hamburger.setAttribute('aria-controls', 'nav');
  hamburger.innerHTML = ICON.hamburger;
  primaryInner.append(hamburger);

  // Brand / logo
  if (brandW) {
    const origLink = brandW.querySelector('a');
    if (origLink) {
      const brand = document.createElement('a');
      brand.className = 'nav-brand';
      brand.href = origLink.href;
      brand.setAttribute('aria-label', origLink.title || 'Home');
      const img = origLink.querySelector('img');
      if (img) brand.append(img);
      primaryInner.append(brand);
    }
  }

  // Fulfillment trigger (desktop only)
  if (utilW) {
    const fulfilLink = utilW.querySelector('ul:first-of-type a');
    if (fulfilLink) {
      const fulfilWrap = document.createElement('div');
      fulfilWrap.className = 'nav-fulfillment-wrap';

      const fulfil = document.createElement('button');
      fulfil.className = 'nav-fulfillment';
      fulfil.type = 'button';
      fulfil.setAttribute('aria-label', fulfilLink.textContent);
      fulfil.setAttribute('aria-expanded', 'false');
      const iconImg = document.createElement('img');
      iconImg.className = 'nav-fulfillment-icon';
      iconImg.src = 'https://i5.walmartimages.com/dfw/4ff9c6c9-ad46/k2-_0a671c38-d307-447c-835e-7904ab143c26.v1.png';
      iconImg.width = 32;
      iconImg.height = 32;
      iconImg.alt = '';
      iconImg.loading = 'lazy';

      const headingSpan = document.createElement('span');
      headingSpan.className = 'nav-fulfillment-heading';
      headingSpan.textContent = fulfilLink.textContent;

      const locationSpan = document.createElement('span');
      locationSpan.className = 'nav-fulfillment-location';
      locationSpan.textContent = 'San Jose, 95134 \u2022 Milpitas Supercenter';

      const textDiv = document.createElement('div');
      textDiv.className = 'nav-fulfillment-text';
      textDiv.append(headingSpan, locationSpan);

      const chevronSpan = document.createElement('span');
      chevronSpan.className = 'nav-fulfillment-chevron';
      chevronSpan.innerHTML = ICON.chevronDown;

      fulfil.append(iconImg, textDiv, chevronSpan);

      const fulfilPanel = buildFulfillmentPanel();

      fulfil.addEventListener('click', () => {
        const wasOpen = fulfil.getAttribute('aria-expanded') === 'true';
        fulfil.setAttribute('aria-expanded', wasOpen ? 'false' : 'true');
        fulfilPanel.classList.toggle('is-open', !wasOpen);
      });

      fulfilWrap.append(fulfil, fulfilPanel);
      primaryInner.append(fulfilWrap);
    }
  }

  // Search bar
  if (utilW) {
    const searchAnchor = utilW.querySelector('p > a');
    if (searchAnchor) primaryInner.append(buildSearchForm(searchAnchor));
  }

  // Utility icons (reorder, account, cart)
  if (utilW) {
    const utilGroup = document.createElement('div');
    utilGroup.className = 'nav-utilities';

    const allUls = [...utilW.querySelectorAll(':scope > ul')];
    const utilUl = allUls.length > 1 ? allUls.at(-1) : null;
    if (utilUl) {
      const items = utilUl.querySelectorAll(':scope > li');
      const iconMap = [ICON.heart, ICON.person, ICON.cart];
      const classMap = ['nav-reorder', 'nav-account', 'nav-cart'];

      items.forEach((li, i) => {
        const a = li.querySelector('a');
        if (!a) return;

        const utilEl = document.createElement('a');
        utilEl.href = a.href;
        utilEl.className = `nav-util ${classMap[i] || ''}`;

        const iconSpan = document.createElement('span');
        iconSpan.className = 'nav-util-icon';
        iconSpan.innerHTML = iconMap[i] || '';

        // Cart badge (for cart item, index 2) — inside icon for overlap
        if (classMap[i] === 'nav-cart') {
          const badge = document.createElement('span');
          badge.className = 'nav-cart-badge';
          badge.textContent = '0';
          iconSpan.append(badge);
        }

        utilEl.append(iconSpan);

        const labelSpan = document.createElement('span');
        labelSpan.className = 'nav-util-label';
        const linkText = a.textContent.trim();
        const extraText = [...li.childNodes]
          .filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => n.textContent.trim())
          .filter(Boolean)
          .join('');

        if (extraText) {
          labelSpan.innerHTML = `<span>${linkText}</span><span>${extraText}</span>`;
        } else {
          labelSpan.textContent = linkText;
        }

        utilEl.append(labelSpan);
        utilGroup.append(utilEl);
      });
    }
    primaryInner.append(utilGroup);
  }

  primary.append(primaryInner);

  /* ── Row 1: Secondary bar ────────────────────────── */
  const secondary = document.createElement('div');
  secondary.className = 'nav-secondary';

  const secondaryInner = document.createElement('div');
  secondaryInner.className = 'nav-secondary-inner';

  // Megamenu triggers + panels
  const triggersGroup = document.createElement('div');
  triggersGroup.className = 'nav-triggers';

  if (menuW) {
    menuW.querySelectorAll(':scope > ul > li').forEach((li) => {
      const link = li.querySelector(':scope > a');
      if (!link) return;

      const wrap = document.createElement('div');
      wrap.className = 'nav-trigger-wrap';

      const trigger = document.createElement('button');
      trigger.className = 'nav-megamenu-trigger';
      trigger.type = 'button';
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-haspopup', 'true');
      trigger.innerHTML = `${link.textContent} <span class="nav-trigger-chevron">${ICON.chevronDown}</span>`;

      const panel = buildMegamenuPanel(li);

      // Click
      trigger.addEventListener('click', () => {
        const wasOpen = trigger.getAttribute('aria-expanded') === 'true';
        closeAllMenus(nav);
        if (!wasOpen) {
          trigger.setAttribute('aria-expanded', 'true');
          panel.classList.add('is-open');
          nav.querySelector('.nav-overlay')?.classList.add('is-open');
        }
      });

      // Close on mouse leave (desktop)
      let hoverTimer;
      wrap.addEventListener('mouseleave', () => {
        if (!MQ_DESKTOP.matches) return;
        hoverTimer = setTimeout(() => closeAllMenus(nav), 300);
      });
      panel.addEventListener('mouseenter', () => clearTimeout(hoverTimer));
      panel.addEventListener('mouseleave', () => {
        if (!MQ_DESKTOP.matches) return;
        hoverTimer = setTimeout(() => closeAllMenus(nav), 300);
      });

      wrap.append(trigger, panel);
      triggersGroup.append(wrap);
    });
  }
  secondaryInner.append(triggersGroup);

  // Pill links
  if (pillW) {
    const pills = document.createElement('div');
    pills.className = 'nav-pills';
    pillW.querySelectorAll('li > a').forEach((a) => {
      const pill = document.createElement('a');
      pill.className = 'nav-pill';
      pill.href = a.href;
      pill.textContent = a.textContent;
      pills.append(pill);
    });
    secondaryInner.append(pills);
  }

  secondary.append(secondaryInner);

  /* ── Overlay ─────────────────────────────────────── */
  const overlay = document.createElement('div');
  overlay.className = 'nav-overlay';
  overlay.addEventListener('click', () => closeAllMenus(nav));

  /* ── Mobile drawer ───────────────────────────────── */
  const drawer = document.createElement('div');
  drawer.className = 'nav-drawer';

  if (menuW) {
    menuW.querySelectorAll(':scope > ul > li').forEach((li) => {
      const link = li.querySelector(':scope > a');
      if (!link) return;

      const section = document.createElement('div');
      section.className = 'nav-drawer-section';

      const hdr = document.createElement('button');
      hdr.className = 'nav-drawer-header';
      hdr.type = 'button';
      hdr.setAttribute('aria-expanded', 'false');
      hdr.textContent = link.textContent;

      const body = document.createElement('div');
      body.className = 'nav-drawer-body';

      li.querySelectorAll(':scope > ul > li').forEach((cat) => {
        const catLink = cat.querySelector(':scope > a');
        if (!catLink) return;
        const catEl = document.createElement('a');
        catEl.className = 'nav-drawer-link';
        catEl.href = catLink.href;
        catEl.textContent = catLink.textContent;
        body.append(catEl);
      });

      hdr.addEventListener('click', () => {
        const expanded = hdr.getAttribute('aria-expanded') === 'true';
        hdr.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      });

      section.append(hdr, body);
      drawer.append(section);
    });
  }

  if (pillW) {
    const drawerPills = document.createElement('div');
    drawerPills.className = 'nav-drawer-pills';
    pillW.querySelectorAll('li > a').forEach((a) => {
      const pill = document.createElement('a');
      pill.className = 'nav-drawer-pill';
      pill.href = a.href;
      pill.textContent = a.textContent;
      drawerPills.append(pill);
    });
    drawer.append(drawerPills);
  }

  /* ── Assemble ────────────────────────────────────── */
  nav.append(primary, secondary, drawer, overlay);

  hamburger.addEventListener('click', () => toggleMobileMenu(nav));

  // Close fulfillment panel on click outside
  document.addEventListener('click', (e) => {
    const fulfilWrap = nav.querySelector('.nav-fulfillment-wrap');
    if (fulfilWrap && !fulfilWrap.contains(e.target)) {
      const btn = fulfilWrap.querySelector('.nav-fulfillment');
      const panel = fulfilWrap.querySelector('.nav-fulfillment-panel');
      if (btn) btn.setAttribute('aria-expanded', 'false');
      if (panel) panel.classList.remove('is-open');
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllMenus(nav);
      // Close fulfillment panel
      const fulfilBtn = nav.querySelector('.nav-fulfillment');
      const fulfilPanel = nav.querySelector('.nav-fulfillment-panel');
      if (fulfilBtn) fulfilBtn.setAttribute('aria-expanded', 'false');
      if (fulfilPanel) fulfilPanel.classList.remove('is-open');
      if (nav.getAttribute('aria-expanded') === 'true') {
        toggleMobileMenu(nav, false);
      }
    }
  });

  MQ_DESKTOP.addEventListener('change', () => {
    if (MQ_DESKTOP.matches) toggleMobileMenu(nav, false);
    closeAllMenus(nav);
  });

  const wrapper = document.createElement('div');
  wrapper.className = 'nav-wrapper';
  wrapper.append(nav);
  block.append(wrapper);
}
