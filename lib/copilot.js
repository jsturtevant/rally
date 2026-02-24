import { execFileSync, spawn } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';

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
 * Check if Docker sandbox is available.
 * @param {object} [opts]
 * @param {Function} [opts._exec] - Injectable execFileSync (for testing)
 * @returns {boolean} true if docker sandbox is available
 */
export function checkDockerSandboxAvailable(opts = {}) {
  const exec = opts._exec || execFileSync;
  try {
    exec('docker', ['sandbox', '--help'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Launch Copilot CLI in a worktree directory.
 * Returns session info (session ID, child process, and log path), or nulls if unavailable.
 *
 * @param {string} worktreePath - Path to the worktree
 * @param {string} prompt - Prompt text for Copilot
 * @param {object} [opts]
 * @param {string} [opts.logPath] - Path to log file for stdout/stderr redirection
 * @param {boolean} [opts.sandbox] - Run Copilot inside a Docker sandbox microVM
 * @param {Function} [opts._spawn] - Injectable spawn (for testing)
 * @param {Function} [opts._fs] - Injectable fs functions (for testing)
 * @returns {{ sessionId: string|null, process: object|null, logPath: string|null }}
 */
export function launchCopilot(worktreePath, prompt, opts = {}) {
  const spawnFn = opts._spawn || spawn;
  const fsOpen = opts._fs?.openSync || openSync;
  const fsClose = opts._fs?.closeSync || closeSync;
  const logPath = opts.logPath || null;

  let fd = null;
  try {
    let stdio = 'inherit';

    if (logPath) {
      fd = fsOpen(logPath, 'w');
      stdio = ['ignore', fd, fd];
    }

    let cmd, args;
    if (opts.sandbox) {
      // Run Copilot inside a Docker sandbox microVM for host isolation.
      // Uses `docker sandbox run copilot <workspace> -- [agent-args]` syntax.
      // Requires GH_TOKEN or GITHUB_TOKEN set globally in shell config and
      // Docker Desktop restarted so the daemon picks up the credential.
      // See: https://docs.docker.com/ai/sandboxes/agents/copilot/
      cmd = 'docker';
      args = [
        'sandbox', 'run',
        'copilot', worktreePath,
        '--', '-p', `workspace ${prompt}`,
      ];
    } else {
      cmd = 'gh';
      args = ['copilot', '-p', `workspace ${prompt}`];
    }

    const child = spawnFn(cmd, args, {
      cwd: worktreePath,
      stdio,
      detached: true,
    });

    if (fd !== null) {
      fsClose(fd);
      fd = null;
    }

    // Session ID capture is not yet supported by gh copilot CLI;
    // store PID as a placeholder identifier until real session tracking is available.
    const sessionId = child.pid ? String(child.pid) : null;
    child.unref();
    return { sessionId, process: child, logPath };
  } catch (error) {
    if (fd !== null) {
      try { fsClose(fd); } catch { /* best-effort cleanup */ }
    }
    if (error.code === 'ENOENT' || error.message.includes('ENOENT')) {
      return { sessionId: null, process: null, logPath: null };
    }
    throw error;
  }
}
