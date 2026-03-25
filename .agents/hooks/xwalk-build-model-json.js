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
 * Build JSON Hook
 *
 * This hook automatically runs `npm run build:json` when:
 * - a _*.json file in the blocks/ directory is modified, or
 * - a _*.json file in the models/ directory is modified.
 *
 * Hook Event: PostToolUse (Write|Edit)
 * Input: JSON via stdin containing tool_input with file_path
 * Output: JSON with build status
 */

import { execSync } from 'child_process';
import { existsSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { findWorkspaceRoot } from './hook-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Log to debug file for troubleshooting
 */
function debugLog(message, data = null) {
  const logPath = join(__dirname, 'xwalk-build-model-json-debug.log');
  const timestamp = new Date().toISOString();
  const logEntry = data
    ? `[${timestamp}] ${message}\n${JSON.stringify(data, null, 2)}\n`
    : `[${timestamp}] ${message}\n`;

  try {
    appendFileSync(logPath, logEntry);
  } catch (err) {
    // Ignore logging errors
  }
}

/**
 * Read JSON input from stdin
 */
async function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () => {
      try {
        const data = Buffer.concat(chunks).toString('utf-8');
        resolve(JSON.parse(data));
      } catch (error) {
        reject(new Error(`Failed to parse stdin JSON: ${error.message}`));
      }
    });
    process.stdin.on('error', reject);
  });
}

/**
 * Check if file is a watched JSON file:
 * - _*.json under blocks/
 * - _*.json under models/
 */
function isWatchedJsonFile(filePath) {
  if (!filePath) return false;

  // Normalize path separators
  const normalizedPath = filePath.replace(/\\/g, '/');

  // Check if path contains blocks/ directory and filename starts with _ and ends with .json
  const blocksMatch = /\/blocks\/.*\/_[^/]+\.json$/.test(normalizedPath);
  const startsWithBlocks = /^blocks\/.*\/_[^/]+\.json$/.test(normalizedPath);

  const modelsMatch = /\/models\/(?:.*\/)?_[^/]+\.json$/.test(normalizedPath);
  const startsWithModels = /^models\/(?:.*\/)?_[^/]+\.json$/.test(normalizedPath);

  return blocksMatch || startsWithBlocks || modelsMatch || startsWithModels;
}

/**
 * Run an npm command with the given arguments
 * @param {string} cwd - Working directory
 * @param {string[]} args - Arguments to pass to npm (e.g., ['ci'] or ['run', 'build:json'])
 */
function runNpmCommand(workspaceRoot, args) {
  try {
    const stdout = execSync(`npm ${args.join(' ')}`, {
      cwd: workspaceRoot,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { success: true, stdout, stderr: '' };
  } catch (error) {
    return {
      success: false,
      code: error.status,
      stdout: error.stdout || '',
      stderr: error.stderr || '',
    };
  }
}

/**
 * Main hook logic
 */
try {
  debugLog('=== Build JSON Hook invoked ===');

  // Read hook input from stdin
  const hookInput = await readStdin();

  // Extract file path from tool input
  const filePath = hookInput?.tool_input?.file_path;

  debugLog(`Received hook input. Filepath: ${filePath}`);

  if (!filePath) {
    debugLog('No file path provided, exiting');
    process.exit(0);
  }

  // Only process watched JSON files
  if (!isWatchedJsonFile(filePath)) {
    debugLog('File is not a watched JSON file, exiting');
    process.exit(0);
  }

  console.error(`[Build JSON Hook] Detected watched JSON change: ${filePath}`);
  debugLog('Detected watched JSON change');

  // Determine workspace root from file path
  const workspaceRoot = findWorkspaceRoot(filePath);
  if (!workspaceRoot) {
    console.error(`[Build JSON Hook] Could not determine workspace root from: ${filePath}`);
    debugLog('Could not determine workspace root', { filePath });
    process.exit(1);
  }
  debugLog(`Found workspace root: ${workspaceRoot}`);

  // Check if node_modules exists, if not run npm ci
  const nodeModulesPath = join(workspaceRoot, 'node_modules');
  if (!existsSync(nodeModulesPath)) {
    console.error(`[Build JSON Hook] node_modules not found, running npm ci...`);
    debugLog('node_modules not found, running npm ci');
    const ciResult = runNpmCommand(workspaceRoot, ['ci']);

    if (!ciResult.success) {
      console.error(`[Build JSON Hook] npm ci failed with code ${ciResult.code}`);
      if (ciResult.stderr) {
        console.error(ciResult.stderr);
      }
      debugLog('npm ci failed', ciResult);
      console.log(JSON.stringify({
        success: false,
        message: `npm ci failed`,
        file: filePath,
        error: ciResult.stderr || `Exit code: ${ciResult.code}`,
      }));
      process.exit(1);
    }
    console.error(`[Build JSON Hook] npm ci completed successfully`);
    debugLog('npm ci completed successfully');
  } else {
    debugLog('node_modules exists, skipping npm ci', { nodeModulesPath });
  }

  console.error(`[Build JSON Hook] Running npm run build:json...`);
  debugLog('Running npm run build:json');

  const result = runNpmCommand(workspaceRoot, ['run', 'build:json']);

  if (result.success) {
    console.error(`[Build JSON Hook] build:json completed successfully`);
    debugLog('build:json completed successfully');
    console.log(JSON.stringify({
      success: true,
      message: `Ran npm run build:json after ${filePath} was modified`,
      file: filePath,
    }));
  } else {
    console.error(`[Build JSON Hook] build:json failed with code ${result.code}`);
    if (result.stderr) {
      console.error(result.stderr);
    }
    debugLog('build:json failed', result);
    console.log(JSON.stringify({
      success: false,
      message: `npm run build:json failed`,
      file: filePath,
      error: result.stderr || `Exit code: ${result.code}`,
    }));
  }
} catch (error) {
  console.error(`[Build JSON Hook] Error: ${error.message}`);
  debugLog('Hook error', { message: error.message, stack: error.stack });
  process.exit(1);
}
