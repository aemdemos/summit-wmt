#!/usr/bin/env node

/**
 * Parser Validator
 *
 * Validates import script parsers against live URLs.
 *
 * Usage:
 *   node parser-validator.js <url> <parser-script-path> <inventory-path>
 *
 * Examples:
 *   node parser-validator.js https://www.wknd-trendsetters.site/ examples/wknd/accordion-faq.js examples/wknd/page-templates.json
 */

import { chromium } from 'playwright';
import { resolve, dirname, join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import {
  VIEWPORT_WIDTH,
  VIEWPORT_HEIGHT,
  createTemplatedImport,
  loadPageWithHelixImporter,
} from './playwright-helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 3) {
  console.error('Error: Missing required arguments');
  console.error('');
  console.error('Usage: node parser-validator.js <url> <parser-script-path> <inventory-path>');
  console.error('');
  console.error('Arguments:');
  console.error('  url                   The URL to fetch and validate against');
  console.error('  parser-script-path    Path to the parser script to validate');
  console.error('  inventory-path        Path to the page templates JSON file');
  console.error('');
  console.error('Example:');
  console.error('  node parser-validator.js https://www.skoda-auto.com/ ../resources/examples/carousel-hero.js ../resources/examples/page-templates.json');
  process.exit(1);
}

const [url, parserScriptPath, inventoryPath] = args;

// Validate parser script exists
const resolvedParserPath = resolve(parserScriptPath);
if (!existsSync(resolvedParserPath)) {
  console.error('Error: Parser script not found at:', resolvedParserPath);
  process.exit(1);
}

// Validate inventory file exists
const resolvedInventoryPath = resolve(inventoryPath);
if (!existsSync(resolvedInventoryPath)) {
  console.error('Error: Inventory file not found at:', resolvedInventoryPath);
  process.exit(1);
}

// Validate URL
try {
  new URL(url);
} catch (error) {
  console.error('Error: Invalid URL:', url);
  process.exit(1);
}

// Main validation function
async function validateParser() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: {
      width: VIEWPORT_WIDTH,
      height: VIEWPORT_HEIGHT,
    }
  });

  try {
    const page = await context.newPage();

    const helixImporterPath = join(__dirname, 'static', 'inject', 'helix-importer.js');

    if (!existsSync(helixImporterPath)) {
      throw new Error(`helix-importer.js not found at: ${helixImporterPath}`);
    }

    const helixImporterScript = readFileSync(helixImporterPath, 'utf-8');

    await loadPageWithHelixImporter(page, url, helixImporterScript);

    // Create templated import.js with inventory data
    const templatedImportPath = createTemplatedImport(resolvedInventoryPath, __dirname);

    // Inject templated import.js
    const importScript = readFileSync(templatedImportPath, 'utf-8');
    await page.evaluate(importScript);

    // Load and inject the parser script
    const parserScript = readFileSync(resolvedParserPath, 'utf-8');

    // Extract block name from parser file path
    const blockName = parserScriptPath.split('/').pop().replace('.js', '');

    // Inject parser into page
    await page.evaluate(({ script, name }) => {
      const scriptContent = script.replace(
        /export\s+default\s+(function\s*\w*)/g,
        'window.__PARSER_PARSE__ = $1'
      ).replace(
        /export\s+default\s+/g,
        'window.__PARSER_PARSE__ = '
      );

      const scriptEl = document.createElement('script');
      scriptEl.textContent = scriptContent;
      document.head.appendChild(scriptEl);

      window.BLOCK_PARSER = { name, parse: window.__PARSER_PARSE__ };
    }, { script: parserScript, name: blockName });

    // Execute transformation, convert to markdown, and get results
    const transformationResults = await page.evaluate(async (pageUrl) => {
      const results = window.PARSER_VALIDATOR.executeTransformation(pageUrl);

      if (typeof window.WebImporter.html2md !== 'function') {
        throw new Error('html2md function not found. Make sure helix-importer.js is properly loaded.');
      }

      for (const result of results.results) {
        if (result.blockCreated) {
          try {
            const conversionResult = await window.WebImporter.html2md(pageUrl, result.blockCreated);
            result.markdown = conversionResult.md;
          } catch (error) {
            result.error = `Failed to convert HTML to markdown: ${error.message}`;
          }
        }
      }

      return results;
    }, url);

    if (transformationResults.results.length === 0) {
      console.error('No results found — this indicates the parser is not working as expected.');
      process.exit(1);
    }

    // Output the markdown results
    for (let i = 0; i < transformationResults.results.length; i++) {
      const result = transformationResults.results[i];
      if (result.markdown) {
        console.log(result.markdown);

        if (i < transformationResults.results.length - 1) {
          console.log('');
        }
      } else if (result.error) {
        console.error(`Error in instance ${result.instance}: ${result.error}`);
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await context.close().catch(() => { });
    await browser.close();
  }
}

// Run validation
validateParser().catch((error) => {
  console.error('Validation failed:', error.message || 'Unknown error');
  process.exit(1);
});
