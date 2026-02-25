import chalk from 'chalk';
import ora from 'ora';
import { getActiveDispatches, removeDispatch } from './active.js';
import { readProjects } from './config.js';
import { findProjectPath } from './utils.js';
import { cleanupDispatch } from './dispatch-cleanup.js';

/**
 * Remove an active dispatch by issue/PR number.
 *
 * @param {number} number - Issue or PR number
 * @param {object} [opts]
 * @param {string} [opts.repo] - Target repository (owner/repo) for disambiguation
 * @param {Function} [opts._getActiveDispatches] - Injectable for testing
 * @param {Function} [opts._removeDispatch] - Injectable for testing
 * @param {Function} [opts._readProjects] - Injectable for testing
 * @param {Function} [opts._exec] - Injectable execFileSync for testing
 * @param {object} [opts._ora] - Injectable for testing
 * @param {object} [opts._chalk] - Injectable for testing
 * @param {Function} [opts._terminatePid] - Injectable for testing
 * @param {Function} [opts._removeWorktree] - Injectable for testing
 * @returns {Promise<object>} The removed dispatch record
 */
export async function dispatchRemove(number, opts = {}) {
  const _getActive = opts._getActiveDispatches || getActiveDispatches;
  const _remove = opts._removeDispatch || removeDispatch;
  const _readProj = opts._readProjects || readProjects;
  const _ora = opts._ora || ora;
  const _chalk = opts._chalk || chalk;

  const dispatches = _getActive();

  // Find by number, optionally filtered by repo
  let matches = dispatches.filter((d) => d.number === number);
  if (opts.repo) {
    matches = matches.filter((d) => d.repo === opts.repo);
  }

  if (matches.length === 0) {
    throw new Error(`No active dispatch found for #${number}`);
  }
  if (matches.length > 1) {
    const repos = matches.map((d) => d.repo).join(', ');
    throw new Error(
      `Multiple dispatches found for #${number} (${repos}). Use --repo to disambiguate.`
    );
  }

  const dispatch = matches[0];
  const spinner = _ora({ text: `Removing dispatch #${number}...` }).start();

  try {
    const repoPath = findProjectPath(dispatch.repo, _readProj);

    cleanupDispatch(dispatch, repoPath, {
      _terminatePid: opts._terminatePid,
      _removeWorktree: opts._removeWorktree,
      _exec: opts._exec,
    });

    // Remove from active.yaml
    _remove(dispatch.id);

    const typeLabel = dispatch.type === 'pr' ? 'PR' : 'Issue';
    spinner.succeed(
      `${_chalk.green('Removed')} ${typeLabel} #${number} (branch ${_chalk.dim(dispatch.branch)} deleted)`
    );
    return dispatch;
  } catch (err) {
    spinner.fail(
      `${_chalk.red('Failed')} to remove #${number}: ${err.message}`
    );
    throw err;
  }
}
