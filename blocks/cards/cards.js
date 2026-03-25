import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation, getBlockId } from '../../scripts/scripts.js';
import { createCard } from '../card/card.js';

export default function decorate(block) {
  const blockId = getBlockId('cards');
  block.setAttribute('id', blockId);
  block.setAttribute('aria-label', `Cards for ${blockId}`);
  block.setAttribute('role', 'region');
  block.setAttribute('aria-roledescription', 'Cards');

  /* change to ul, li */
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    ul.append(createCard(row));
  });
  ul.querySelectorAll('picture > img').forEach((img) => {
    const optimizedPic = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
    moveInstrumentation(img, optimizedPic.querySelector('img'));
    img.closest('picture').replaceWith(optimizedPic);
  });
  block.textContent = '';
  block.append(ul);

  /* Auto-detect hub-spoke pattern: every card has an image + body with only a single link */
  const cards = ul.querySelectorAll('li');
  const isHubSpoke = cards.length > 0 && [...cards].every((li) => {
    const imgDiv = li.querySelector('.cards-card-image');
    const bodyDiv = li.querySelector('.cards-card-body');
    if (!imgDiv || !bodyDiv) return false;
    const links = bodyDiv.querySelectorAll('a');
    const paragraphs = bodyDiv.querySelectorAll('p');
    return links.length === 1 && paragraphs.length <= 1;
  });

  if (isHubSpoke) {
    block.classList.add('hub-spoke');
  } else if (cards.length === 5) {
    block.classList.add('promo-grid');
  }
}
