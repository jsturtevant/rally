import { execFileSync } from 'node:child_process';
import { RallyError, EXIT_CONFIG } from './errors.js';

const REQUIRED_TOOLS = ['git', 'gh', 'npx'];

/**
 * Check that required CLI tools are available on the system.
 * Returns an array of missing tool names (empty if all present).
 *
 * @param {object} [opts]
 * @param {Function} [opts._exec] - Injectable execFileSync (for testing)
 * @returns {string[]} Array of missing tool names
 */
export function checkTools(opts = {}) {
  const exec = opts._exec || execFileSync;
  const missing = [];

  for (const tool of REQUIRED_TOOLS) {
    try {
      exec('which', [tool], { encoding: 'utf8', stdio: 'pipe' });
    } catch {
      missing.push(tool);
    }
  }

  return missing;
}

/**
 * Assert that all required CLI tools are available.
 * Throws a RallyError with EXIT_CONFIG if any are missing.
 *
 * @param {object} [opts]
 * @param {Function} [opts._exec] - Injectable execFileSync (for testing)
 */
export function assertTools(opts = {}) {
  const missing = checkTools(opts);
  if (missing.length > 0) {
    throw new RallyError(
      `Missing required tools: ${missing.join(', ')}. Please install them before running rally.`,
      EXIT_CONFIG
    );
  }
}
