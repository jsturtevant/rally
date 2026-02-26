import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { worktreeExists } from './worktree.js';
import { writePrContext } from './dispatch-context.js';
import { slugify } from './utils.js';
import { validateDispatchInputs, warnUncommittedChanges, setupDispatchWorktree } from './dispatch-core.js';
import { checkDispatchTrust } from './dispatch-trust.js';
import { assertTools } from './tools.js';
import { RallyError, EXIT_GENERAL } from './errors.js';

/**
 * Sanitize a git ref name for safe interpolation into prompts.
 * Strips characters outside the safe set for branch/tag names.
 */
function sanitizeRef(name) {
  return (name || '').replace(/[^a-zA-Z0-9/_.\-]/g, '');
}

/**
 * Build a rich, multi-model code review prompt for a PR.
 *
 * @param {object} pr - PR data with number, headRefName, baseRefName
 * @returns {string} Prompt text for Copilot
 */
export function buildReviewPrompt(pr) {
  const head = sanitizeRef(pr.headRefName);
  const base = sanitizeRef(pr.baseRefName);
  return `Read .squad/dispatch-context.md for full PR context.

Review PR #${pr.number} — compare branch \`${head}\` against base \`${base}\`.

## Instructions

1. Make sure the base branch (\`${base}\`) is up to date. If there is an upstream remote, fetch it and use that as the comparison basis.
2. Look at the commits for this branch and run code reviews in parallel sub-agents using the following models:
   - Claude Opus 4.6
   - GPT 5.3 Codex
   - Gemini 3 Pro Preview
3. Collect and consolidate the critical feedback and analysis of which bugs were reported across the agents.

## Reporting

- Report ALL issues found. Include line numbers when reporting each issue.
- Only report issues that are **introduced in the changes** for this branch — do not flag pre-existing problems.
- For each issue, note which agent(s)/model(s) reported it.
- Categorize every issue by severity: **Critical**, **High**, **Medium**, or **Low**.
- Provide a summary table of issue counts by severity and which agents reported them.

## Inline File Comments

For every issue found, place a comment directly in the source file at the exact line where the issue occurs. Use this format:

\`\`\`
// # REVIEW ISSUE #N [SEVERITY]: Brief description
\`\`\`

Where N is the issue number (sequential, starting at 1) and SEVERITY is one of CRITICAL, HIGH, MEDIUM, or LOW.

Leave these commented files **unstaged** — do NOT \`git add\` them. The developer will use \`git diff\` to find all inline review comments.

## REVIEW.md Template

Write the review to \`REVIEW.md\` in the root of the repo using exactly this structure:

\`\`\`markdown
# Code Review: PR #${pr.number} — {title}

**PR:** {link}
**Branch:** \`${head}\` → \`${base}\`
**Author:** @{author}
**Review Date:** {date}

## Summary
{overview of the changes and their purpose}

## Issues Summary

| Severity | Count | Reported By |
|----------|-------|-------------|

## Critical Issues
### {N}. {short description}
**File:** \`{path}:{line}\`
**Reported By:** {models that found this issue}
**Problem:** {description of the issue}
**Evidence:** {code snippet or reasoning}
**Suggested Fix:** {suggestion for how to fix}

## High Issues
(same format as Critical Issues)

## Medium Issues
(same format as Critical Issues)

## Low Issues
(same format as Critical Issues)

## Reviewer Agreement Matrix

| Issue | Claude Opus 4.6 | GPT-5.3-Codex | Gemini 3 Pro Preview |
|-------|-----------------|---------------|--------------|

## Recommendations
1. **Must Fix Before Merge:** (Critical issues)
2. **Should Fix:** (High issues)
3. **Consider Fixing:** (Medium/Low issues)

## Files Changed

| File | Additions | Deletions |
|------|-----------|-----------|

**Total:** +N / -N lines across M files

## Issue Index

| Issue # | Severity | File | Comment Location | Found By |
|---------|----------|------|------------------|----------|
\`\`\`

If a severity section has no issues, include the heading with "No issues found." beneath it.

## IMPORTANT

- Do NOT stage or commit the inline review comments — leave modified source files unstaged.
- Do NOT make any code changes beyond the inline review comments — this is a review only.
`;
}

/**
 * Fetch a PR and validate it is open (not merged/closed).
 *
 * @param {number} number - PR number
 * @param {string} repo - owner/repo
 * @param {Function} _exec - Injectable execFileSync
 * @returns {object} PR data
 */
export function fetchPrOrFail(number, repo, _exec = execFileSync) {
  let pr;
  try {
    const output = _exec(
      'gh',
      [
        'pr', 'view', String(number),
        '--repo', repo,
        '--json', 'title,body,headRefName,baseRefName,files,state',
      ],
      { encoding: 'utf8' }
    );
    pr = JSON.parse(output);
  } catch (error) {
    if (error.message && error.message.includes('Could not resolve to a PullRequest')) {
      throw new RallyError(`PR #${number} not found in ${repo}`, EXIT_GENERAL);
    }
    throw new RallyError(`Failed to fetch PR #${number}: ${error.message}`, EXIT_GENERAL);
  }

  if (pr.state === 'MERGED') {
    throw new RallyError(`PR #${number} is already merged`, EXIT_GENERAL);
  }
  if (pr.state === 'CLOSED') {
    throw new RallyError(`PR #${number} is closed`, EXIT_GENERAL);
  }

  return pr;
}

