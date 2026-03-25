/**
 * Shared code for import-validator scripts (parser-validator and transformer-validator).
 * Browser setup, popup dismissal, templated import creation.
 */

import { join } from 'path';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';

export const VIEWPORT_WIDTH = 1920;
export const VIEWPORT_HEIGHT = 1080;
export const PAGE_TIMEOUT = 30000;
export const POPUP_DISMISS_DELAY = 500;
export const ESCAPE_KEY_DELAY = 300;

/**
 * Create a templated import.js with the provided inventory data
 * @param {string} inventoryPath - Path to page-templates.json
 * @param {string} staticDir - Directory containing static/import.js (e.g. __dirname of validator)
 * @returns {string} Path to the generated temporary import script
 */
export function createTemplatedImport(inventoryPath, staticDir) {
  const inventoryContent = readFileSync(inventoryPath, 'utf-8');
  let pageTemplates;

  try {
    pageTemplates = JSON.parse(inventoryContent);
  } catch (error) {
    throw new Error(`Failed to parse inventory JSON: ${error.message}`);
  }

  const importTemplatePath = join(staticDir, 'static', 'import.js');
  const importTemplate = readFileSync(importTemplatePath, 'utf-8');

  const templatedImport = importTemplate.replace(
    /const PAGE_TEMPLATES = \{[\s\S]*?\};/,
    `const PAGE_TEMPLATES = ${JSON.stringify(pageTemplates, null, 2)};`
  );

  const tmpDir = join(staticDir, 'tmp');
  if (!existsSync(tmpDir)) {
    mkdirSync(tmpDir, { recursive: true });
  }

  const tmpImportPath = join(tmpDir, 'import-generated.js');
  writeFileSync(tmpImportPath, templatedImport, 'utf-8');

  return tmpImportPath;
}

/**
 * Dismiss cookie consent dialogs and other popups on the page
 * @param {import('playwright').Page} page - Playwright page
 */
export async function dismissPopups(page) {
  try {
    const dismissSelectors = [
      'button[id*="accept" i]',
      'button[id*="cookie" i]',
      'button[class*="accept" i]',
      'button[class*="cookie" i]',
      'button[class*="consent" i]',
      'a[class*="accept" i]',
      'a[id*="accept" i]',
      '[aria-label*="accept" i]',
      '[aria-label*="agree" i]',
      '[data-testid*="accept" i]',
      '[data-testid*="cookie" i]',
      '#onetrust-accept-btn-handler',
      '.onetrust-close-btn-handler',
      '#cookie-consent-accept',
      '.cookie-consent-accept',
      '.accept-cookies',
      'button[aria-label*="close" i]',
      'button[class*="close" i]:not([class*="closed"])',
      '[data-dismiss="modal"]',
      '.modal-close',
      '.overlay-close',
      '.popup-close'
    ];

    let dismissed = false;

    for (const selector of dismissSelectors) {
      try {
        const elements = await page.$$(selector);

        for (const element of elements) {
          const isVisible = await element.isVisible().catch(() => false);
          if (isVisible) {
            const text = await element.evaluate(el => el.textContent?.toLowerCase() || '');

            if (text.includes('accept') ||
              text.includes('agree') ||
              text.includes('consent') ||
              text.includes('allow') ||
              text.includes('ok') ||
              text.includes('close') ||
              text.includes('continue')) {
              await element.click();
              dismissed = true;
              await page.waitForTimeout(POPUP_DISMISS_DELAY);
              break;
            }
          }
        }

        if (dismissed) break;
      } catch (err) {
        // Silently continue to next selector
      }
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(ESCAPE_KEY_DELAY);

  } catch (error) {
    // Silently continue
  }
}

/**
 * Load page, dismiss popups, and inject helix-importer.js
 * @param {import('playwright').Page} page - Playwright page
 * @param {string} url - URL to load
 * @param {string} helixImporterScript - Content of helix-importer.js
 */
export async function loadPageWithHelixImporter(page, url, helixImporterScript) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: PAGE_TIMEOUT });
  await dismissPopups(page);

  await page.evaluate((script) => {
    const originalDefine = window.define;
    if (typeof window.define !== 'undefined') {
      delete window.define;
    }

    const scriptEl = document.createElement('script');
    scriptEl.textContent = script;
    document.head.appendChild(scriptEl);

    if (originalDefine) {
      window.define = originalDefine;
    }
  }, helixImporterScript);
}
