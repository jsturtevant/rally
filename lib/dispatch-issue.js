import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { worktreeExists } from './worktree.js';
import { writeIssueContext } from './dispatch-context.js';
import { slugify } from './utils.js';
import { validateDispatchInputs, warnUncommittedChanges, setupDispatchWorktree } from './dispatch-core.js';
import { checkDispatchTrust } from './dispatch-trust.js';
import { assertTools } from './tools.js';

/**
 * Dispatch an issue: full workflow.
 *
 * @param {object} options
 * @param {number|string} options.issueNumber - GitHub issue number
 * @param {string} options.repo - owner/repo format
 * @param {string} options.repoPath - Absolute path to the local repo
 * @param {string} options.teamDir - Path to the squad team directory to symlink
 * @param {Function} [options._exec] - Injectable execFileSync (for testing)
 * @param {Function} [options._spawn] - Injectable spawn (for testing)
 * @param {boolean} [options.sandbox] - Run Copilot inside a Docker sandbox
 * @param {boolean} [options.trust] - Skip trust/author warnings
 * @param {Function} [options._confirm] - Injectable confirm prompt (for testing)
 * @param {boolean} [options._isTTY] - Override TTY detection (for testing)
 * @returns {{ aborted: true } | { branch: string, worktreePath: string, sessionId: string }} Dispatch result, or `{ aborted: true }` if user declines the trust prompt
 */
export async function dispatchIssue(options = {}) {
  const {
    issueNumber,
    repo,
    repoPath,
    teamDir,
    sandbox,
    trust,
    _exec = execFileSync,
    _spawn,
    _confirm,
  } = options;

  // Verify gh CLI is available
  assertTools(['gh'], { _exec });

  const { number, repoName, resolvedRepoPath } = validateDispatchInputs({
    itemNumber: issueNumber,
    repo,
    repoPath,
    itemLabel: 'Issue',
  });

  warnUncommittedChanges(resolvedRepoPath, _exec);

  // Trust check: warn if the issue author differs from the current user
  const proceed = await checkDispatchTrust({
    type: 'issue', number, repo, trust, _exec, _confirm, _isTTY: options._isTTY,
  });
  if (!proceed) {
    console.log('Dispatch aborted by user.');
    return { aborted: true };
  }

  // Fetch issue
  let issue;
  try {
    const output = _exec(
      'gh',
      ['issue', 'view', String(number), '--repo', repo, '--json', 'title,body,labels,assignees'],
      { encoding: 'utf8' }
    );
    issue = JSON.parse(output);
  } catch (error) {
    if (error.message && error.message.includes('Could not resolve to an Issue')) {
      throw new Error(`Issue #${number} not found in ${repo}`);
    }
    throw new Error(`Failed to fetch issue #${number}: ${error.message}`);
  }

  // Create branch name
  const slug = slugify(issue.title);
  const branch = `rally/${number}-${slug}`;
  const worktreePath = join(resolvedRepoPath, '.worktrees', `rally-${number}`);
  const dispatchId = `${repoName}-issue-${number}`;

  if (worktreeExists(resolvedRepoPath, worktreePath)) {
    console.error(`Warning: worktree already exists at ${worktreePath}, skipping creation`);
    return {
      branch,
      worktreePath,
      sessionId: null,
      dispatchId,
      issue: { number, title: issue.title },
      existing: true,
    };
  }

  const setupResult = setupDispatchWorktree({
    resolvedRepoPath,
    worktreePath,
    branch,
    teamDir,
    dispatchId,
    repo,
    number,
    type: 'issue',
    initialStatus: 'planning',
    title: issue.title,
    copilotPrompt: `Read .squad/dispatch-context.md and plan/implement a fix for issue #${number}`,
    postSymlinkFn: (wtPath) => {
      writeIssueContext(wtPath, { ...issue, number });
    },
    _exec,
    _spawn,
    sandbox,
  });

  if (setupResult.alreadyExists) {
    console.error(`Warning: worktree already exists at ${worktreePath}, skipping creation`);
    return {
      branch,
      worktreePath,
      sessionId: null,
      dispatchId,
      issue: { number, title: issue.title },
      existing: true,
    };
  }

  return {
    branch,
    worktreePath,
    sessionId: setupResult.sessionId,
    dispatchId,
    issue: { number, title: issue.title },
  };
}
