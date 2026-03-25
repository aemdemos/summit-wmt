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
 * Auto-Lint Blocks Hook
 *
 * This hook tracks edited block JavaScript files and runs ESLint on them at session end.
 *
 * Hook Events:
 * - PostToolUse (Write|Edit): Tracks .js files in blocks/ directory (no linting yet)
 * - Stop: Runs ESLint on all tracked files at session end
 *
 * Input: JSON via stdin containing tool_input with file_path (for PostToolUse)
 *        or hook_event (for Stop)
 * Output: JSON with tracking/linting status
 *
 * Safety Features:
 * - Append-only tracking file to prevent race conditions with parallel edits
 * - Session-scoped files to prevent cross-session bleeding
 * - Dynamic attempt tracking to prevent infinite loops:
 *   - Max attempts = min(2 + ceil(errorCount/3), 5)
 *   - 1-3 errors → 3 attempts, 4-6 errors → 4 attempts, 7+ errors → 5 attempts
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';

// Get the directory of the current module

/**
 * Calculate maximum lint attempts based on error count
 * Formula: base 2 attempts + 1 per 3 errors, capped at 5
 * This gives more attempts for files with many errors while preventing infinite loops
 * 
 * Examples:
 *   1-3 errors → 3 attempts
 *   4-6 errors → 4 attempts
 *   7+ errors  → 5 attempts (capped)
 */
function getMaxAttempts(errorCount) {
  return Math.min(2 + Math.ceil(errorCount / 3), 5);
}

// Session-scoped file paths (initialized when we receive hook input with session_id)
let sessionId = 'default';
let TRACKING_FILE = path.join(os.tmpdir(), 'excat-edited-blocks-default.txt');
let ATTEMPTS_FILE = path.join(os.tmpdir(), 'excat-lint-attempts-default.json');
let DEBUG_LOG_FILE = path.join(os.tmpdir(), 'excat-lint-debug-default.log');

/**
 * Initialize session-scoped file paths
 */
