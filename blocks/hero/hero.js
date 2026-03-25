/**
 * Hero block decoration.
 * Handles overlay images wrapped in <em> tags (e.g., Express Delivery badge).
 * Also handles overlay images authored as plain paragraphs (without <em>).
 * Works with both DA (img) and doc-based (picture) image formats.
 * @param {Element} block The hero block element
 */
export default function decorate(block) {
  const contentDiv = block.querySelector(':scope > div > div');
  if (!contentDiv) return;

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

    contentDiv.prepend(overlay);
  }

  // Mark the first image paragraph as the hero background
  const firstImg = block.querySelector(':scope > div > div > p > img, :scope > div > div > p > picture');
  if (firstImg) {
    const bgP = firstImg.closest('p');
    if (bgP) {
      bgP.classList.add('hero-bg');
    }
  }

  // Fallback: if no overlay was created from <em> tags, check for additional
  // image-only paragraphs after the background. These are overlay images authored
  // as plain content (without <em> formatting) in AEM document authoring.
  if (!contentDiv.querySelector('.hero-overlays')) {
    const bgP = contentDiv.querySelector('.hero-bg');
    if (bgP) {
      const extraImagePs = [...contentDiv.querySelectorAll(':scope > p')]
        .filter((p) => p !== bgP
          && !p.classList.contains('button-wrapper')
          && p.querySelector('picture, img')
          && !p.textContent.trim());
      if (extraImagePs.length > 0) {
        const overlay = document.createElement('div');
        overlay.className = 'hero-overlays';
        extraImagePs.forEach((p) => {
          const pic = p.querySelector('picture');
          if (pic) {
            overlay.append(pic);
          } else {
            const img = p.querySelector('img');
            if (img) overlay.append(img);
          }
          p.remove();
        });
        contentDiv.prepend(overlay);
      }
    }
  }
}
