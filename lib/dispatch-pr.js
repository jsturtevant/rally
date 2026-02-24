import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { worktreeExists } from './worktree.js';
import { writePrContext } from './dispatch-context.js';
import { slugify } from './utils.js';
import { validateDispatchInputs, warnUncommittedChanges, setupDispatchWorktree } from './dispatch-core.js';

/**
 * Fetch a PR and validate it is open (not merged/closed).
 *
 * @param {number} number - PR number
 * @param {string} repo - owner/repo
 * @param {Function} _exec - Injectable execFileSync
 * @returns {object} PR data
 */
export function fetchPrOrFail(number, repo, _exec = execFileSync) {
  let pr;
  try {
    const output = _exec(
      'gh',
      [
        'pr', 'view', String(number),
        '--repo', repo,
        '--json', 'title,body,headRefName,baseRefName,files,state',
      ],
      { encoding: 'utf8' }
    );
    pr = JSON.parse(output);
  } catch (error) {
    if (error.message && error.message.includes('Could not resolve to a PullRequest')) {
      throw new Error(`PR #${number} not found in ${repo}`);
    }
    throw new Error(`Failed to fetch PR #${number}: ${error.message}`);
  }

  if (pr.state === 'MERGED') {
    throw new Error(`PR #${number} is already merged`);
  }
  if (pr.state === 'CLOSED') {
    throw new Error(`PR #${number} is closed`);
  }

  return pr;
}

/**
 * Dispatch a PR review: full workflow.
 *
 * Steps:
 *  1. Validate inputs (including onboarding check)
 *  2. Fetch PR via gh CLI, validate open
 *  3. Create branch rally/pr-{number}-{slug}
 *  4. Create worktree at .worktrees/rally-pr-{number}/
 *  5. Symlink squad into worktree
 *  6. Write dispatch-context.md via writePrContext()
 *  7. Launch Copilot CLI with review prompt
 *  8. Add dispatch to active.yaml with status "reviewing"
 *  9. Return session info
 *
 * @param {object} options
 * @param {number|string} options.prNumber - GitHub PR number
 * @param {string} options.repo - owner/repo format
 * @param {string} options.repoPath - Absolute path to the local repo
 * @param {string} [options.teamDir] - Path to the squad team directory to symlink
 * @param {Function} [options._exec] - Injectable execFileSync (for testing)
 * @param {Function} [options._spawn] - Injectable spawn (for testing)
 * @param {boolean} [options.sandbox] - Run Copilot inside a Docker sandbox
 * @returns {object} Dispatch result with branch, worktreePath, sessionId
 */
export async function dispatchPr(options = {}) {
  const {
    prNumber,
    repo,
    repoPath,
    teamDir,
    sandbox,
    _exec = execFileSync,
    _spawn,
  } = options;

  const { number, repoName, resolvedRepoPath } = validateDispatchInputs({
    itemNumber: prNumber,
    repo,
    repoPath,
    itemLabel: 'PR',
  });

  warnUncommittedChanges(resolvedRepoPath, _exec);

  // Fetch PR and validate state
  const pr = fetchPrOrFail(number, repo, _exec);

  // Create branch name
  const slug = slugify(pr.title);
  const branch = `rally/pr-${number}-${slug}`;
  const worktreePath = join(resolvedRepoPath, '.worktrees', `rally-pr-${number}`);
  const dispatchId = `${repoName}-pr-${number}`;

  if (worktreeExists(resolvedRepoPath, worktreePath)) {
    console.error(`Warning: worktree already exists at ${worktreePath}, skipping creation`);
    return {
      branch,
      worktreePath,
      sessionId: null,
      dispatchId,
      pr: { number, title: pr.title },
      existing: true,
    };
  }

  const { sessionId } = setupDispatchWorktree({
    resolvedRepoPath,
    worktreePath,
    branch,
    teamDir,
    dispatchId,
    repo,
    number,
    type: 'pr',
    initialStatus: 'reviewing',
    copilotPrompt: `Read .squad/dispatch-context.md and review PR #${number}`,
    preSymlinkFn: (wtPath) => {
      // Checkout PR's head ref using GitHub's pull ref (works for forks too)
      try {
        _exec('git', ['-C', wtPath, 'fetch', 'origin', `refs/pull/${number}/head`], { encoding: 'utf8', stdio: 'pipe' });
      } catch (err) {
        throw new Error(`Failed to fetch PR #${number} head ref: ${err.message}`);
      }
      try {
        _exec('git', ['-C', wtPath, 'reset', '--hard', 'FETCH_HEAD'], { encoding: 'utf8', stdio: 'pipe' });
      } catch (err) {
        throw new Error(`Failed to reset worktree to PR #${number} head: ${err.message}`);
      }
    },
    postSymlinkFn: (wtPath) => {
      writePrContext(wtPath, { ...pr, number });
    },
    _exec,
    _spawn,
    sandbox,
  });

  return {
    branch,
    worktreePath,
    sessionId,
    dispatchId,
    pr: { number, title: pr.title },
  };
}
