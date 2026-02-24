import { execFileSync } from 'node:child_process';
import path from 'node:path';

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
    throw new Error(
      `Failed to create worktree at ${absoluteWorktreePath}: ${error.message}`
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
        throw new Error(
          `Worktree at ${absoluteWorktreePath} has uncommitted changes. Pass { force: true } to remove anyway.`
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
    throw new Error(
      `Failed to remove worktree at ${absoluteWorktreePath}: ${error.message}`
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
        // Normalize path separators for cross-platform compatibility
        currentWorktree.path = path.resolve(line.substring(9));
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
    throw new Error(
      `Failed to list worktrees for ${absoluteRepoPath}: ${error.message}`
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
  const absoluteWorktreePath = path.resolve(worktreePath);
  const worktrees = listWorktrees(repoPath);
  return worktrees.some((wt) => wt.path === absoluteWorktreePath);
}
