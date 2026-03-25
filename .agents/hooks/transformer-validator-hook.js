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
 * Transformer Validator Hook
 *
 * Validates transformer scripts in tools/importer/transformers/ by running them
 * against a live URL and passing the output to Claude for interpretation.
 *
 * Hook Events:
 * - PostToolUse (Write|Edit): Validates .js files in tools/importer/transformers/
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
let RETRY_TRACKING_FILE = path.join(os.tmpdir(), 'excat-transformer-retries-default.json');

const MAX_RETRIES = 10;

const VALIDATOR_SCRIPT_PATH = path.join(__dirname, 'import-validator', 'transformer-validator.js');
const debugLog = createDebugLog(path.join(__dirname, 'transformer-validator-debug.log'));

function initSessionFiles(hookInput) {
  sessionId = hookInput?.session_id || 'default';
  RETRY_TRACKING_FILE = path.join(os.tmpdir(), `excat-transformer-retries-${sessionId}.json`);
}

/**
 * Check if file is a transformer file in tools/importer/transformers/
 */
function isTransformerFile(filePath) {
  if (!filePath) return false;

  const normalizedPath = path.normalize(filePath);
  const pathSegments = normalizedPath.split(path.sep);

  const toolsIdx = pathSegments.indexOf('tools');
  if (toolsIdx === -1) return false;

  const importerIdx = pathSegments.indexOf('importer');
  if (importerIdx === -1 || importerIdx !== toolsIdx + 1) return false;

  const transformersIdx = pathSegments.indexOf('transformers');
  if (transformersIdx === -1 || transformersIdx !== importerIdx + 1) return false;

  return normalizedPath.endsWith('.js');
}

/**
 * Get first URL from page-templates.json for transformer validation
 */
function findUrlForTransformer(workspaceRoot) {
  const pageTemplatesPath = path.join(workspaceRoot, 'tools', 'importer', 'page-templates.json');

  if (!fs.existsSync(pageTemplatesPath)) {
    debugLog(`page-templates.json not found at: ${pageTemplatesPath}`);
    return { error: 'page-templates.json not found' };
  }

  try {
    const pageTemplates = JSON.parse(fs.readFileSync(pageTemplatesPath, 'utf-8'));
    const templates = pageTemplates.templates || [];
    for (const template of templates) {
      const urls = template.urls || [];
      if (urls.length > 0) {
        debugLog(`Using URL for transformer validation: ${urls[0]} (template: ${template.name})`);
        return {
          url: urls[0],
          templateName: template.name,
          pageTemplatesPath,
        };
      }
    }
    debugLog('No URLs found in page-templates.json');
    return { error: 'No URLs found in page-templates.json. Add at least one template with urls.' };
  } catch (error) {
    debugLog(`Error parsing page-templates.json: ${error.message}`);
    return { error: `Failed to parse page-templates.json: ${error.message}` };
  }
}

/**
 * Run the transformer validator and capture output
 */
function runTransformerValidator(url, transformerPath, pageTemplatesPath) {
  const validatorCwd = path.dirname(VALIDATOR_SCRIPT_PATH);

  try {
    debugLog(`Running transformer-validator.js`, { url, transformerPath, pageTemplatesPath, cwd: validatorCwd });

    const output = execSync(
      `node "${VALIDATOR_SCRIPT_PATH}" "${url}" "${transformerPath}" "${pageTemplatesPath}"`,
      {
        cwd: validatorCwd,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 60000,
      }
    );

    debugLog(`Validator output:\n${output}`);
    return { success: true, output: output.trim() };
  } catch (error) {
    const stdout = error.stdout || '';
    const stderr = error.stderr || '';

    debugLog(`Validator error`, { stdout, stderr, message: error.message });

    if (stdout.trim()) {
      return { success: false, output: stdout.trim(), error: stderr || error.message };
    }
    return { success: false, output: '', error: stderr || error.message };
  }
}

/**
 * Handle PostToolUse event - validate the transformer file
 */
async function handlePostToolUse(filePath) {
  if (!isTransformerFile(filePath)) {
    debugLog(`Not a transformer file, skipping: ${filePath}`);
    return;
  }

  debugLog(`Processing transformer file: ${filePath}`);

  const workspaceRoot = findWorkspaceRoot(filePath);
  if (!workspaceRoot) {
    debugLog(`Could not determine workspace root for: ${filePath}`);
    return;
  }

  if (!fs.existsSync(VALIDATOR_SCRIPT_PATH)) {
    debugLog(`Validator script not found at: ${VALIDATOR_SCRIPT_PATH}`);
    console.error(`⚠️ [Transformer Validator Hook] Validator script not found`);
    return;
  }

  const matchResult = findUrlForTransformer(workspaceRoot);

  if (matchResult.error) {
    console.log(JSON.stringify({
      reason: `⚠️ Transformer validation skipped: ${matchResult.error}\n\nTo enable validation, ensure tools/importer/page-templates.json has at least one template with urls.`
    }));
    return;
  }

  const retryCount = incrementRetryCount(filePath, RETRY_TRACKING_FILE);
  debugLog(`Retry count for ${filePath}: ${retryCount}`);

  if (retryCount > MAX_RETRIES) {
    resetRetryCount(filePath, RETRY_TRACKING_FILE);
    console.log(JSON.stringify({
      reason: `⚠️ Max validation attempts (${MAX_RETRIES}) reached for ${path.basename(filePath)}. Proceeding without further validation.\n\nIf you need to continue validating, edit the file again.`
    }));
    return;
  }

  console.error(`🔍 [Transformer Validator Hook] Validating ${path.basename(filePath)} against ${matchResult.url} (attempt ${retryCount}/${MAX_RETRIES})...`);

  const validationDetails = `**Transformer:** \`${path.basename(filePath)}\`
**Template:** ${matchResult.templateName}
**Test URL:** ${matchResult.url}`;

  const result = runTransformerValidator(
    matchResult.url,
    path.resolve(filePath),
    path.resolve(matchResult.pageTemplatesPath)
  );

  if (result.success && result.output) {
    const context = `## Transformer Validation Output (attempt ${retryCount}/${MAX_RETRIES})

${validationDetails}

### Result

${result.output}
`;

    console.log(JSON.stringify({
      decision: 'block',
      reason: 'Review the validation output in additionalContext. If the transformer ran without errors and the DOM summary looks correct, you may proceed. If there are errors or unexpected results, fix the transformer and save again.',
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: context,
      },
    }));
  } else if (result.error) {
    const context = `## Transformer Validation Failed (attempt ${retryCount}/${MAX_RETRIES})

${validationDetails}

### Error

\`\`\`
${result.error}
\`\`\`

${result.output ? `### Partial Output\n\n${result.output}` : ''}`;

    console.log(JSON.stringify({
      decision: 'block',
      reason: 'The transformer validation encountered an error. Please review the error message and fix the transformer.',
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: context,
      },
    }));
  } else {
    const context = `## Transformer Validation - No Output (attempt ${retryCount}/${MAX_RETRIES})

${validationDetails}

The validator produced no output.`;

    console.log(JSON.stringify({
      decision: 'block',
      reason: 'Please verify the transformer runs correctly and that the test URL matches a template in page-templates.json.',
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: context,
      },
    }));
  }
}

try {
  debugLog('=== Transformer Validator Hook invoked ===');

  const hookInput = await readStdin();
  debugLog('Received hook input', hookInput);

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
  console.error(`❌ [Transformer Validator Hook] Unexpected error: ${error.message}`);
  process.exit(1);
}
