import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { RallyError, EXIT_GENERAL } from './errors.js';

/**
 * Resolves a path to its canonical form, handling Windows short paths
 * (e.g. RUNNER~1 → runneradmin) and normalizing separators.
 * Uses native realpath to resolve 8.3 short names on Windows.
 */
function canonicalize(p) {
  try {
    let resolved = realpathSync.native(p);
    // On Windows, native realpath may return extended-length paths with \\?\ prefix.
    // Handle UNC and non-UNC variants without corrupting the path.
    if (resolved.startsWith('\\\\?\\UNC\\')) {
      // \\?\UNC\server\share\path -> \\server\share\path
      resolved = '\\\\' + resolved.slice(8);
    } else if (resolved.startsWith('\\\\?\\')) {
      // \\?\C:\path -> C:\path
      resolved = resolved.slice(4);
    }
    return resolved;
  } catch {
    return path.resolve(p);
  }
}

/**
 * Creates a new git worktree.
 * @param {string} repoPath - Path to the main git repository
 * @param {string} worktreePath - Path where worktree will be created
 * @param {string} branchName - Name of the new branch to create
 * @returns {string} Full absolute path to the created worktree
 */
export function createWorktree(repoPath, worktreePath, branchName) {
  const absoluteRepoPath = path.resolve(repoPath);
  const absoluteWorktreePath = path.resolve(worktreePath);

  try {
    execFileSync(
      'git',
      ['worktree', 'add', absoluteWorktreePath, '-b', branchName],
      { cwd: absoluteRepoPath, encoding: 'utf8' }
    );
    return absoluteWorktreePath;
  } catch (error) {
    const errOutput = String(error.stderr || error.message || '');
    if (errOutput.includes('already exists')) {
      const raceErr = new Error(
        `Worktree already exists at ${absoluteWorktreePath}`
      );
      raceErr.code = 'WORKTREE_EXISTS';
      throw raceErr;
    }
    throw new RallyError(
      `Failed to create worktree at ${absoluteWorktreePath}: ${error.message}`, EXIT_GENERAL
    );
  }
}

/**
 * Removes an existing git worktree.
 * @param {string} repoPath - Path to the main git repository
 * @param {string} worktreePath - Path to the worktree to remove
 * @param {object} [opts]
 * @param {boolean} [opts.force=true] - Use --force flag (default true for backward compat)
 * @param {Function} [opts._exec] - Injectable execFileSync (for testing)
 * @throws {Error} When force is false and worktree has uncommitted changes
 * @throws {Error} When git worktree remove fails
 */
export function removeWorktree(repoPath, worktreePath, opts = {}) {
  const absoluteRepoPath = path.resolve(repoPath);
  const absoluteWorktreePath = path.resolve(worktreePath);
  const exec = opts._exec || execFileSync;
  const force = opts.force !== false;

  if (!force) {
    // Check for uncommitted changes before removing
    try {
      const status = exec('git', ['status', '--porcelain'], {
        cwd: absoluteWorktreePath,
        encoding: 'utf8',
      });
      if (status && status.trim().length > 0) {
        throw new RallyError(
          `Worktree at ${absoluteWorktreePath} has uncommitted changes. Pass { force: true } to remove anyway.`, EXIT_GENERAL
        );
      }
    } catch (err) {
      if (err.message.includes('uncommitted changes')) throw err;
      // If directory doesn't exist (ENOENT) or isn't a git repo, proceed with removal
      if (err.code && err.code !== 'ENOENT') throw err;
    }
  }

  const args = ['worktree', 'remove', absoluteWorktreePath];
  if (force) args.push('--force');

  try {
    exec('git', args, { cwd: absoluteRepoPath, encoding: 'utf8' });
  } catch (error) {
    throw new RallyError(
      `Failed to remove worktree at ${absoluteWorktreePath}: ${error.message}`, EXIT_GENERAL
    );
  }
}

/**
 * Lists all worktrees in a git repository.
 * @param {string} repoPath - Path to the main git repository
 * @returns {Array<{path: string, branch: string, head: string}>} Array of worktree info
 */
export function listWorktrees(repoPath) {
  const absoluteRepoPath = path.resolve(repoPath);

  try {
    const output = execFileSync(
      'git',
      ['worktree', 'list', '--porcelain'],
      { cwd: absoluteRepoPath, encoding: 'utf8' }
    );

    const worktrees = [];
    const lines = output.trim().split('\n');
    let currentWorktree = {};

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        // Normalize path separators and resolve short paths for cross-platform compatibility
        currentWorktree.path = canonicalize(line.substring(9));
      } else if (line.startsWith('HEAD ')) {
        currentWorktree.head = line.substring(5);
      } else if (line.startsWith('branch ')) {
        currentWorktree.branch = line.substring(7);
      } else if (line === '') {
        if (currentWorktree.path) {
          worktrees.push(currentWorktree);
          currentWorktree = {};
        }
      }
    }

    // Add the last worktree if present
    if (currentWorktree.path) {
      worktrees.push(currentWorktree);
    }

    return worktrees;
  } catch (error) {
    throw new RallyError(
      `Failed to list worktrees for ${absoluteRepoPath}: ${error.message}`, EXIT_GENERAL
    );
  }
}

/**
 * Checks if a worktree exists at the given path.
 * @param {string} repoPath - Path to the main git repository
 * @param {string} worktreePath - Path to check for worktree existence
 * @returns {boolean} True if worktree exists, false otherwise
 */
export function worktreeExists(repoPath, worktreePath) {
  const absoluteWorktreePath = canonicalize(worktreePath);
  const worktrees = listWorktrees(repoPath);
  return worktrees.some((wt) => wt.path === absoluteWorktreePath);
}
