import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation, getBlockId } from '../../scripts/scripts.js';
import { createCard } from '../card/card.js';

const BLOCK_NAME = 'card-carousel-bidirectional';
const SLIDES_CLASS = `${BLOCK_NAME}-slides`;
const SLIDE_CLASS = `${BLOCK_NAME}-slide`;
const CONTAINER_CLASS = `${BLOCK_NAME}-slides-container`;

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
