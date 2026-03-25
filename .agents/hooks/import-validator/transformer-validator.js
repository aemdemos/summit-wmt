#!/usr/bin/env node

/**
 * Transformer Validator
 *
 * Validates import script transformers against live URLs by running
 * beforeTransform and afterTransform with { document, template } and
 * reporting a DOM summary.
 *
 * Usage:
 *   node transformer-validator.js <url> <transformer-script-path> <page-templates-path>
 */

import { chromium } from 'playwright';
import { resolve, dirname, join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import {
  VIEWPORT_WIDTH,
  VIEWPORT_HEIGHT,
  loadPageWithHelixImporter,
} from './playwright-helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);

if (args.length < 3) {
  console.error('Error: Missing required arguments');
  console.error('');
  console.error('Usage: node transformer-validator.js <url> <transformer-script-path> <page-templates-path>');
  console.error('');
  console.error('Arguments:');
  console.error('  url                     The URL to fetch and validate against');
  console.error('  transformer-script-path Path to the transformer script to validate');
  console.error('  page-templates-path     Path to the page templates JSON file');
  process.exit(1);
}

const [url, transformerScriptPath, pageTemplatesPath] = args;

const resolvedTransformerPath = resolve(transformerScriptPath);
if (!existsSync(resolvedTransformerPath)) {
  console.error('Error: Transformer script not found at:', resolvedTransformerPath);
  process.exit(1);
}

const resolvedPageTemplatesPath = resolve(pageTemplatesPath);
if (!existsSync(resolvedPageTemplatesPath)) {
  console.error('Error: Page templates file not found at:', resolvedPageTemplatesPath);
  process.exit(1);
}

try {
  new URL(url);
} catch (error) {
  console.error('Error: Invalid URL:', url);
  process.exit(1);
}

/**
 * Find matching template for the given URL (same logic as static/import.js)
 */
function findTemplateByUrl(pageTemplates, pageUrl) {
  const normalizedUrl = pageUrl.replace(/\/$/, '');
  for (const template of pageTemplates.templates || []) {
    for (const templateUrl of template.urls || []) {
      const normalizedTemplateUrl = templateUrl.replace(/\/$/, '');
      if (normalizedUrl === normalizedTemplateUrl) {
        return template;
      }
    }
  }
  return null;
}

/**
 * Optional static check: ensure transformer has correct signature and hook usage
 */
function validateTransformerStructure(code) {
  const hasSignature = /export\s+default\s+function\s+transform\s*\(\s*hookName\s*,\s*element\s*,\s*payload\s*\)/.test(code);
  if (!hasSignature) {
    throw new Error('Transformer must use signature: export default function transform(hookName, element, payload)');
  }
  if (!code.includes('beforeTransform') && !code.includes('afterTransform')) {
    throw new Error('Transformer must use beforeTransform and/or afterTransform hook conditionals');
  }
}

async function validateTransformer() {
  let pageTemplates;
  try {
    pageTemplates = JSON.parse(readFileSync(resolvedPageTemplatesPath, 'utf-8'));
  } catch (error) {
    console.error('Error: Failed to parse page-templates.json:', error.message);
    process.exit(1);
  }

  const template = findTemplateByUrl(pageTemplates, url);
  if (!template) {
    console.error('Error: No template found for URL:', url);
    console.error('Ensure the URL is listed in tools/importer/page-templates.json under a template\'s urls.');
    process.exit(1);
  }

  const transformerScript = readFileSync(resolvedTransformerPath, 'utf-8');
  validateTransformerStructure(transformerScript);

  const sections = template.sections;
  const isSectionTransformer = /\btemplate\.sections\b|payload\.template\.sections/.test(transformerScript);
  const runSectionValidation = Boolean(sections && Array.isArray(sections) && sections.length >= 2 && isSectionTransformer);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT }
  });

  try {
    const page = await context.newPage();

    const helixImporterPath = join(__dirname, 'static', 'inject', 'helix-importer.js');
    if (!existsSync(helixImporterPath)) {
      throw new Error(`helix-importer.js not found at: ${helixImporterPath}`);
    }
    const helixImporterScript = readFileSync(helixImporterPath, 'utf-8');

    await loadPageWithHelixImporter(page, url, helixImporterScript);

    const summary = await page.evaluate(
      async ({ script, templateData, runSectionValidation: runSectionVal }) => {
        const main = document.body;

        function descriptor(el) {
          const tag = el.tagName.toLowerCase();
          const id = el.id ? '#' + el.id : '';
          const classList = el.className && typeof el.className === 'string'
            ? el.className.trim().split(/\s+/).filter(Boolean).sort().join('.')
            : '';
          const classes = classList ? '.' + classList : '';
          return tag + id + classes;
        }

        function countDescriptorsUnder(root) {
          const counts = {};
          const walk = (node) => {
            if (node.nodeType !== 1) return;
            const d = descriptor(node);
            counts[d] = (counts[d] || 0) + 1;
            for (let i = 0; i < node.children.length; i++) walk(node.children[i]);
          };
          walk(root);
          return counts;
        }

        const countBefore = main.children.length;
        const htmlLenBefore = main.innerHTML.length;
        const beforeCounts = countDescriptorsUnder(main);

        const scriptContent = script.replace(
          /export\s+default\s+(function\s*\w*)/g,
          'window.__TRANSFORM__ = $1'
        ).replace(
          /export\s+default\s+/g,
          'window.__TRANSFORM__ = '
        );

        const scriptEl = document.createElement('script');
        scriptEl.textContent = scriptContent;
        document.head.appendChild(scriptEl);

        const transform = window.__TRANSFORM__;
        if (typeof transform !== 'function') {
          return { error: 'Transformer did not export a function' };
        }

        const payload = { document, template: templateData };

        try {
          transform('beforeTransform', main, payload);
          transform('afterTransform', main, payload);
        } catch (err) {
          return { error: err.message };
        }

        const countAfter = main.children.length;
        const htmlLenAfter = main.innerHTML.length;
        const afterCounts = countDescriptorsUnder(main);

        const removed = [];
        const added = [];
        const allKeys = new Set([...Object.keys(beforeCounts), ...Object.keys(afterCounts)]);
        for (const d of allKeys) {
          const b = beforeCounts[d] || 0;
          const a = afterCounts[d] || 0;
          if (b > a) {
            const n = b - a;
            removed.push(n > 1 ? `${d} (×${n})` : d);
          } else if (a > b) {
            const n = a - b;
            added.push(n > 1 ? `${d} (×${n})` : d);
          }
        }
        removed.sort();
        added.sort();

        let sectionValidation = { hasSections: false };
        const sections = templateData?.sections;
        if (runSectionVal && sections && Array.isArray(sections) && sections.length >= 2) {
          const expectedSectionBreaks = sections.length - 1;
          const actualSectionBreaks = main.querySelectorAll('hr').length;
          const sectionsWithStyle = sections.filter((s) => s && s.style);
          const expectedSectionMetadata = sectionsWithStyle.length;
          const tables = main.querySelectorAll('table');
          let actualSectionMetadata = 0;
          tables.forEach((table) => {
            const firstHeader = table.querySelector('th');
            if (firstHeader && firstHeader.textContent.trim() === 'Section Metadata') {
              actualSectionMetadata += 1;
            }
          });
          sectionValidation = {
            hasSections: true,
            sectionCount: sections.length,
            expectedSectionBreaks,
            actualSectionBreaks,
            expectedSectionMetadata,
            actualSectionMetadata,
            sectionBreaksOk: actualSectionBreaks >= expectedSectionBreaks,
            sectionMetadataOk: actualSectionMetadata >= expectedSectionMetadata,
          };
        }

        return {
          success: true,
          childCountBefore: countBefore,
          childCountAfter: countAfter,
          innerHTMLLengthBefore: htmlLenBefore,
          innerHTMLLengthAfter: htmlLenAfter,
          templateName: templateData?.name || 'unknown',
          removed,
          added,
          sectionValidation,
        };
      },
      { script: transformerScript, templateData: template, runSectionValidation }
    );

    if (summary.error) {
      console.error('Error:', summary.error);
      process.exit(1);
    }

    console.log('Success. Transformer ran without errors.');
    console.log(`Template: ${summary.templateName}`);
    console.log(`Main element children: ${summary.childCountBefore} → ${summary.childCountAfter}`);
    console.log(`Main innerHTML length: ${summary.innerHTMLLengthBefore} → ${summary.innerHTMLLengthAfter} chars`);
    console.log('');
    if (summary.removed.length > 0) {
      console.log('Elements removed by transformer:');
      summary.removed.forEach((d) => console.log('  - ' + d));
    } else {
      console.log('Elements removed by transformer: (none)');
    }
    if (summary.added.length > 0) {
      console.log('');
      console.log('Elements added by transformer:');
      summary.added.forEach((d) => console.log('  + ' + d));
    }
    if (summary.sectionValidation && summary.sectionValidation.hasSections) {
      const sv = summary.sectionValidation;
      console.log('');
      console.log('Section validation (template has ' + sv.sectionCount + ' sections):');
      console.log('  Section breaks (<hr>): ' + sv.actualSectionBreaks + ' (expected ' + sv.expectedSectionBreaks + ') ' + (sv.sectionBreaksOk ? '✓' : '✗'));
      console.log('  Section Metadata blocks: ' + sv.actualSectionMetadata + ' (expected ' + sv.expectedSectionMetadata + ') ' + (sv.sectionMetadataOk ? '✓' : '✗'));
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await context.close().catch(() => {});
    await browser.close();
  }
}

validateTransformer().catch((error) => {
  console.error('Validation failed:', error.message || 'Unknown error');
  process.exit(1);
});
