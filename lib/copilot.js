import { execFileSync, spawn } from 'node:child_process';

/**
 * Check if gh copilot extension is available.
 * @param {object} [opts]
 * @param {Function} [opts._exec] - Injectable execFileSync (for testing)
 * @returns {boolean} true if gh copilot is available
 */
export function checkCopilotAvailable(opts = {}) {
  const exec = opts._exec || execFileSync;
  try {
    exec('gh', ['copilot', '--help'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Launch Copilot CLI in a worktree directory.
 * Returns session info (session ID and child process), or nulls if unavailable.
 *
 * @param {string} worktreePath - Path to the worktree
 * @param {string} prompt - Prompt text for Copilot
 * @param {object} [opts]
 * @param {Function} [opts._spawn] - Injectable spawn (for testing)
 * @returns {{ sessionId: string|null, process: object|null }}
 */
export function launchCopilot(worktreePath, prompt, opts = {}) {
  const spawnFn = opts._spawn || spawn;
  try {
    const child = spawnFn('gh', ['copilot', 'workspace', prompt], {
      cwd: worktreePath,
      stdio: 'inherit',
      detached: true,
    });
    // Session ID capture is not yet supported by gh copilot CLI;
    // store PID as a placeholder identifier until real session tracking is available.
    const sessionId = child.pid ? String(child.pid) : null;
    child.unref();
    return { sessionId, process: child };
  } catch (error) {
    if (error.code === 'ENOENT' || error.message.includes('ENOENT')) {
      return { sessionId: null, process: null };
    }
    throw error;
  }
}
