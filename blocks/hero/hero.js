/**
 * Hero block decoration.
 * Handles overlay images wrapped in <em> tags (e.g., Express Delivery badge).
 * Works with both DA (img) and doc-based (picture) image formats.
 * @param {Element} block The hero block element
 */
export default function decorate(block) {
  // Find <em> elements that contain images (overlay images from parser)
  const emWithImages = [...block.querySelectorAll('em')].filter(
    (em) => em.querySelector('picture, img'),
  );

  if (emWithImages.length > 0) {
    const overlay = document.createElement('div');
    overlay.className = 'hero-overlays';

    emWithImages.forEach((em) => {
      // Move picture elements (doc-based) or img elements (DA) into overlay
      const pictures = em.querySelectorAll('picture');
      if (pictures.length > 0) {
        pictures.forEach((pic) => overlay.append(pic));
      } else {
        const imgs = em.querySelectorAll('img');
        imgs.forEach((img) => overlay.append(img));
      }
      // Remove the now-empty <em> and its parent <p> if empty
      const parentP = em.closest('p');
      em.remove();
      if (parentP && !parentP.textContent.trim() && !parentP.querySelector('img, picture')) {
        parentP.remove();
      }
    });

    // Insert overlay container as direct child of the inner content div
    const contentDiv = block.querySelector(':scope > div > div');
    if (contentDiv) {
      contentDiv.prepend(overlay);
    }
  }

  // Mark the first image paragraph as the hero background
  const firstImg = block.querySelector(':scope > div > div > p > img, :scope > div > div > p > picture');
  if (firstImg) {
    const bgP = firstImg.closest('p');
    if (bgP) {
      bgP.classList.add('hero-bg');
    }
  }
}
