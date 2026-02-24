import { execFileSync, spawn } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';

/**
 * Tools denied during dispatch to enforce read-only mode.
 * Deny flags take precedence over --allow-all-tools.
 */
export const DENY_TOOLS = [
  // Git: block pushing
  'shell(git push)',
  // GH CLI: block ALL gh commands. Dispatched agents use MCP read tools
  // (github-mcp-server) for remote data access instead.
  'shell(gh)',
  // Note: github-mcp-server is intentionally NOT denied so that
  // Copilot can use MCP read tools (issue_read, pull_request_read, etc.)
];

/**
 * Returns the read-only policy text prepended to dispatch prompts.
 * @returns {string}
 */
export function getReadOnlyPolicy() {
  return [
    '# Rally Dispatch — Read-Only Policy',
    '',
    'You have been launched by Rally to work on a dispatched issue or PR.',
    'You are operating in a **read-only dispatch** mode. A human will review',
    'your work before any changes are pushed or published.',
    '',
    '## What you CAN do',
    '',
    '- Read the issue/PR context in `.squad/dispatch-context.md`',
    '- Analyze the codebase in this worktree',
    '- Make local code changes (edit, create, delete files)',
    '- Write recommendations or analysis to local files',
    '- Run local builds, linters, and tests',
    '- Use `git` for local operations (add, commit, diff, log, status)',
    '',
    '## What you MUST NOT do',
    '',
    '- **Do NOT run any `gh` CLI commands** — all `gh` subcommands are blocked',
    '  (`shell(gh)` is denied). Use MCP tools for remote reads instead.',
    '- **Do NOT push commits** (`git push` is prohibited)',
    '- **Do NOT create or modify pull requests**',
    '- **Do NOT comment on or close issues**',
    '- **Do NOT use MCP tools to modify external state**',
    '',
    '## How to read remote data',
    '',
    '- Use **MCP read-only tools** (these are NOT blocked):',
    '  - `github-mcp-server-issue_read` — read issue details',
    '  - `github-mcp-server-pull_request_read` — read PR details',
    '  - `github-mcp-server-get_file_contents` — read repo files',
    '  - `github-mcp-server-search_code` — search code across repos',
    '- The `gh` CLI is NOT available for reads — use MCP tools instead',
    '',
    '## Summary',
    '',
    'Your job is to **analyze and prepare**. Make local changes, write tests,',
    'fix code — but leave all publishing and communication to the human reviewer.',
    '',
  ].join('\n');
}

/**
 * Check if Docker sandbox support is available.
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
 * Returns session info (session ID, child process, and log path), or nulls if unavailable.
 *
 * Enforces read-only mode via --deny-tool flags and prepends the read-only
 * policy to the prompt. Uses --allow-all-tools so Copilot can use read tools
 * without prompting (deny flags take precedence).
 *
 * @param {string} worktreePath - Path to the worktree
 * @param {string} prompt - Prompt text for Copilot
 * @param {object} [opts]
 * @param {string} [opts.logPath] - Path to log file for stdout/stderr redirection
 * @param {boolean} [opts.sandbox] - When true, run inside a Docker sandbox microVM
 * @param {Function} [opts._spawn] - Injectable spawn (for testing)
 * @param {Function} [opts._fs] - Injectable fs functions (for testing)
 * @returns {{ sessionId: string|null, process: object|null, logPath: string|null }}
 */
export function launchCopilot(worktreePath, prompt, opts = {}) {
  const spawnFn = opts._spawn || spawn;
  const fsOpen = opts._fs?.openSync || openSync;
  const fsClose = opts._fs?.closeSync || closeSync;
  const logPath = opts.logPath || null;

  const denyArgs = DENY_TOOLS.flatMap(t => ['--deny-tool', t]);
  const fullPrompt = `workspace ${getReadOnlyPolicy()}\n${prompt}`;

  let fd = null;
  try {
    let stdio = 'inherit';

    if (logPath) {
      fd = fsOpen(logPath, 'w');
      stdio = ['ignore', fd, fd];
    }

    const agentArgs = [
      '--allow-all-tools',
      ...denyArgs,
      '-p', fullPrompt,
    ];

    let cmd, args;
    if (opts.sandbox) {
      cmd = 'docker';
      args = ['sandbox', 'run', 'copilot', worktreePath, '--', ...agentArgs];
    } else {
      cmd = 'gh';
      args = ['copilot', ...agentArgs];
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
