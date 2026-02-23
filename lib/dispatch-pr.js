import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createWorktree, removeWorktree, worktreeExists } from './worktree.js';
import { createSymlink } from './symlink.js';
import { addDispatch } from './active.js';
import { validateOnboarded } from './config.js';
import { writePrContext } from './dispatch-context.js';
import { slugify } from './utils.js';
import { launchCopilot, checkCopilotAvailable } from './copilot.js';

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
 * @returns {object} Dispatch result with branch, worktreePath, sessionId
 */
export async function dispatchPr(options = {}) {
  const {
    prNumber,
    repo,
    repoPath,
    teamDir,
    _exec = execFileSync,
    _spawn,
  } = options;

  // 1. Validate inputs
  if (!prNumber) {
    throw new Error('PR number is required');
  }
  if (!repo) {
    throw new Error('Repository (owner/repo) is required');
  }
  const repoParts = repo.split('/');
  if (repoParts.length !== 2 || !repoParts[0] || !repoParts[1]) {
    throw new Error('Repository must be in "owner/repo" format');
  }
  const repoName = repoParts[1];
  if (!repoPath) {
    throw new Error('Repository path is required');
  }

  // Validate repo is onboarded
  validateOnboarded(repo);

  const resolvedRepoPath = resolve(repoPath);
  const number = Number(prNumber);
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`Invalid PR number: "${prNumber}". Must be a positive integer.`);
  }

  // 1b. Warn about uncommitted changes
  try {
    const status = _exec('git', ['status', '--porcelain'], {
      cwd: resolvedRepoPath,
      encoding: 'utf8',
    });
    if (status && status.trim().length > 0) {
      console.error(`Warning: you have uncommitted changes in ${resolvedRepoPath}`);
    }
  } catch {
    // Non-fatal — skip check if git status fails
  }

  // 2. Fetch PR and validate state
  const pr = fetchPrOrFail(number, repo, _exec);

  // 3. Create branch name
  const slug = slugify(pr.title);
  const branch = `rally/pr-${number}-${slug}`;

  // 4. Create worktree
  const worktreePath = join(resolvedRepoPath, '.worktrees', `rally-pr-${number}`);

  if (worktreeExists(resolvedRepoPath, worktreePath)) {
    console.error(`Warning: worktree already exists at ${worktreePath}, skipping creation`);
    return {
      branch,
      worktreePath,
      sessionId: null,
      dispatchId: `${repoName}-pr-${number}`,
      pr: { number, title: pr.title },
      existing: true,
    };
  }

  createWorktree(resolvedRepoPath, worktreePath, branch);

  let copilotResult = { sessionId: null, process: null };
  let dispatchId;
  try {
     // Checkout PR's head ref using GitHub's pull ref (works for forks too)
    try {
      _exec('git', ['-C', worktreePath, 'fetch', 'origin', `refs/pull/${number}/head`], { encoding: 'utf8', stdio: 'pipe' });
    } catch (err) {
      throw new Error(`Failed to fetch PR #${number} head ref: ${err.message}`);
    }
    try {
      _exec('git', ['-C', worktreePath, 'reset', '--hard', 'FETCH_HEAD'], { encoding: 'utf8', stdio: 'pipe' });
    } catch (err) {
      throw new Error(`Failed to reset worktree to PR #${number} head: ${err.message}`);
    }

    // 5. Symlink squad into worktree
    const squadSource = teamDir || join(resolvedRepoPath, '.squad');
    const squadTarget = join(worktreePath, '.squad');
    if (existsSync(squadSource)) {
      createSymlink(squadSource, squadTarget);
    }

    // 6. Write dispatch-context.md
    writePrContext(worktreePath, { ...pr, number });

    // 7. Launch Copilot CLI (if available)
    if (checkCopilotAvailable({ _exec })) {
      const prompt = `Read .squad/dispatch-context.md and review PR #${number}`;
      try {
        copilotResult = launchCopilot(worktreePath, prompt, { _spawn });
      } catch {
        // Copilot launch failed — continue without it
      }
    }

    // 8. Add dispatch to active.yaml
    dispatchId = `${repoName}-pr-${number}`;
    addDispatch({
      id: dispatchId,
      repo,
      number,
      type: 'pr',
      branch,
      worktreePath,
      status: 'reviewing',
      session_id: copilotResult.sessionId || 'pending',
    });
  } catch (err) {
    // Clean up orphaned worktree
    try {
      removeWorktree(resolvedRepoPath, worktreePath);
    } catch {
      // Best-effort cleanup — if this fails too, at least we tried
    }
    throw err;
  }

  // 9. Return result
  return {
    branch,
    worktreePath,
    sessionId: copilotResult.sessionId,
    dispatchId,
    pr: {
      number,
      title: pr.title,
    },
  };
}
