import { execFileSync } from 'node:child_process';
import { RallyError, EXIT_CONFIG } from './errors.js';

const REQUIRED_TOOLS = ['git', 'gh', 'npx'];

/**
 * Check that required CLI tools are available on the system.
 * Returns an array of missing tool names (empty if all present).
 *
 * @param {object} [opts]
 * @param {string[]} [opts.tools] - Tools to check (defaults to REQUIRED_TOOLS)
 * @param {Function} [opts._exec] - Injectable execFileSync (for testing)
 * @returns {string[]} Array of missing tool names
 */
export function checkTools(opts = {}) {
  const toolsToCheck = opts.tools || REQUIRED_TOOLS;
  const missing = [];

  for (const tool of toolsToCheck) {
    try {
      if (opts._exec) {
        opts._exec(tool, ['--version'], { stdio: 'pipe' });
      } else if (process.platform === 'win32') {
        // On Windows, execFileSync can't resolve .cmd/.bat files (e.g. npx.cmd).
        // Use `where` (a Windows built-in) to check PATH resolution instead.
        execFileSync('where', [tool], { stdio: 'pipe' });
      } else {
        execFileSync(tool, ['--version'], { stdio: 'pipe' });
      }
    } catch {
      missing.push(tool);
    }
  }

  return missing;
}

/**
 * Assert that specified CLI tools are available.
 * Throws a RallyError with EXIT_CONFIG if any are missing.
 *
 * @param {string[] | object} [toolsOrOpts] - Tools to check (array) or options object
 * @param {object} [opts] - Options object (ignored if toolsOrOpts is an object)
 * @param {string[]} [opts.tools] - Tools to check (defaults to REQUIRED_TOOLS)
 * @param {Function} [opts._exec] - Injectable execFileSync (for testing)
 */
export function assertTools(toolsOrOpts = {}, opts = {}) {
  let options = opts;

  // Handle both assertTools(['gh']) and assertTools({ tools: ['gh'] })
  if (Array.isArray(toolsOrOpts)) {
    options = { tools: toolsOrOpts, ...opts };
  } else {
    options = toolsOrOpts;
  }

  const missing = checkTools(options);
  if (missing.length > 0) {
    throw new RallyError(
      `Missing required tools: ${missing.join(', ')}. Please install them before running rally.`,
      EXIT_CONFIG
    );
  }
}
