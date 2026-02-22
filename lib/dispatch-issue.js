import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createWorktree } from './worktree.js';
import { createSymlink } from './symlink.js';
import { addDispatch } from './active.js';
import { readProjects } from './config.js';
import { launchCopilot } from './copilot.js';

/**
 * Create a URL-safe slug from an issue title.
 * Lowercase, replace non-alphanumeric with hyphens, collapse, trim, cap at 50 chars.
 * @param {string} title
 * @returns {string}
 */
export function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

/**
 * Write a minimal dispatch-context.md into the worktree .squad/ directory.
 * Placeholder — will be superseded by lib/dispatch-context.js (#17).
 *
 * @param {string} squadDir - Path to .squad/ inside the worktree
 * @param {object} opts
 * @param {string} opts.repo - owner/repo
 * @param {number} opts.number - Issue number
 * @param {object} opts.issue - Issue object from GitHub
 */
export function writeDispatchContext(squadDir, { repo, number, issue }) {
  const labels = (issue.labels || []).map((l) => l.name || l).join(', ');
  const assignees = (issue.assignees || []).map((a) => a.login || a).join(', ');
  const content = `# Dispatch Context

## Issue
- **Repo:** ${repo}
- **Issue:** #${number}
- **Title:** ${issue.title}
- **Labels:** ${labels || 'none'}
- **Assignees:** ${assignees || 'none'}

## Description
${issue.body || '_No description provided._'}
`;
  if (!existsSync(squadDir)) {
    mkdirSync(squadDir, { recursive: true });
  }
  writeFileSync(join(squadDir, 'dispatch-context.md'), content, 'utf8');
}

/**
 * Dispatch an issue: full workflow.
 *
 * Steps:
 *  1. Validate inputs (including onboarding check)
 *  2. Fetch issue via gh CLI
 *  3. Create branch rally/{number}-{slug}
 *  4. Create worktree at .worktrees/rally-{number}/
 *  5. Symlink squad into worktree
 *  6. Write dispatch-context.md
 *  7. Launch Copilot CLI (gracefully skip if unavailable)
 *  8. Add dispatch to active.yaml with status "planning" and session_id
 *  9. Return session info
 *
 * TODO: Wrap steps 4-6 in try-catch to clean up worktree on failure (#40 follow-up)
 *
 * @param {object} options
 * @param {number|string} options.issueNumber - GitHub issue number
 * @param {string} options.repo - owner/repo format
 * @param {string} options.repoPath - Absolute path to the local repo
 * @param {string} options.teamDir - Path to the squad team directory to symlink
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
    _exec = execFileSync,
    _spawn,
  } = options;

  // 1. Validate inputs
  if (!issueNumber) {
    throw new Error('Issue number is required');
  }
  if (!repo) {
    throw new Error('Repository (owner/repo) is required');
  }
  if (!repoPath) {
    throw new Error('Repository path is required');
  }

  // Validate repo is onboarded
  const repoName = repo.split('/')[1];
  const projects = readProjects();
  const projectList = (projects && projects.projects) || [];
  if (!projectList.find((p) => p.name === repoName)) {
    throw new Error(`Repository "${repo}" is not onboarded. Run: rally onboard ${repo}`);
  }

  const resolvedRepoPath = resolve(repoPath);
  const number = Number(issueNumber);

  // 2. Fetch issue
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

  // 3. Create branch name
  const slug = slugify(issue.title);
  const branch = `rally/${number}-${slug}`;

  // 4. Create worktree
  const worktreePath = join(resolvedRepoPath, '.worktrees', `rally-${number}`);

  if (existsSync(worktreePath)) {
    throw new Error(`Worktree already exists at ${worktreePath}`);
  }

  createWorktree(resolvedRepoPath, worktreePath, branch);

  // 5. Symlink squad into worktree
  const squadSource = teamDir || join(resolvedRepoPath, '.squad');
  const squadTarget = join(worktreePath, '.squad');
  if (existsSync(squadSource)) {
    createSymlink(squadSource, squadTarget);
  }

  // 6. Write dispatch-context.md
  const squadDir = join(worktreePath, '.squad');
  if (!existsSync(squadDir)) {
    mkdirSync(squadDir, { recursive: true });
  }
  writeDispatchContext(squadDir, { repo, number, issue });

  // 7. Launch Copilot CLI
  const prompt = `Read .squad/dispatch-context.md and plan/implement a fix for issue #${number}`;
  let copilotResult = { sessionId: null, process: null };
  try {
    copilotResult = launchCopilot(worktreePath, prompt, { _spawn });
  } catch {
    // Copilot CLI not available — gracefully skip
  }

  // 8. Add dispatch to active.yaml (after Copilot launch so session_id is captured)
  const dispatchId = `${repo.split('/')[1]}-issue-${number}`;
  addDispatch({
    id: dispatchId,
    repo,
    number,
    type: 'issue',
    branch,
    worktreePath,
    status: 'planning',
    session_id: copilotResult.sessionId || 'pending',
  });

  // 9. Return result
  return {
    branch,
    worktreePath,
    sessionId: copilotResult.sessionId,
    dispatchId,
    issue: {
      number,
      title: issue.title,
    },
  };
}
