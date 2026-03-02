import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createWorktree, removeWorktree, worktreeExists } from './worktree.js';
import { addDispatch } from './active.js';
import { validateOnboarded } from './config.js';
import { launchCopilot, checkCopilotAvailable, checkDockerSandboxAvailable } from './copilot.js';
import { slugify } from './utils.js';
import { RallyError, EXIT_GENERAL } from './errors.js';
import { setupConsultMode, getPersonalSquadRoot, PersonalSquadNotFoundError } from './squad-sdk.js';

/**
 * Validate common dispatch inputs.
 * @returns {{ number: number, repoName: string, resolvedRepoPath: string }}
 */
export function validateDispatchInputs({ itemNumber, repo, repoPath, itemLabel = 'item' }) {
  if (!itemNumber) {
    throw new RallyError(`${itemLabel} number is required`, EXIT_GENERAL);
  }
  if (!repo) {
    throw new RallyError('Repository (owner/repo) is required', EXIT_GENERAL);
  }
  const repoParts = repo.split('/');
  if (repoParts.length !== 2 || !repoParts[0] || !repoParts[1]) {
    throw new RallyError('Repository must be in "owner/repo" format', EXIT_GENERAL);
  }
  const repoName = repoParts[1];
  if (!repoPath) {
    throw new RallyError('Repository path is required', EXIT_GENERAL);
  }

  validateOnboarded(repo);

  const resolvedRepoPath = resolve(repoPath);
  const number = Number(itemNumber);
  if (!Number.isInteger(number) || number <= 0) {
    throw new RallyError(`Invalid ${itemLabel} number: "${itemNumber}". Must be a positive integer.`, EXIT_GENERAL);
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
 * Set up worktree with consult mode, launch Copilot, register dispatch.
 * Rolls back worktree on failure.
 *
 * @param {object} opts
 * @param {string} opts.resolvedRepoPath
 * @param {string} opts.worktreePath
 * @param {string} opts.branch
 * @param {string} opts.dispatchId
 * @param {string} opts.repo
 * @param {number} opts.number
 * @param {string} opts.type - 'issue' or 'pr'
 * @param {string} opts.initialStatus
 * @param {string} opts.copilotPrompt
 * @param {string} [opts.title] - Issue/PR title (persisted to active.yaml for dashboard display)
 * @param {Function} opts.preSymlinkFn - Setup before consult mode (e.g. fetch PR head)
 * @param {Function} opts.postSymlinkFn - Setup after consult mode (e.g. write context)
 * @param {boolean} [opts.sandbox] - Run Copilot inside a Docker sandbox
 * @param {Function} opts._exec
 * @param {Function} opts._spawn
 * @param {Function} opts._setupConsultMode - Injectable for testing
 * @returns {{ sessionId: string|null }}
 */
export function setupDispatchWorktree(opts) {
  const {
    resolvedRepoPath,
    worktreePath,
    branch,
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
    _setupConsultMode = setupConsultMode,
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
    // Pre-consult setup (e.g. fetch PR head ref)
    if (preSymlinkFn) {
      preSymlinkFn(worktreePath);
    }

    // Set up consult mode in the worktree (points to personal squad)
    // This replaces the old symlink approach with Squad SDK's consult mode
    try {
      // Derive project name from repo (owner/repo format) with org prefix
      const projectName = repo ? repo.replace('/', '-') : undefined;
      _setupConsultMode({
        projectRoot: worktreePath,
        personalSquadRoot: getPersonalSquadRoot(),
        projectName,
      });
    } catch (consultErr) {
      // Re-throw PersonalSquadNotFoundError so callers can prompt to create it
      if (consultErr instanceof PersonalSquadNotFoundError) {
        throw consultErr;
      }
      // Log but don't fail dispatch if consult mode setup fails for other reasons
      console.error(`Warning: consult mode setup failed: ${consultErr.message}`);
    }

    // Post-consult setup (e.g. write dispatch context)
    if (postSymlinkFn) {
      postSymlinkFn(worktreePath);
    }

    // Launch Copilot CLI (if available)
    if (sandbox) {
      if (!checkDockerSandboxAvailable({ _exec })) {
        throw new RallyError(
          'Docker sandbox not available — install Docker Desktop 4.58+ with sandbox support or remove --sandbox', EXIT_GENERAL
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
