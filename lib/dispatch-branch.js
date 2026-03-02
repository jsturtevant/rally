import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { slugify } from './utils.js';
import { validateOnboarded } from './config.js';
import { setupDispatchWorktree, warnUncommittedChanges } from './dispatch-core.js';
import { RallyError, EXIT_GENERAL } from './errors.js';

/**
 * Dispatch a new branch for an ad-hoc task.
 *
 * Creates a worktree, writes a task context file, and launches Copilot.
 *
 * @param {object} options
 * @param {string} options.task - Task description
 * @param {string} options.repo - owner/repo format
 * @param {string} [options.repoPath] - Absolute path to the local repo
 * @param {boolean} [options.sandbox] - Run Copilot inside a Docker sandbox
 * @param {string[]} [options.denyToolsCopilot]
 * @param {string[]} [options.denyToolsSandbox]
 * @param {boolean} [options.disallowTempDir]
 * @param {Function} [options._exec] - Injectable execFileSync (for testing)
 * @param {Function} [options._spawn] - Injectable spawn (for testing)
 */
export async function dispatchBranch(options = {}) {
  const {
    task,
    repo,
    sandbox,
    denyToolsCopilot,
    denyToolsSandbox,
    disallowTempDir,
    _exec = execFileSync,
    _spawn,
  } = options;

  if (!task || !task.trim()) {
    throw new RallyError('Task description is required', EXIT_GENERAL);
  }
  if (!repo) {
    throw new RallyError('Repository (owner/repo) is required', EXIT_GENERAL);
  }

  const repoParts = repo.split('/');
  if (repoParts.length !== 2 || !repoParts[0] || !repoParts[1]) {
    throw new RallyError('Repository must be in "owner/repo" format', EXIT_GENERAL);
  }
  const repoName = repoParts[1];

  let repoPath = options.repoPath;
  if (!repoPath) {
    const project = validateOnboarded(repo);
    repoPath = project.path;
  }

  const resolvedRepoPath = repoPath;
  warnUncommittedChanges(resolvedRepoPath, _exec);

  const slug = slugify(task.trim());
  const id = Date.now().toString(36);
  const branch = `rally/${slug}`;
  const worktreePath = join(resolvedRepoPath, '.worktrees', `rally-branch-${id}`);
  const dispatchId = `${repoName}-branch-${id}`;

  const copilotPrompt = `Task: ${task.trim()}`;

  const result = setupDispatchWorktree({
    resolvedRepoPath,
    worktreePath,
    branch,
    dispatchId,
    repo,
    number: 0,
    type: 'branch',
    initialStatus: 'implementing',
    copilotPrompt,
    title: task.trim(),
    postSymlinkFn: (wtPath) => {
      // Write task context
      const squadDir = join(wtPath, '.squad');
      if (!existsSync(squadDir)) {
        mkdirSync(squadDir, { recursive: true });
      }
      const contextPath = join(squadDir, 'dispatch-context.md');
      const content = [
        `# Task: ${task.trim()}`,
        '',
        '## Description',
        '',
        task.trim(),
        '',
      ].join('\n');
      writeFileSync(contextPath, content, { encoding: 'utf8', mode: 0o600 });
    },
    sandbox,
    denyToolsCopilot,
    denyToolsSandbox,
    disallowTempDir,
    _exec,
    _spawn,
  });

  if (result.alreadyExists) {
    throw new RallyError(`Worktree already exists at ${worktreePath}`, EXIT_GENERAL);
  }

  return {
    branch,
    worktreePath,
    sessionId: result.sessionId,
    dispatchId,
  };
}
