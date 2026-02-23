import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Returns the copilot-instructions.md content that restricts Copilot
 * to local-only work during dispatch.
 * @returns {string}
 */
export function getCopilotInstructions() {
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
    '- **Do NOT run `gh` commands that mutate remote state:**',
    '  - No `gh pr create`, `gh pr merge`, `gh pr close`, `gh pr comment`',
    '  - No `gh issue close`, `gh issue comment`, `gh issue edit`',
    '  - No `gh api` calls that use POST, PUT, PATCH, or DELETE methods',
    '  - No `gh repo` write operations',
    '- **Do NOT push commits** (`git push` is prohibited)',
    '- **Do NOT create or modify pull requests**',
    '- **Do NOT comment on or close issues**',
    '- **Do NOT use MCP tools to modify external state**',
    '  (no creating PRs, issues, comments, or reviews via MCP)',
    '',
    '## Allowed `gh` commands (read-only)',
    '',
    '- `gh issue view` — read issue details',
    '- `gh pr view` — read PR details',
    '- `gh pr diff` — view PR diffs',
    '- `gh api` with GET method only — read API data',
    '- `gh repo view` — read repo metadata',
    '',
    '## Summary',
    '',
    'Your job is to **analyze and prepare**. Make local changes, write tests,',
    'fix code — but leave all publishing and communication to the human reviewer.',
    '',
  ].join('\n');
}

/**
 * Write copilot-instructions.md into the worktree's .github/ directory.
 * Creates .github/ if it doesn't exist.
 *
 * @param {string} worktreePath - Absolute path to the worktree
 * @param {object} [opts]
 * @param {object} [opts._fs] - Injectable fs functions (for testing)
 */
export function writeCopilotInstructions(worktreePath, opts = {}) {
  const fs = opts._fs || { writeFileSync, mkdirSync, existsSync };

  if (!worktreePath) {
    throw new Error('worktreePath is required');
  }

  const githubDir = join(worktreePath, '.github');
  if (!fs.existsSync(githubDir)) {
    fs.mkdirSync(githubDir, { recursive: true });
  }

  const instructionsPath = join(githubDir, 'copilot-instructions.md');
  fs.writeFileSync(instructionsPath, getCopilotInstructions(), 'utf8');
}
