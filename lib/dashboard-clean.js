import chalk from 'chalk';
import { getActiveDispatches, removeDispatch, updateDispatchStatus } from './active.js';
import { removeWorktree } from './worktree.js';
import { readProjects } from './config.js';

/**
 * Find the project path for a given repo (owner/repo format).
 * @param {string} repo - e.g. "jsturtevant/rally"
 * @param {Function} [_readProjects] - Injectable for testing
 * @returns {string|null} Absolute path to the project, or null
 */
function findProjectPath(repo, _readProjects) {
  const read = _readProjects || readProjects;
  const projects = read();
  const repoName = repo.split('/').pop();
  const project = (projects.projects || []).find((p) => p.name === repoName);
  return project ? project.path : null;
}

/**
 * Clean dispatches with status "done" by removing their worktrees
 * and updating active.yaml.
 *
 * @param {object} [options]
 * @param {boolean} [options.all] - Clean all dispatches (not just done)
 * @param {boolean} [options.yes] - Skip confirmation prompt for --all
 * @param {Function} [options._getActiveDispatches] - Injectable for testing
 * @param {Function} [options._removeDispatch] - Injectable for testing
 * @param {Function} [options._removeWorktree] - Injectable for testing
 * @param {Function} [options._readProjects] - Injectable for testing
 * @param {Function} [options._confirm] - Injectable for testing
 * @param {object} [options._ora] - Injectable for testing
 * @param {object} [options._chalk] - Injectable for testing
 * @returns {Promise<{ cleaned: object[], skipped: object[], errors: object[] }>}
 */
export async function dashboardClean(options = {}) {
  const _getActive = options._getActiveDispatches || getActiveDispatches;
  const _remove = options._removeDispatch || removeDispatch;
  const _removeWt = options._removeWorktree || removeWorktree;
  const _readProj = options._readProjects || readProjects;
  const _confirmFn = options._confirm || (await import('@inquirer/prompts')).confirm;
  const _ora = options._ora || (await import('ora')).default;
  const _chalk = options._chalk || chalk;

  const dispatches = _getActive();

  if (dispatches.length === 0) {
    console.log(_chalk.yellow('No active dispatches.'));
    return { cleaned: [], skipped: [], errors: [] };
  }

  let targets;
  if (options.all) {
    if (!options.yes) {
      const confirmed = await _confirmFn({
        message: `Clean all ${dispatches.length} dispatch(es)? Worktrees will be removed (branches preserved).`,
        default: false,
      });
      if (!confirmed) {
        console.log(_chalk.dim('Cancelled.'));
        return { cleaned: [], skipped: [], errors: [] };
      }
    }
    targets = dispatches;
  } else {
    targets = dispatches.filter((d) => d.status === 'done');
  }

  if (targets.length === 0) {
    console.log(_chalk.yellow('No dispatches to clean.'));
    return { cleaned: [], skipped: [], errors: [] };
  }

  const cleaned = [];
  const skipped = [];
  const errors = [];

  for (const dispatch of targets) {
    const spinner = _ora({ text: `Cleaning ${dispatch.id}...` }).start();

    try {
      // Remove worktree
      const repoPath = findProjectPath(dispatch.repo, _readProj);
      if (repoPath) {
        try {
          _removeWt(repoPath, dispatch.worktreePath);
        } catch {
          // Worktree may already be removed — continue with cleanup
        }
      }

      // Remove dispatch from active.yaml
      _remove(dispatch.id);

      spinner.succeed(`${_chalk.green('Cleaned')} ${dispatch.id} (branch ${_chalk.dim(dispatch.branch)} preserved)`);
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

  return { cleaned, skipped, errors };
}