/**
 * Dispatch a PR review: full workflow.
 *
 * Steps:
 *  1. Validate inputs (including onboarding check)
 *  2. Fetch PR via gh CLI, validate open
 *  3. Create branch rally/pr-{number}-{slug}
 *  4. Create worktree at .worktrees/rally-pr-{number}/
 *  5. Symlink squad into worktree
 *  6. Write dispatch-context.md via writePrContext()
 *  7. Launch Copilot CLI with review prompt
 *  8. Add dispatch to active.yaml with status "reviewing"
 *  9. Return session info
 *
 * @param {object} options
 * @param {number|string} options.prNumber - GitHub PR number
 * @param {string} options.repo - owner/repo format
 * @param {string} options.repoPath - Absolute path to the local repo
 * @param {string} [options.teamDir] - Path to the squad team directory to symlink
 * @param {string} [options.promptFile] - Path to a custom review prompt file
 * @param {Function} [options._exec] - Injectable execFileSync (for testing)
 * @param {Function} [options._spawn] - Injectable spawn (for testing)
 * @param {boolean} [options.sandbox] - Run Copilot inside a Docker sandbox
 * @param {boolean} [options.trust] - Skip trust/author warnings
 * @param {Function} [options._confirm] - Injectable confirm prompt (for testing)
 * @param {boolean} [options._isTTY] - Override TTY detection (for testing)
 * @returns {{ aborted: true } | { branch: string, worktreePath: string, sessionId: string, pr: object }} Dispatch result, or `{ aborted: true }` if user declines the trust prompt
 */
export async function dispatchPr(options = {}) {
  const {
    prNumber,
    repo,
    repoPath,
    teamDir,
    promptFile,
    sandbox,
    trust,
    denyToolsCopilot,
    denyToolsSandbox,
    disallowTempDir,
    _exec = execFileSync,
    _spawn,
    _confirm,
  } = options;

  // Verify gh CLI is available
  assertTools(['gh'], { _exec });

  // Validate custom prompt file early
  if (promptFile && !existsSync(promptFile)) {
    throw new RallyError(`Custom prompt file not found: ${promptFile}`, EXIT_GENERAL);
  }

  const { number, repoName, resolvedRepoPath } = validateDispatchInputs({
    itemNumber: prNumber,
    repo,
    repoPath,
    itemLabel: 'PR',
  });

  warnUncommittedChanges(resolvedRepoPath, _exec);

  // Trust check: warn if the PR author differs from the current user
  const proceed = await checkDispatchTrust({
    type: 'pr', number, repo, trust, _exec, _confirm, _isTTY: options._isTTY,
  });
  if (!proceed) {
    console.log('Dispatch aborted by user.');
    return { aborted: true };
  }

  // Fetch PR and validate state
  const pr = fetchPrOrFail(number, repo, _exec);

  // Create branch name
  const slug = slugify(pr.title);
  const branch = `rally/pr-${number}-${slug}`;
  const worktreePath = join(resolvedRepoPath, '.worktrees', `rally-pr-${number}`);
  const dispatchId = `${repoName}-pr-${number}`;

  if (worktreeExists(resolvedRepoPath, worktreePath)) {
    console.error(`Warning: worktree already exists at ${worktreePath}, skipping creation`);
    return {
      branch,
      worktreePath,
      sessionId: null,
      dispatchId,
      pr: { number, title: pr.title },
      existing: true,
    };
  }

  const setupResult = setupDispatchWorktree({
    resolvedRepoPath,
    worktreePath,
    branch,
    teamDir,
    dispatchId,
    repo,
    number,
    type: 'pr',
    initialStatus: 'implementing',
    title: pr.title,
    copilotPrompt: promptFile
      ? readFileSync(promptFile, 'utf8')
      : buildReviewPrompt({ ...pr, number }),
    preSymlinkFn: (wtPath) => {
      // Checkout PR's head ref using GitHub's pull ref (works for forks too)
      try {
        _exec('git', ['fetch', 'origin', `refs/pull/${number}/head`], { cwd: wtPath, encoding: 'utf8', stdio: 'pipe' });
      } catch (err) {
        throw new RallyError(`Failed to fetch PR #${number} head ref: ${err.message}`, EXIT_GENERAL);
      }
      try {
        _exec('git', ['reset', '--hard', 'FETCH_HEAD'], { cwd: wtPath, encoding: 'utf8', stdio: 'pipe' });
      } catch (err) {
        throw new RallyError(`Failed to reset worktree to PR #${number} head: ${err.message}`, EXIT_GENERAL);
      }
    },
    postSymlinkFn: (wtPath) => {
      writePrContext(wtPath, { ...pr, number });
    },
    _exec,
    _spawn,
    sandbox,
    denyToolsCopilot,
    denyToolsSandbox,
    disallowTempDir,
  });

  if (setupResult.alreadyExists) {
    console.error(`Warning: worktree already exists at ${worktreePath}, skipping creation`);
    return {
      branch,
      worktreePath,
      sessionId: null,
      dispatchId,
      pr: { number, title: pr.title },
      existing: true,
    };
  }

  return {
    branch,
    worktreePath,
    sessionId: setupResult.sessionId,
    dispatchId,
    pr: { number, title: pr.title },
  };
}