function initSessionFiles(hookInput) {
  sessionId = hookInput?.session_id || 'default';
  TRACKING_FILE = path.join(os.tmpdir(), `excat-edited-blocks-${sessionId}.txt`);
  ATTEMPTS_FILE = path.join(os.tmpdir(), `excat-lint-attempts-${sessionId}.json`);
  DEBUG_LOG_FILE = path.join(os.tmpdir(), `excat-lint-debug-${sessionId}.log`);
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
 * Log to debug file in temp directory (not plugin directory)
 */
function debugLog(message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = data
    ? `[${timestamp}] ${message}\n${JSON.stringify(data, null, 2)}\n`
    : `[${timestamp}] ${message}\n`;

  try {
    fs.appendFileSync(DEBUG_LOG_FILE, logEntry);
  } catch (err) {
    // Ignore logging errors
  }
}

/**
 * Check if file is a lintable file (JS or CSS in blocks/, scripts/, or styles/)
 */
function isLintableFile(filePath) {
  if (!filePath) return false;

  // Normalize path for cross-platform compatibility
  const normalizedPath = path.normalize(filePath);
  const pathSegments = normalizedPath.split(path.sep);

  // Check if file is in a lintable folder
  const isInLintableFolder =
    pathSegments.includes('blocks') ||
    pathSegments.includes('scripts') ||
    pathSegments.includes('styles');

  if (!isInLintableFolder) return false;

  // Check if file has a lintable extension
  return normalizedPath.endsWith('.js') || normalizedPath.endsWith('.css');
}

/**
 * Get the lint command based on file type
 * Uses direct eslint/stylelint with JSON format for reliable parsing
 */
function getLintCommand(filePath) {
  if (filePath.endsWith('.css')) {
    return `npx stylelint "${filePath}" --formatter json`;
  }
  return `npx eslint "${filePath}" --format json`;
}

/**
 * Get the lint fix command based on file type
 */
function getLintFixCommand(filePath) {
  if (filePath.endsWith('.css')) {
    return `npx stylelint "${filePath}" --fix`;
  }
  return `npx eslint "${filePath}" --fix`;
}

/**
 * Load tracked files from append-only temp file (deduplicated)
 * Uses append-only format to avoid race conditions with parallel edits
 */
function loadTrackedFiles() {
  try {
    if (fs.existsSync(TRACKING_FILE)) {
      const content = fs.readFileSync(TRACKING_FILE, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      return new Set(lines); // Set automatically deduplicates
    }
  } catch (err) {
    debugLog(`Error loading tracked files: ${err.message}`);
  }
  return new Set();
}

/**
 * Track a file by appending to the tracking file (atomic, race-safe)
 * Append operations are atomic on most filesystems, avoiding read-modify-write races
 */
function trackFile(filePath) {
  try {
    fs.appendFileSync(TRACKING_FILE, filePath + '\n');
    return loadTrackedFiles().size;
  } catch (err) {
    debugLog(`Error tracking file: ${err.message}`);
    return 0;
  }
}

/**
 * Clear tracked files
 */
function clearTrackedFiles() {
  try {
    if (fs.existsSync(TRACKING_FILE)) {
      fs.unlinkSync(TRACKING_FILE);
    }
  } catch (err) {
    debugLog(`Error clearing tracked files: ${err.message}`);
  }
}

/**
 * Load lint attempts per file (for infinite loop prevention)
 */
function loadAttempts() {
  try {
    if (fs.existsSync(ATTEMPTS_FILE)) {
      return JSON.parse(fs.readFileSync(ATTEMPTS_FILE, 'utf-8'));
    }
  } catch (err) {
    debugLog(`Error loading attempts: ${err.message}`);
  }
  return {};
}

/**
 * Save lint attempts
 */
function saveAttempts(attempts) {
  try {
    fs.writeFileSync(ATTEMPTS_FILE, JSON.stringify(attempts, null, 2));
  } catch (err) {
    debugLog(`Error saving attempts: ${err.message}`);
  }
}

/**
 * Clear all session files (tracking + attempts)
 */
function clearSessionFiles() {
  clearTrackedFiles();
  try {
    if (fs.existsSync(ATTEMPTS_FILE)) {
      fs.unlinkSync(ATTEMPTS_FILE);
    }
  } catch (err) {
    debugLog(`Error clearing attempts: ${err.message}`);
  }
}

/**
 * Run linter on a file and return results
 */
function runLint(filePath, workspaceRoot) {
  try {
    const command = getLintCommand(filePath);
    debugLog(`Running: ${command}`);
    
    const output = execSync(command, {
      cwd: workspaceRoot,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    debugLog(`Lint stdout: ${output}`);
    
    // Parse JSON output even on success (might have warnings)
    const errors = parseLintJsonOutput(output, filePath);
    return { success: errors.length === 0, errors };
  } catch (error) {
    // Try stdout first (ESLint/Stylelint JSON goes to stdout), then stderr
    const stdout = error.stdout || '';
    const stderr = error.stderr || '';
    const output = stdout || stderr || error.message;
    
    debugLog(`Lint stdout: ${stdout}`);
    debugLog(`Lint stderr: ${stderr}`);
    
    const errors = parseLintJsonOutput(output, filePath);
    // If no actual errors found in output, consider it a success
    if (errors.length === 0) {
      return { success: true, errors: [] };
    }
    return { success: false, errors, rawOutput: output };
  }
}

/**
 * Run lint fix on a file
 */
function runLintFix(filePath, workspaceRoot) {
  try {
    const command = getLintFixCommand(filePath);
    debugLog(`Running: ${command}`);
    
    execSync(command, {
      cwd: workspaceRoot,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Parse JSON output from ESLint or Stylelint
 */
function parseLintJsonOutput(output, filePath) {
  const errors = [];
  
  // Handle empty or undefined output
  if (!output || output.trim() === '') {
    debugLog('Empty lint output - assuming no errors');
    return errors;
  }
  
  try {
    const results = JSON.parse(output.trim());
    
    // Handle empty array (no files or no issues)
    if (!Array.isArray(results) || results.length === 0) {
      return errors;
    }
    
    // ESLint format: array of { filePath, messages: [...] }
    // Stylelint format: array of { source, warnings: [...] }
    for (const result of results) {
      const messages = result.messages || result.warnings || [];
      for (const msg of messages) {
        // Only include errors, not warnings (severity 2 = error, 1 = warning)
        if (msg.severity === 2 || msg.severity === 'error') {
          errors.push({
            line: msg.line,
            column: msg.column,
            severity: 'error',
            message: msg.message,
            rule: msg.ruleId || msg.rule || 'unknown'
          });
        }
      }
    }
  } catch (parseError) {
    // If JSON parsing fails, log it but don't fail
    debugLog(`Failed to parse JSON output: ${parseError.message}`);
    debugLog(`Raw output (first 500 chars): ${output.substring(0, 500)}`);
  }
  
  return errors;
}

/**
 * Find workspace root (directory containing package.json)
 */
function findWorkspaceRoot(startPath) {
  // Normalize to an absolute path to ensure path.parse().root is meaningful
  let currentPath = path.resolve(startPath);
  const root = path.parse(currentPath).root;

  while (currentPath !== root) {
    const packageJsonPath = path.join(currentPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      return currentPath;
    }
    const parentPath = path.dirname(currentPath);
    // Safety guard: if dirname doesn't change the path, stop to avoid infinite loops
    if (parentPath === currentPath) {
      break;
    }
    currentPath = parentPath;
  }
  return null;
}

/**
 * Handle PostToolUse event - track the file
 */
function handlePostToolUse(filePath) {
  if (!isLintableFile(filePath)) {
    debugLog('Not a lintable file, skipping');
    return;
  }

  const totalTracked = trackFile(filePath);
  debugLog(`📝 [Auto-Lint Hook] Tracking file: ${path.basename(filePath)} (${totalTracked} file(s) queued)`);
  
  console.log(JSON.stringify({
    success: true,
    action: 'tracked',
    file: filePath,
    totalTracked: totalTracked,
    message: `Tracked ${path.basename(filePath)} for linting at session end`
  }));
}

/**
 * Handle Stop event - lint all tracked files with dynamic attempt limiting
 * Prevents infinite loops by tracking attempts per file based on initial error count
 * 
 * Attempts data structure:
 * {
 *   "/path/to/file.js": { attempts: 1, initialErrorCount: 5, maxAttempts: 4 }
 * }
 */
async function handleStop() {
  const trackedFiles = loadTrackedFiles();
  const attemptsData = loadAttempts();
  
  if (trackedFiles.size === 0) {
    debugLog('✅ [Auto-Lint Hook] No files were edited this session');
    clearSessionFiles();
    console.log(JSON.stringify({
      reason: 'No lintable files were edited this session'
    }));
    return;
  }

  debugLog(`\n🔍 [Auto-Lint Hook] Linting ${trackedFiles.size} edited file(s)...`);
  debugLog(`${'─'.repeat(60)}`);

  const results = {
    passed: [],
    failed: [],
    skipped: [], // Files that exceeded max attempts
    errors: {}
  };

  for (const filePath of trackedFiles) {
    // Check if file still exists
    if (!fs.existsSync(filePath)) {
      debugLog(`File no longer exists: ${filePath}`);
      continue;
    }

    // Get or initialize attempt tracking for this file
    let fileData = attemptsData[filePath] || { attempts: 0, initialErrorCount: 0, maxAttempts: 3 };
    
    // Skip files that have exceeded their max retry limit (prevents infinite loops)
    if (fileData.attempts >= fileData.maxAttempts) {
      debugLog(`⚠️ Skipping ${path.basename(filePath)} after ${fileData.attempts} failed attempts (max: ${fileData.maxAttempts})`);
      results.skipped.push(filePath);
      continue;
    }

    const workspaceRoot = findWorkspaceRoot(path.dirname(filePath));
    if (!workspaceRoot) {
      debugLog(`⚠️  Could not find workspace root for ${path.basename(filePath)}`);
      continue;
    }

    debugLog(`\n📄 ${path.basename(filePath)} (attempt ${fileData.attempts + 1}/${fileData.maxAttempts})`);
    
    // First try lint:fix
    debugLog(`   Running lint:fix...`);
    runLintFix(filePath, workspaceRoot);
    
    // Then check if it passes
    const result = runLint(filePath, workspaceRoot);
    
    if (result.success) {
      debugLog(`   ✅ Passed`);
      results.passed.push(filePath);
      delete attemptsData[filePath]; // Clear attempts on success
    } else {
      const errorCount = result.errors.length;
      debugLog(`   ❌ ${errorCount} error(s) remaining:`);
      for (const error of result.errors) {
        debugLog(`      Line ${error.line}:${error.column} - ${error.message} (${error.rule})`);
      }
      
      // On first failure, set initial error count and calculate max attempts
      if (fileData.attempts === 0) {
        fileData.initialErrorCount = errorCount;
        fileData.maxAttempts = getMaxAttempts(errorCount);
        debugLog(`   📊 Initial error count: ${errorCount}, max attempts set to: ${fileData.maxAttempts}`);
      }
      
      fileData.attempts += 1;
      attemptsData[filePath] = fileData;
      
      results.failed.push(filePath);
      results.errors[filePath] = result.errors;
    }
  }

  debugLog(`\n${'─'.repeat(60)}`);
  debugLog(`📊 [Auto-Lint Hook] Summary:`);
  debugLog(`   ✅ Passed: ${results.passed.length}`);
  debugLog(`   ❌ Failed: ${results.failed.length}`);
  debugLog(`   ⏭️  Skipped (max attempts): ${results.skipped.length}`);

  // Save updated attempts (persists across stop attempts within session)
  saveAttempts(attemptsData);
  
  // Clear tracking file (will be re-populated if Claude edits again)
  clearTrackedFiles();

  // Determine if we should block or allow
  // Only block if there are failures that haven't exhausted their retries
  const retryableFailures = results.failed.filter(f => {
    const data = attemptsData[f];
    return data && data.attempts < data.maxAttempts;
  });
  
  if (results.failed.length === 0) {
    // All passed!
    clearSessionFiles();
    console.log(JSON.stringify({
      reason: `All ${results.passed.length} file(s) passed linting`
    }));
  } else if (retryableFailures.length === 0) {
    // All failures have exhausted retries - allow stop with warning
    const exhaustedFiles = [...results.failed, ...results.skipped].map(f => path.basename(f)).join(', ');
    debugLog(`\n⚠️ Allowing stop - all failures exhausted retries: ${exhaustedFiles}`);
    console.log(JSON.stringify({
      reason: `Allowing stop. ${results.failed.length + results.skipped.length} file(s) have unfixable lint errors after max attempts: ${exhaustedFiles}. Manual intervention required.`
    }));
  } else {
    // Some files failed that haven't exhausted retries - block and ask Claude to fix
    let errorDetails = `${retryableFailures.length} file(s) have lint errors. Please fix them:\n\n`;
    
    for (const file of retryableFailures) {
      const fileErrors = results.errors[file] || [];
      const fileData = attemptsData[file] || { attempts: 0, maxAttempts: 3 };
      errorDetails += `📄 ${file} (attempt ${fileData.attempts}/${fileData.maxAttempts})\n`;
      for (const err of fileErrors) {
        errorDetails += `   Line ${err.line}:${err.column} - ${err.message} (${err.rule})\n`;
      }
      errorDetails += '\n';
    }
    
    if (results.skipped.length > 0) {
      errorDetails += `\n⏭️ Skipped files (max attempts reached): ${results.skipped.map(f => path.basename(f)).join(', ')}\n`;
    }
    
    errorDetails += '\nPlease read each file, fix the lint errors, and save the changes.';
    
    console.log(JSON.stringify({
      decision: 'block',
      reason: errorDetails
    }));
  }
}

/**
 * Main hook logic
 */
async function main() {
  try {
    const hookInput = await readStdin();
    
    // Initialize session-scoped file paths
    initSessionFiles(hookInput);
    
    debugLog('=== Auto-Lint Hook invoked ===');
    debugLog('Received hook input', hookInput);

    const hookEvent = hookInput?.hook_event_name || hookInput?.hook_event || 'PostToolUse';
    debugLog(`Hook event: ${hookEvent}`);

    if (hookEvent === 'Stop') {
      await handleStop();
    } else {
      // PostToolUse
      const filePath = hookInput?.tool_input?.file_path;
      debugLog(`File path: ${filePath}`);

      if (filePath) {
        handlePostToolUse(filePath);
      } else {
        debugLog('No file path found');
      }
    }

  } catch (error) {
    debugLog(`Unexpected error: ${error.message}`, { stack: error.stack });
    console.error(`❌ [Auto-Lint Hook] Unexpected error: ${error.message}`);
    process.exit(0);
  }
}

main();
