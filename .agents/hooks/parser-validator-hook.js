#!/usr/bin/env node

/*
 * Copyright 2026 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/**
 * Parser Validator Hook
 *
 * This hook validates parser scripts in tools/importer/parsers/ by running them
 * against live URLs and passing the output to Claude for interpretation.
 *
 * Hook Events:
 * - PostToolUse (Write|Edit): Validates .js files in tools/importer/parsers/
 *
 * Input: JSON via stdin containing tool_input with file_path
 * Output: JSON with decision/reason for Claude to interpret
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import {
  findWorkspaceRoot,
  readStdin,
  createDebugLog,
  incrementRetryCount,
  resetRetryCount,
} from './hook-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let sessionId = 'default';
let RETRY_TRACKING_FILE = path.join(os.tmpdir(), 'excat-parser-retries-default.json');

const MAX_RETRIES = 10;

const VALIDATOR_SCRIPT_PATH = path.join(__dirname, 'import-validator', 'parser-validator.js');
const debugLog = createDebugLog(path.join(__dirname, 'parser-validator-debug.log'));

function initSessionFiles(hookInput) {
  sessionId = hookInput?.session_id || 'default';
  RETRY_TRACKING_FILE = path.join(os.tmpdir(), `excat-parser-retries-${sessionId}.json`);
}

/**
 * Check if file is a parser file in tools/importer/parsers/
 */
function isParserFile(filePath) {
  if (!filePath) return false;

  // Normalize path for cross-platform compatibility
  const normalizedPath = path.normalize(filePath);
  const pathSegments = normalizedPath.split(path.sep);

  // Check if file is in tools/importer/parsers/ directory
  const toolsIdx = pathSegments.indexOf('tools');
  if (toolsIdx === -1) return false;

  const importerIdx = pathSegments.indexOf('importer');
  if (importerIdx === -1 || importerIdx !== toolsIdx + 1) return false;

  const parsersIdx = pathSegments.indexOf('parsers');
  if (parsersIdx === -1 || parsersIdx !== importerIdx + 1) return false;

  // Check if it's a .js file
  return normalizedPath.endsWith('.js');
}

/**
 * Load page-templates.json and find matching block/URL for parser
 */
function findMatchingUrlForParser(parserPath, workspaceRoot) {
  const pageTemplatesPath = path.join(workspaceRoot, 'tools', 'importer', 'page-templates.json');

  if (!fs.existsSync(pageTemplatesPath)) {
    debugLog(`page-templates.json not found at: ${pageTemplatesPath}`);
    return { error: 'page-templates.json not found' };
  }

  try {
    const pageTemplates = JSON.parse(fs.readFileSync(pageTemplatesPath, 'utf-8'));
    const parserName = path.basename(parserPath, '.js').toLowerCase();

    debugLog(`Looking for block matching parser: ${parserName}`);

    // Search through templates for matching block
    for (const template of pageTemplates.templates || []) {
      for (const block of template.blocks || []) {
        const blockName = (block.name || '').toLowerCase();
        if (blockName === parserName) {
          const url = template.urls?.[0];
          if (url) {
            debugLog(`Found matching block: ${block.name} with URL: ${url}`);
            return {
              url,
              blockName: block.name,
              templateName: template.name,
              pageTemplatesPath
            };
          }
        }
      }
    }

    debugLog(`No matching block found for parser: ${parserName}`);
    return { error: `No block named "${parserName}" found in page-templates.json` };
  } catch (error) {
    debugLog(`Error parsing page-templates.json: ${error.message}`);
    return { error: `Failed to parse page-templates.json: ${error.message}` };
  }
}

/**
 * Run the parser validator and capture output
 */
function runParserValidator(url, parserPath, pageTemplatesPath) {
  const validatorCwd = path.dirname(VALIDATOR_SCRIPT_PATH);

  try {
    debugLog(`Running parser-validator.js`, { url, parserPath, pageTemplatesPath, cwd: validatorCwd });

    const output = execSync(
      `node "${VALIDATOR_SCRIPT_PATH}" "${url}" "${parserPath}" "${pageTemplatesPath}"`,
      {
        cwd: validatorCwd,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 60000 // 60 second timeout
      }
    );

    debugLog(`Validator output:\n${output}`);
    return { success: true, output: output.trim() };
  } catch (error) {
    const stdout = error.stdout || '';
    const stderr = error.stderr || '';

    debugLog(`Validator error`, { stdout, stderr, message: error.message });

    // If there's stdout, it might contain partial results
    if (stdout.trim()) {
      return { success: false, output: stdout.trim(), error: stderr || error.message };
    }

    return { success: false, output: '', error: stderr || error.message };
  }
}

