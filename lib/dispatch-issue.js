import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { worktreeExists } from './worktree.js';
import { writeIssueContext } from './dispatch-context.js';
import { slugify } from './utils.js';
import { validateDispatchInputs, warnUncommittedChanges, setupDispatchWorktree } from './dispatch-core.js';

/**
 * Dispatch an issue: full workflow.
 *
 * @param {object} options
 * @param {number|string} options.issueNumber - GitHub issue number
 * @param {string} options.repo - owner/repo format
 * @param {string} options.repoPath - Absolute path to the local repo
 * @param {string} options.teamDir - Path to the squad team directory to symlink
 * @param {boolean} [options.sandbox] - Run Copilot inside a Docker sandbox microVM
 * @param {Function} [options._exec] - Injectable execFileSync (for testing)
 * @param {Function} [options._spawn] - Injectable spawn (for testing)
 * @returns {object} Dispatch result with branch, worktreePath, sessionId
 */
export async function dispatchIssue(options = {}) {
  const {
    issueNumber,
    repo,
    repoPath,
    teamDir,
    sandbox = false,
    _exec = execFileSync,
    _spawn,
  } = options;

  const { number, repoName, resolvedRepoPath } = validateDispatchInputs({
    itemNumber: issueNumber,
    repo,
    repoPath,
    itemLabel: 'Issue',
  });

  warnUncommittedChanges(resolvedRepoPath, _exec);

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

  const { sessionId } = setupDispatchWorktree({
    resolvedRepoPath,
    worktreePath,
    branch,
    teamDir,
    dispatchId,
    repo,
    number,
    type: 'issue',
    initialStatus: 'planning',
    copilotPrompt: `Read .squad/dispatch-context.md and plan/implement a fix for issue #${number}`,
    postSymlinkFn: (wtPath) => {
      writeIssueContext(wtPath, { ...issue, number });
    },
    sandbox,
    _exec,
    _spawn,
  });

  return {
    branch,
    worktreePath,
    sessionId,
    dispatchId,
    issue: { number, title: issue.title },
  };
}
