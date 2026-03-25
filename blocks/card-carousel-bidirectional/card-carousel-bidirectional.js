import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation, getBlockId } from '../../scripts/scripts.js';
import { createCard } from '../card/card.js';

const BLOCK_NAME = 'card-carousel-bidirectional';
const SLIDES_CLASS = `${BLOCK_NAME}-slides`;
const SLIDE_CLASS = `${BLOCK_NAME}-slide`;
const CONTAINER_CLASS = `${BLOCK_NAME}-slides-container`;
// SVG namespace URI — required by DOM spec, not an HTTP request
// eslint-disable-next-line browser-security/detect-mixed-content, browser-security/no-http-urls
const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Creates an SVG star element (filled or empty).
 * @param {boolean} filled Whether the star is filled
 * @returns {SVGElement}
 */
function createStar(filled) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '12');
  svg.setAttribute('height', '12');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', [
    'M12 2l3.09 6.26L22 9.27l-5 4.87',
    '1.18 6.88L12 17.77l-6.18 3.25L7 14.14',
    '2 9.27l6.91-1.01L12 2z',
  ].join(' '));
  if (filled) {
    path.setAttribute('fill', '#f5a623');
    path.setAttribute('stroke', '#f5a623');
  } else {
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#ccc');
  }
  path.setAttribute('stroke-width', '1');
  svg.append(path);
  return svg;
}

/**
 * Creates a star rating row with stars and review count.
 * @param {number} rating Rating value (e.g. 4.3)
 * @param {number} reviews Number of reviews
 * @returns {HTMLElement}
 */
function createStarRating(rating, reviews) {
  const wrapper = document.createElement('div');
  wrapper.className = 'card-star-rating';
  wrapper.setAttribute('aria-label', `${rating} out of 5 stars, ${reviews} reviews`);
  const fullStars = Math.floor(rating);
  for (let i = 0; i < 5; i += 1) {
    wrapper.append(createStar(i < fullStars));
  }
  const count = document.createElement('span');
  count.className = 'card-review-count';
  count.textContent = String(reviews);
  wrapper.append(count);
  return wrapper;
}

/**
 * Shows or hides prev/next buttons based on scroll position.
 */
function updateButtonVisibility(block) {
  const slidesEl = block.querySelector(`.${SLIDES_CLASS}`);
  const prev = block.querySelector('.slide-prev');
  const next = block.querySelector('.slide-next');
  if (!slidesEl || !prev || !next) return;

  const atStart = slidesEl.scrollLeft <= 1;
  const atEnd = slidesEl.scrollLeft + slidesEl.offsetWidth >= slidesEl.scrollWidth - 1;

  prev.style.visibility = atStart ? 'hidden' : 'visible';
  next.style.visibility = atEnd ? 'hidden' : 'visible';
}

