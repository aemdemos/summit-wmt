/**
 * HTML Wrapper Utility
 * 
 * Provides functionality to wrap semantic HTML content in full EDS structure
 * with head.html content from the workspace.
 */

import fs from 'fs';
import path from 'path';

/**
 * Wraps semantic HTML content in full EDS structure with head.html
 * 
 * @param {string} htmlContent - The semantic HTML content to wrap
 * @param {Object} options - Configuration options
 * @param {string} [options.filePath] - File path to derive workspace root from
 * @param {string} [options.workspaceRoot] - Explicit workspace root path (overrides filePath detection)
 * @param {Function} [options.logger] - Optional logging function for debug messages
 * @returns {string} Full HTML with EDS structure
 */
export function buildFullHtml(htmlContent, options = {}) {
    const { filePath, workspaceRoot: explicitWorkspaceRoot, logger = () => void 0 } = options;

    // Determine workspace root from file path or use explicit value
    let workspaceRoot = explicitWorkspaceRoot || '/workspace'; // Default for Docker

    if (!explicitWorkspaceRoot && filePath) {
        // File path format: /some/path/workspace/content/index.md
        // Extract workspace root: /some/path/workspace
        const workspaceMatch = filePath.match(/^(.+\/workspace)\//);
        if (workspaceMatch) {
            workspaceRoot = workspaceMatch[1];
            logger(`Detected workspace root: ${workspaceRoot}`);
        }
    }

    // Read head.html from workspace, with fallback to current directory
    let headHtmlPath = path.join(workspaceRoot, 'head.html');
    logger(`Looking for head.html at: ${headHtmlPath}`);

    // If not found in workspace, try current directory
    if (!fs.existsSync(headHtmlPath)) {
        const cwdHeadPath = path.join(process.cwd(), 'head.html');
        logger(`head.html not found in workspace, trying current directory: ${cwdHeadPath}`);
        if (fs.existsSync(cwdHeadPath)) {
            headHtmlPath = cwdHeadPath;
            logger(`Using head.html from current directory`);
        }
    }

    let headContent = '';
    if (fs.existsSync(headHtmlPath)) {
        try {
            headContent = fs.readFileSync(headHtmlPath, 'utf-8').trim();
            logger(`Read head.html (${headContent.length} bytes)`);
        } catch (error) {
            console.error(`⚠️  [Auto-Convert Hook] Failed to read head.html: ${error.message}`);
        }
    } else {
        console.error(`⚠️  [Auto-Convert Hook] head.html not found at ${headHtmlPath}`);
    }

    // Wrap semantic HTML in full EDS structure
    const fullHtml = `<!DOCTYPE html>
<html>
<head>
${headContent}
</head>
<body>
<header></header>
<main>
${htmlContent}
</main>
<footer></footer>
</body>
</html>`;

    return fullHtml;
}

