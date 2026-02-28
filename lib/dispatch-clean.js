import chalk from 'chalk';
import ora from 'ora';
import { confirm } from '@inquirer/prompts';
import { getActiveDispatches, removeDispatch } from './active.js';
import { readProjects } from './config.js';
import { findProjectPath } from './utils.js';
import { cleanupDispatch } from './dispatch-cleanup.js';

/**
 * Clean dispatches with status "reviewing" or "waiting" by removing their worktrees,
 * deleting local branches, and updating active.yaml.
 *
 * @param {object} [options]
 * @param {boolean} [options.all] - Clean all dispatches (not just done)
 * @param {boolean} [options.yes] - Skip confirmation prompt for --all
 * @param {Function} [options._getActiveDispatches] - Injectable for testing
 * @param {Function} [options._removeDispatch] - Injectable for testing
 * @param {Function} [options._readProjects] - Injectable for testing
 * @param {Function} [options._confirm] - Injectable for testing
 * @param {object} [options._ora] - Injectable for testing
 * @param {object} [options._chalk] - Injectable for testing
 * @param {Function} [options._terminatePid] - Injectable for testing
 * @param {Function} [options._removeWorktree] - Injectable for testing
 * @param {Function} [options._exec] - Injectable execFileSync for testing
 * @returns {Promise<{ cleaned: object[], errors: object[] }>}
 */
export async function dispatchClean(options = {}) {
  const _getActive = options._getActiveDispatches || getActiveDispatches;
  const _remove = options._removeDispatch || removeDispatch;
  const _readProjects = options._readProjects || readProjects;
  const _confirm = options._confirm || confirm;
  const _ora = options._ora || ora;
  const _chalk = options._chalk || chalk;

  const dispatches = _getActive();

  if (dispatches.length === 0) {
    console.log(_chalk.yellow('No active dispatches.'));
    return { cleaned: [], errors: [] };
  }

  let targets;
  if (options.all) {
    if (!options.yes) {
      const confirmed = await _confirm({
        message: `Clean all ${dispatches.length} dispatch(es)? Worktrees and branches will be removed.`,
        default: false,
      });
      if (!confirmed) {
        console.log(_chalk.dim('Cancelled.'));
        return { cleaned: [], errors: [] };
      }
    }
    targets = dispatches;
  } else {
    targets = dispatches.filter((d) => d.status === 'reviewing' || d.status === 'upstream');
  }

  if (targets.length === 0) {
    console.log(_chalk.yellow('No dispatches to clean.'));
    return { cleaned: [], errors: [] };
  }

  const cleaned = [];
  const errors = [];

  for (const dispatch of targets) {
    const spinner = _ora({ text: `Cleaning ${dispatch.id}...` }).start();

    try {
      const repoPath = findProjectPath(dispatch.repo, _readProjects);

      cleanupDispatch(dispatch, repoPath, {
        _terminatePid: options._terminatePid,
        _removeWorktree: options._removeWorktree,
        _exec: options._exec,
      });

      // Remove dispatch from active.yaml
      _remove(dispatch.id);

      spinner.succeed(`${_chalk.green('Cleaned')} ${dispatch.id} (branch ${_chalk.dim(dispatch.branch)} deleted)`);
      cleaned.push(dispatch);
    } catch (err) {
      spinner.fail(`${_chalk.red('Failed')} ${dispatch.id}: ${err.message}`);
      errors.push({ dispatch, error: err.message });
    }
  }

  // Summary
  if (cleaned.length > 0) {
    console.log(`\n${_chalk.green('✓')} Cleaned ${cleaned.length} dispatch(es).`);
  }
  if (errors.length > 0) {
    console.log(`${_chalk.red('✗')} ${errors.length} error(s) during cleanup.`);
  }

  return { cleaned, errors };
}
