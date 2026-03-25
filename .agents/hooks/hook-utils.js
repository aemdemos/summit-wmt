/**
 * Shared Utilities for Hooks
 *
 * Common utility functions used across multiple hooks.
 */

import fs from 'fs';
import path from 'path';

/**
 * Find the workspace root from a file path.
 * Looks for known workspace markers: 'tools', 'blocks', 'styles', 'scripts'.
 * @param {string} filePath - A file path within the workspace
 * @returns {string|null} The workspace root path, or null if not found
 */
export function findWorkspaceRoot(filePath) {
  const normalizedPath = path.normalize(filePath);
  const pathSegments = normalizedPath.split(path.sep);

  // Known directories that exist at the workspace root level
  const workspaceMarkers = ['tools', 'blocks', 'styles', 'scripts'];

  for (const marker of workspaceMarkers) {
    const idx = pathSegments.indexOf(marker);
    if (idx !== -1) {
      // Workspace root is everything before the marker
      return pathSegments.slice(0, idx).join(path.sep);
    }
  }

  return null;
}

/**
 * Read JSON input from stdin (for hook invocation).
 * @returns {Promise<object>} Parsed hook input
 */
export function readStdin() {
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
 * Create a debug logger that appends to a file.
 * @param {string} logPath - Path to the log file
 * @returns {(message: string, data?: object|null) => void}
 */
export function createDebugLog(logPath) {
  return (message, data = null) => {
    const timestamp = new Date().toISOString();
    const logEntry = data
      ? `[${timestamp}] ${message}\n${JSON.stringify(data, null, 2)}\n`
      : `[${timestamp}] ${message}\n`;
    try {
      fs.appendFileSync(logPath, logEntry);
    } catch (err) {
      // Ignore logging errors
    }
  };
}

/**
 * Load retry counts from a tracking file.
 * @param {string} trackingFile - Path to the JSON tracking file
 * @returns {Record<string, number>}
 */
export function loadRetryCounts(trackingFile) {
  try {
    if (fs.existsSync(trackingFile)) {
      return JSON.parse(fs.readFileSync(trackingFile, 'utf-8'));
    }
  } catch (err) {
    // Ignore
  }
  return {};
}

/**
 * Save retry counts to a tracking file.
 * @param {string} trackingFile - Path to the JSON tracking file
 * @param {Record<string, number>} counts
 */
export function saveRetryCounts(trackingFile, counts) {
  try {
    fs.writeFileSync(trackingFile, JSON.stringify(counts, null, 2));
  } catch (err) {
    // Ignore
  }
}

/**
 * Increment and return retry count for a file.
 * @param {string} filePath - Path to the file being validated
 * @param {string} trackingFile - Path to the JSON tracking file
 * @returns {number} New count for this file
 */
export function incrementRetryCount(filePath, trackingFile) {
  const counts = loadRetryCounts(trackingFile);
  const absolutePath = path.resolve(filePath);
  counts[absolutePath] = (counts[absolutePath] || 0) + 1;
  saveRetryCounts(trackingFile, counts);
  return counts[absolutePath];
}

/**
 * Reset retry count for a file.
 * @param {string} filePath - Path to the file
 * @param {string} trackingFile - Path to the JSON tracking file
 */
export function resetRetryCount(filePath, trackingFile) {
  const counts = loadRetryCounts(trackingFile);
  const absolutePath = path.resolve(filePath);
  delete counts[absolutePath];
  saveRetryCounts(trackingFile, counts);
}
