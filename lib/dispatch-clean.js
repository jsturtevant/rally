import { execFileSync } from 'node:child_process';
import chalk from 'chalk';
import { getActiveDispatches, removeDispatch, terminatePid } from './active.js';
import { removeWorktree } from './worktree.js';
import { readProjects } from './config.js';
import { findProjectPath } from './utils.js';

/**
 * Clean dispatches with status "reviewing", "pushed", "done", or "cleaned" by removing their worktrees,
 * deleting local branches, and updating active.yaml.
 *
 * @param {object} [options]
 * @param {boolean} [options.all] - Clean all dispatches (not just done)
 * @param {boolean} [options.yes] - Skip confirmation prompt for --all
 * @param {Function} [options._getActiveDispatches] - Injectable for testing
 * @param {Function} [options._removeDispatch] - Injectable for testing
 * @param {Function} [options._removeWorktree] - Injectable for testing
 * @param {Function} [options._readProjects] - Injectable for testing
 * @param {Function} [options._exec] - Injectable execFileSync for testing
 * @param {Function} [options._confirm] - Injectable for testing
 * @param {object} [options._ora] - Injectable for testing
 * @param {object} [options._chalk] - Injectable for testing
 * @param {Function} [options._terminatePid] - Injectable for testing
 * @returns {Promise<{ cleaned: object[], errors: object[] }>}
 */
export async function dispatchClean(options = {}) {
  const _getActive = options._getActiveDispatches || getActiveDispatches;
  const _remove = options._removeDispatch || removeDispatch;
  const _removeWt = options._removeWorktree || removeWorktree;
  const _readProj = options._readProjects || readProjects;
  const _exec = options._exec || execFileSync;
  const _confirmFn = options._confirm || (await import('@inquirer/prompts')).confirm;
  const _ora = options._ora || (await import('ora')).default;
  const _chalk = options._chalk || chalk;
  const _terminatePid = options._terminatePid || terminatePid;

  const dispatches = _getActive();

  if (dispatches.length === 0) {
    console.log(_chalk.yellow('No active dispatches.'));
    return { cleaned: [], errors: [] };
  }

  let targets;
  if (options.all) {
    if (!options.yes) {
      const confirmed = await _confirmFn({
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
    targets = dispatches.filter((d) => d.status === 'done' || d.status === 'cleaned' || d.status === 'reviewing' || d.status === 'pushed');
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
      const repoPath = findProjectPath(dispatch.repo, _readProj);

      // Terminate Copilot process if PID is tracked
      if (dispatch.pid) {
        try {
          // Only terminate if dispatch is recent (within 7 days) to avoid recycled PIDs
          const age = dispatch.created ? Date.now() - new Date(dispatch.created).getTime() : Infinity;
          const sevenDays = 7 * 24 * 60 * 60 * 1000;
          if (age <= sevenDays) {
            _terminatePid(dispatch.pid);
          }
        } catch {
          // Best-effort cleanup — continue even if termination fails
        }
      }

      // Remove worktree
      if (repoPath) {
        try {
          _removeWt(repoPath, dispatch.worktreePath);
        } catch {
          // Worktree may already be removed — continue with cleanup
        }
      }

      // Delete local branch
      if (repoPath && dispatch.branch) {
        try {
          _exec('git', ['branch', '-D', dispatch.branch], {
            cwd: repoPath,
            encoding: 'utf8',
          });
        } catch {
          // Branch may already be deleted or not exist locally
        }
      }

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