export default function decorate(block) {
  const blockId = getBlockId(BLOCK_NAME);
  block.setAttribute('id', blockId);
  block.setAttribute('aria-label', `carousel-${blockId}`);
  block.setAttribute('role', 'region');

  const rows = [...block.children];
  const hasMultiple = rows.length > 1;
  const FEW_SLIDES_THRESHOLD = 3;
  if (rows.length <= FEW_SLIDES_THRESHOLD) block.classList.add('few-slides');

  /* --- Build slides list --- */
  const slidesList = document.createElement('ul');
  slidesList.classList.add(SLIDES_CLASS);
  slidesList.setAttribute('tabindex', '0');
  slidesList.setAttribute('aria-label', 'Card carousel slides');

  rows.forEach((row) => {
    const card = createCard(row);
    card.classList.add(SLIDE_CLASS);
    slidesList.append(card);
    row.remove();
  });

  slidesList.querySelectorAll('picture > img').forEach((img) => {
    const optimizedPic = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
    moveInstrumentation(img, optimizedPic.querySelector('img'));
    img.closest('picture').replaceWith(optimizedPic);
  });

  /* --- Wishlist heart icon + star rating on every product card --- */
  slidesList.querySelectorAll(`.${SLIDE_CLASS}`).forEach((slide, idx) => {
    const imageDiv = slide.querySelector('.cards-card-image');
    if (imageDiv) {
      const heartBtn = document.createElement('button');
      heartBtn.type = 'button';
      heartBtn.className = 'card-wishlist';
      heartBtn.setAttribute('aria-label', 'Add to wishlist');
      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2');
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', [
        'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67',
        'l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78',
        'l1.06 1.06L12 21.23l7.78-7.78',
        '1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
      ].join(''));
      svg.append(path);
      heartBtn.append(svg);
      imageDiv.append(heartBtn);
    }

    const body = slide.querySelector('.cards-card-body');
    if (body) {
      const ratings = [4, 5, 4, 4, 5, 4, 5, 4, 4, 5, 4, 5, 4, 4, 5, 4, 5, 4, 4];
      const counts = [
        1842, 3210, 956, 2104, 1538, 2876, 412, 687, 4521,
        1293, 2067, 845, 1126, 3487, 762, 1654, 2398, 531, 1987,
      ];
      const rating = ratings[idx % ratings.length];
      const reviewCount = counts[idx % counts.length];
      body.append(createStarRating(rating, reviewCount));
    }
  });

  /* --- Product cards (non-FanCards): add price + options badge --- */
  if (!block.classList.contains('few-slides')) {
    const prices = [
      '$12.97', '$16.97', '$3.47', '$13.97', '$4.97',
      '$6.97', '$13.97', '$2.97', '$34.97', '$5.97',
      '$4.47', '$2.97', '$4.47', '$14.97', '$5.47',
      '$12.97', '$5.47', '$4.97', '$6.97',
    ];
    const optionsCounts = [
      0, 4, 1, 3, 1, 1, 2, 2, 0, 4,
      1, 2, 2, 0, 2, 1, 2, 2, 2,
    ];
    slidesList.querySelectorAll(`.${SLIDE_CLASS}`).forEach((slide, idx) => {
      const bodyP = slide.querySelector('.cards-card-body p');
      if (bodyP) {
        const priceSpan = document.createElement('span');
        priceSpan.className = 'card-price';
        priceSpan.textContent = prices[idx % prices.length];
        bodyP.append(priceSpan);
      }

      const optCount = optionsCounts[idx % optionsCounts.length];
      if (optCount > 0) {
        const cardBody = slide.querySelector('.cards-card-body');
        if (cardBody) {
          const badge = document.createElement('span');
          badge.className = 'card-options-badge';
          badge.textContent = `+${optCount} ${optCount === 1 ? 'option' : 'options'}`;
          cardBody.before(badge);
        }
      }
    });
  }

  /* --- FanCards only: price range below Options button --- */
  if (block.classList.contains('few-slides')) {
    slidesList.querySelectorAll(`.${SLIDE_CLASS}`).forEach((slide) => {
      const bodyP = slide.querySelector('.cards-card-body p');
      if (bodyP) {
        const titleEl = bodyP.querySelector('strong');
        const titleText = titleEl !== null ? titleEl.textContent : '';
        const priceMatch = titleText.match(/\$[\d,]+-\$[\d,]+/);
        if (priceMatch) {
          const [low, high] = priceMatch[0].split('-');
          const priceSpan = document.createElement('span');
          priceSpan.className = 'card-price-range';
          priceSpan.textContent = `${low} to ${high}`;
          bodyP.append(priceSpan);
        }
      }
    });
  }

  /* --- Build container with optional nav buttons --- */
  const container = document.createElement('div');
  container.classList.add(CONTAINER_CLASS);

  if (hasMultiple) {
    const navWrapper = document.createElement('div');
    navWrapper.classList.add('carousel-navigation-buttons');

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.classList.add('slide-prev');
    prevBtn.setAttribute('aria-label', 'Previous Slide');
    prevBtn.style.visibility = 'hidden';

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.classList.add('slide-next');
    nextBtn.setAttribute('aria-label', 'Next Slide');

    navWrapper.append(prevBtn, nextBtn);
    container.append(navWrapper);
  }

  container.append(slidesList);
  block.prepend(container);

  if (!hasMultiple) return;

  /* --- Scroll by one visible page on prev/next click --- */
  block.querySelector('.slide-prev').addEventListener('click', () => {
    slidesList.scrollBy({ left: -slidesList.clientWidth, behavior: 'smooth' });
  });

  block.querySelector('.slide-next').addEventListener('click', () => {
    slidesList.scrollBy({ left: slidesList.clientWidth, behavior: 'smooth' });
  });

  /* --- Sync button visibility on scroll --- */
  slidesList.addEventListener('scroll', () => updateButtonVisibility(block), { passive: true });

  /* --- Keyboard navigation --- */
  slidesList.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const direction = e.key === 'ArrowLeft' ? -1 : 1;
    slidesList.scrollBy({ left: direction * slidesList.clientWidth, behavior: 'smooth' });
  });

  /* --- Update button visibility when layout is ready and on resize --- */
  new ResizeObserver(() => updateButtonVisibility(block)).observe(slidesList);
}
