import { readFileSync, existsSync } from 'node:fs';
import chalk from 'chalk';
import { getActiveDispatches } from './active.js';
import { findDispatchByNumber } from './utils.js';
import { parseCopilotStats, formatStatsSummary } from './copilot-stats.js';

/**
 * Display the Copilot output log for a dispatch.
 *
 * @param {number} number - Issue or PR number
 * @param {object} [opts]
 * @param {string} [opts.repo] - Target repository (owner/repo) for disambiguation
 * @param {boolean} [opts.follow] - Whether to tail the log (not yet implemented)
 * @param {Function} [opts._getActiveDispatches] - Injectable for testing
 * @param {Function} [opts._readFile] - Injectable readFileSync for testing
 * @param {Function} [opts._existsSync] - Injectable existsSync for testing
 * @param {object} [opts._chalk] - Injectable for testing
 * @returns {Promise<void>}
 */
export async function dispatchLog(number, opts = {}) {
  const _getActive = opts._getActiveDispatches || getActiveDispatches;
  const _readFile = opts._readFile || readFileSync;
  const _exists = opts._existsSync || existsSync;
  const _chalk = opts._chalk || chalk;

  const dispatches = _getActive();
  const dispatch = findDispatchByNumber(dispatches, number, { repo: opts.repo });

  if (!dispatch.logPath) {
    console.log(_chalk.yellow(`No log file available for #${number}`));
    console.log(_chalk.dim('This dispatch may have been created before log capture was enabled.'));
    return;
  }

  if (!_exists(dispatch.logPath)) {
    console.log(_chalk.yellow(`Log file not found: ${dispatch.logPath}`));
    console.log(_chalk.dim('The log file may have been deleted or the worktree removed.'));
    return;
  }

  const content = _readFile(dispatch.logPath, 'utf8');

  const stats = parseCopilotStats(content);
  const summary = formatStatsSummary(stats);
  if (summary) {
    console.log(_chalk.bold('Stats: ') + summary);
    console.log('');
  }

  console.log(content);

  if (opts.follow) {
    console.log(_chalk.yellow('\n--follow flag is not yet implemented'));
  }
}
