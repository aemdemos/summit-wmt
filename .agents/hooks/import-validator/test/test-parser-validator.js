#!/usr/bin/env node

/**
 * Test runner for parser-validator
 *
 * Usage:
 *   node test-parser-validator.js
 *
 * Runs the parser-validator against the included examples
 */

import { spawnSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Parser Validator Test Runner\n');

const examples = [
  {
    name: 'WKND accordion',
    url: 'https://www.wknd-trendsetters.site/',
    parser: './examples/wknd/accordion-faq.js',
    templates: './examples/wknd/page-templates.json',
  },
  {
    name: 'WKND cards-article',
    url: 'https://www.wknd-trendsetters.site/',
    parser: './examples/wknd/cards-article.js',
    templates: './examples/wknd/page-templates.json',
  },
  {
    name: 'WKND tabs-testimonial',
    url: 'https://www.wknd-trendsetters.site/',
    parser: './examples/wknd/tabs-testimonial.js',
    templates: './examples/wknd/page-templates.json',
  },
];

let passed = 0;
let failed = 0;

for (const example of examples) {
  console.log(`\n📋 Testing: ${example.name}`);
  console.log(`   URL: ${example.url}`);
  console.log(`   Parser: ${example.parser}`);

  const result = spawnSync(
    'node',
    [
      resolve(__dirname, '../parser-validator.js'),
      example.url,
      example.parser,
      example.templates,
    ],
    {
      cwd: resolve(__dirname, '..'),
      encoding: 'utf-8',
      timeout: 60000,
    }
  );

  if (result.status === 0 && result.stdout && result.stdout.trim().length > 0) {
    console.log('   ✅ PASSED - Parser produced output');
    console.log('\n   Output preview (first 500 chars):');
    console.log('   ' + result.stdout.substring(0, 500).split('\n').join('\n   '));
    passed++;
  } else {
    console.log('   ❌ FAILED');
    if (result.stderr) {
      console.log('   Error:', result.stderr);
    }
    if (result.stdout) {
      console.log('   Output:', result.stdout);
    }
    failed++;
  }
}

console.log('\n' + '='.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);