/**
 * Handle PostToolUse event - validate the parser file
 */
async function handlePostToolUse(filePath) {
  if (!isParserFile(filePath)) {
    debugLog(`Not a parser file, skipping: ${filePath}`);
    return;
  }

  debugLog(`Processing parser file: ${filePath}`);

  const workspaceRoot = findWorkspaceRoot(filePath);
  if (!workspaceRoot) {
    debugLog(`Could not determine workspace root for: ${filePath}`);
    return;
  }

  // Check if validator script exists
  if (!fs.existsSync(VALIDATOR_SCRIPT_PATH)) {
    debugLog(`Validator script not found at: ${VALIDATOR_SCRIPT_PATH}`);
    console.error(`⚠️ [Parser Validator Hook] Validator script not found`);
    return;
  }

  // Find matching URL for this parser
  const matchResult = findMatchingUrlForParser(filePath, workspaceRoot);

  if (matchResult.error) {
    console.log(JSON.stringify({
      reason: `⚠️ Parser validation skipped: ${matchResult.error}\n\nTo enable validation, add a block definition for "${path.basename(filePath, '.js')}" in tools/importer/page-templates.json`
    }));
    return;
  }

  // Check retry count
  const retryCount = incrementRetryCount(filePath, RETRY_TRACKING_FILE);
  debugLog(`Retry count for ${filePath}: ${retryCount}`);

  if (retryCount > MAX_RETRIES) {
    resetRetryCount(filePath, RETRY_TRACKING_FILE);
    console.log(JSON.stringify({
      reason: `⚠️ Max validation attempts (${MAX_RETRIES}) reached for ${path.basename(filePath)}. Proceeding without further validation.\n\nIf you need to continue validating, edit the file again.`
    }));
    return;
  }

  console.error(`🔍 [Parser Validator Hook] Validating ${path.basename(filePath)} against ${matchResult.url} (attempt ${retryCount}/${MAX_RETRIES})...`);

  // Common header for all validation messages
  const validationDetails = `**Parser:** \`${path.basename(filePath)}\`
**Block:** ${matchResult.blockName}
**Test URL:** ${matchResult.url}`;

  // Run the validator (use absolute paths since validator runs in different cwd)
  const result = runParserValidator(
    matchResult.url,
    path.resolve(filePath),
    path.resolve(matchResult.pageTemplatesPath)
  );

  if (result.success && result.output) {
    // Validation produced output - let Claude interpret it
    const context = `## Parser Validation Output (attempt ${retryCount}/${MAX_RETRIES})

${validationDetails}

### Extracted Content

${result.output}
`;

    console.log(JSON.stringify({
      decision: 'block',
      reason: 'Review the extracted content included in additionalContext. If the parser correctly captured the expected content from the source page, you may proceed. If content is missing, malformed, or incorrect, fix the parser and save again.',
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: context
      }
    }));
  } else if (result.error) {
    // Validation failed with error
    const context = `## Parser Validation Failed (attempt ${retryCount}/${MAX_RETRIES})

${validationDetails}

### Error

\`\`\`
${result.error}
\`\`\`

${result.output ? `### Partial Output\n\n${result.output}` : ''}`;

    console.log(JSON.stringify({
      decision: 'block',
      reason: 'The parser validation encountered an error. Please review the error message and fix the parser.',
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: context
      }
    }));
  } else {
    // No output at all
    const context = `## Parser Validation - No Output (attempt ${retryCount}/${MAX_RETRIES})

${validationDetails}

The parser produced no output. This usually means:
- The parser's selector didn't match any elements on the page
- The parse function returned nothing`;

    console.log(JSON.stringify({
      decision: 'block',
      reason: 'Please verify the selector in page-templates.json matches elements on the test URL, and that the parser correctly transforms matched elements.',
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: context
      }
    }));
  }
}

/**
 * Main hook logic
 */
try {
  debugLog('=== Parser Validator Hook invoked ===');

  const hookInput = await readStdin();
  debugLog('Received hook input', hookInput);

  // Initialize session-scoped file paths
  initSessionFiles(hookInput);

  const filePath = hookInput?.tool_input?.file_path;
  debugLog(`File path: ${filePath}`);

  if (filePath) {
    await handlePostToolUse(filePath);
  } else {
    debugLog('No file path found in input');
  }

} catch (error) {
  debugLog(`Unexpected error: ${error.message}`, { stack: error.stack });
  console.error(`❌ [Parser Validator Hook] Unexpected error: ${error.message}`);
  process.exit(1);
}
