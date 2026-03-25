/**
 * Best-effort cookie / consent banner dismissal before footer detection.
 *
 * No approach can cover every locale and every CMP. Order:
 * 1. Optional `--cookie-selector` (site-specific override)
 * 2. Language-free structural selectors (IDs, data attributes, id*=accept)
 * 3. Single English text match: one `getByRole` regex — "Accept" or "Accept all" only
 * 4. Language-agnostic: inside known CMP roots, ignore buttons that look like reject/settings,
 *    then click the last visible candidate (many banners put "Accept all" last)
 */

/** @param {import('playwright').Page} page @param {{ cookieSelector?: string | null }} opts */
export async function tryDismissCookieBanner(page, opts = {}) {
  const pause = (ms) => page.waitForTimeout(ms);

  if (opts.cookieSelector) {
    try {
      const loc = page.locator(opts.cookieSelector).first();
      if (await loc.isVisible({ timeout: 800 }).catch(() => false)) {
        await loc.click();
        await pause(500);
        return 'cookie-selector-arg';
      }
    } catch {
      /* continue */
    }
  }

  const structural = [
    '#onetrust-accept-btn-handler',
    '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
    '#CybotCookiebotDialogBodyButtonAccept',
    '[data-testid="cookie-accept"]',
    'button[data-action="accept"]',
    '[data-action="accept-all"]',
    '.cookie-accept',
    'button[id*="accept-all" i]',
    'button[id*="acceptall" i]',
    'a[id*="accept-all" i]',
    'button[id*="accept" i]',
  ];

  for (const sel of structural) {
    try {
      const loc = page.locator(sel).first();
      if (await loc.isVisible({ timeout: 350 }).catch(() => false)) {
        await loc.click();
        await pause(500);
        return `structural:${sel}`;
      }
    } catch {
      /* continue */
    }
  }

  // One English pattern only (covers many default CMP strings like "Accept" / "Accept All")
  try {
    const eng = page.getByRole('button', { name: /^accept(\s+all)?$/i }).first();
    if (await eng.isVisible({ timeout: 400 }).catch(() => false)) {
      await eng.click();
      await pause(500);
      return 'english-accept-role';
    }
  } catch {
    /* continue */
  }

  const clicked = await page.evaluate(() => {
    const cmpRootSelectors = [
      '#onetrust-banner-sdk',
      '#onetrust-consent-sdk',
      '#CybotCookiebotDialog',
      '#cookiescript_injected',
      '.cli-modal-body',
      '[id*="cookiebanner" i]',
      '[class*="cookie-banner" i]',
      '[class*="cookieconsent" i]',
    ];

    const rejectPattern = /reject|decline|deny|refus|ablehn|nur notwendige|necessary only|only necessary|essential only|cookie settings|privacy settings|settings|preferences|paramètres|parametros|configuraci|customize|manage cookies|mehr info|more info|learn more|only required|statistik|statistics|optionale|optional/i;

    function visible(el) {
      const st = window.getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || st.pointerEvents === 'none') return false;
      const r = el.getBoundingClientRect();
      return r.width >= 2 && r.height >= 2;
    }

    for (const sel of cmpRootSelectors) {
      let root;
      try {
        root = document.querySelector(sel);
      } catch {
        continue;
      }
      if (!root || !visible(root)) continue;

      const controls = root.querySelectorAll('button, [role="button"], a.button, a[class*="btn"]');
      const candidates = [];
      for (let i = 0; i < controls.length; i++) {
        const el = controls[i];
        if (!visible(el)) continue;
        const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (!t || t.length > 120) continue;
        if (rejectPattern.test(t)) continue;
        candidates.push(el);
      }
      if (candidates.length === 0) continue;
      candidates[candidates.length - 1].click();
      return true;
    }
    return false;
  });

  if (clicked) {
    await pause(500);
    return 'cmp-root-last-candidate';
  }

  return null;
}
