import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createWorktree, removeWorktree, worktreeExists } from './worktree.js';
import { createSymlink } from './symlink.js';
import { addDispatch } from './active.js';
import { validateOnboarded } from './config.js';
import { launchCopilot, checkCopilotAvailable, checkDockerSandboxAvailable } from './copilot.js';
import { slugify } from './utils.js';

/**
 * Validate common dispatch inputs.
 * @returns {{ number: number, repoName: string, resolvedRepoPath: string }}
 */
export function validateDispatchInputs({ itemNumber, repo, repoPath, itemLabel = 'item' }) {
  if (!itemNumber) {
    throw new Error(`${itemLabel} number is required`);
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

  validateOnboarded(repo);

  const resolvedRepoPath = resolve(repoPath);
  const number = Number(itemNumber);
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`Invalid ${itemLabel} number: "${itemNumber}". Must be a positive integer.`);
  }

  return { number, repoName, resolvedRepoPath };
}

/**
 * Warn if the repo has uncommitted changes.
 */
export function warnUncommittedChanges(resolvedRepoPath, _exec = execFileSync) {
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
}

/**
 * Set up worktree with squad symlink, launch Copilot, register dispatch.
 * Rolls back worktree on failure.
 *
 * @param {object} opts
 * @param {string} opts.resolvedRepoPath
 * @param {string} opts.worktreePath
 * @param {string} opts.branch
 * @param {string} opts.teamDir
 * @param {string} opts.dispatchId
 * @param {string} opts.repo
 * @param {number} opts.number
 * @param {string} opts.type - 'issue' or 'pr'
 * @param {string} opts.initialStatus
 * @param {string} opts.copilotPrompt
 * @param {string} [opts.title] - Issue/PR title (persisted to active.yaml for dashboard display)
 * @param {Function} opts.preSymlinkFn - Setup before symlink (e.g. fetch PR head)
 * @param {Function} opts.postSymlinkFn - Setup after symlink (e.g. write context)
 * @param {boolean} [opts.sandbox] - Run Copilot inside a Docker sandbox
 * @param {Function} opts._exec
 * @param {Function} opts._spawn
 * @returns {{ sessionId: string|null }}
 */
export function setupDispatchWorktree(opts) {
  const {
    resolvedRepoPath,
    worktreePath,
    branch,
    teamDir,
    dispatchId,
    repo,
    number,
    type,
    initialStatus,
    copilotPrompt,
    title,
    preSymlinkFn,
    postSymlinkFn,
    sandbox = false,
    denyToolsCopilot,
    denyToolsSandbox,
    disallowTempDir,
    _exec = execFileSync,
    _spawn,
  } = opts;

  try {
    createWorktree(resolvedRepoPath, worktreePath, branch);
  } catch (err) {
    if (err.code === 'WORKTREE_EXISTS') {
      return { alreadyExists: true };
    }
    throw err;
  }

  let copilotResult = { sessionId: null, pid: null, process: null, logPath: null };
  try {
    // Pre-symlink setup (e.g. fetch PR head ref)
    if (preSymlinkFn) {
      preSymlinkFn(worktreePath);
    }

    // Symlink squad into worktree (remove existing dir if git copied it)
    const squadSource = teamDir || join(resolvedRepoPath, '.squad');
    const squadTarget = join(worktreePath, '.squad');
    if (existsSync(squadSource)) {
      if (existsSync(squadTarget) && !lstatSync(squadTarget).isSymbolicLink()) {
        rmSync(squadTarget, { recursive: true });
      }
      createSymlink(squadSource, squadTarget);
    }

    // Post-symlink setup (e.g. write dispatch context)
    if (postSymlinkFn) {
      postSymlinkFn(worktreePath);
    }

    // Launch Copilot CLI (if available)
    if (sandbox) {
      if (!checkDockerSandboxAvailable({ _exec })) {
        throw new Error(
          'Docker sandbox not available — install Docker Desktop 4.58+ with sandbox support or remove --sandbox'
        );
      }
      // In sandbox mode, surface all spawn errors — user explicitly requested it
      const logPath = join(worktreePath, '.copilot-output.log');
      copilotResult = launchCopilot(worktreePath, copilotPrompt, { _spawn, logPath, sandbox: true, denyTools: denyToolsSandbox, disallowTempDir });
    } else if (checkCopilotAvailable({ _exec })) {
      try {
        const logPath = join(worktreePath, '.copilot-output.log');
        copilotResult = launchCopilot(worktreePath, copilotPrompt, { _spawn, logPath, denyTools: denyToolsCopilot, disallowTempDir });
      } catch {
        // Copilot launch failed — continue without it
      }
    }

    // Register in active.yaml
    addDispatch({
      id: dispatchId,
      repo,
      number,
      type,
      branch,
      worktreePath,
      status: initialStatus,
      session_id: copilotResult.sessionId || 'pending',
      pid: copilotResult.pid || null,
      logPath: copilotResult.logPath || null,
      ...(title ? { title } : {}),
    });
  } catch (err) {
    // Clean up orphaned worktree
    try {
      removeWorktree(resolvedRepoPath, worktreePath, { _exec });
    } catch {
      // Best-effort cleanup
    }
    try {
      _exec('git', ['branch', '-D', branch], { cwd: resolvedRepoPath, encoding: 'utf8' });
    } catch (cleanupError) {
      console.error(`Warning: failed to delete branch ${branch}: ${cleanupError.message}`);
    }
    throw err;
  }

  return { sessionId: copilotResult.sessionId };
}
