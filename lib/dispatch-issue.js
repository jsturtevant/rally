import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { worktreeExists, removeWorktree } from './worktree.js';
import { getActiveDispatches } from './active.js';
import { writeIssueContext } from './dispatch-context.js';
import { slugify } from './utils.js';
import { validateDispatchInputs, warnUncommittedChanges, setupDispatchWorktree } from './dispatch-core.js';
import { checkDispatchTrust } from './dispatch-trust.js';
import { assertTools } from './tools.js';
import { RallyError, EXIT_GENERAL } from './errors.js';
import { ensurePersonalSquad } from './squad-sdk.js';

/**
 * Dispatch an issue: full workflow.
 *
 * @param {object} options
 * @param {number|string} options.issueNumber - GitHub issue number
 * @param {string} options.repo - owner/repo format
 * @param {string} options.repoPath - Absolute path to the local repo
 * @param {Function} [options._exec] - Injectable execFileSync (for testing)
 * @param {Function} [options._spawn] - Injectable spawn (for testing)
 * @param {boolean} [options.sandbox] - Run Copilot inside a Docker sandbox
 * @param {boolean} [options.trust] - Skip trust/author warnings
 * @param {Function} [options._confirm] - Injectable confirm prompt (for testing)
 * @param {boolean} [options._isTTY] - Override TTY detection (for testing)
 * @param {Function} [options._ensurePersonalSquad] - Injectable for testing
 * @returns {{ aborted: true } | { branch: string, worktreePath: string, sessionId: string }} Dispatch result, or `{ aborted: true }` if user declines the trust prompt
 */
export async function dispatchIssue(options = {}) {
  const {
    issueNumber,
    repo,
    repoPath,
    sandbox,
    trust,
    denyToolsCopilot,
    denyToolsSandbox,
    disallowTempDir,
    _exec = execFileSync,
    _spawn,
    _confirm,
    _setupConsultMode,
    _ensurePersonalSquad = ensurePersonalSquad,
  } = options;

  // Verify gh CLI is available
  assertTools(['gh'], { _exec });

  const { number, repoName, resolvedRepoPath } = validateDispatchInputs({
    itemNumber: issueNumber,
    repo,
    repoPath,
    itemLabel: 'Issue',
  });

  warnUncommittedChanges(resolvedRepoPath, _exec);

  // Ensure personal squad exists (prompt to create if needed)
  const squadReady = await _ensurePersonalSquad({ _confirm });
  if (!squadReady) {
    console.log('Dispatch aborted: personal squad is required.');
    return { aborted: true, reason: 'no-squad' };
  }

  // Trust check: warn if the issue author differs from the current user
  const proceed = await checkDispatchTrust({
    type: 'issue', number, repo, trust, _exec, _confirm, _isTTY: options._isTTY,
  });
  if (!proceed) {
    console.log('Dispatch aborted by user.');
    return { aborted: true };
  }

  // Fetch issue
  let issue;
  try {
    const output = _exec(
      'gh',
      ['issue', 'view', String(number), '--repo', repo, '--json', 'title,body,labels,assignees'],
      { encoding: 'utf8' }
    );
    issue = JSON.parse(output);
  } catch (error) {
    if (error.message && error.message.includes('Could not resolve to an Issue')) {
      throw new RallyError(`Issue #${number} not found in ${repo}`, EXIT_GENERAL);
    }
    throw new RallyError(`Failed to fetch issue #${number}: ${error.message}`, EXIT_GENERAL);
  }

  // Create branch name
  const slug = slugify(issue.title);
  const branch = `rally/${number}-${slug}`;
  const worktreePath = join(resolvedRepoPath, '.worktrees', `rally-${number}`);
  const dispatchId = `${repoName}-issue-${number}`;

  if (worktreeExists(resolvedRepoPath, worktreePath)) {
    // Check if this dispatch is actually registered
    const dispatches = getActiveDispatches();
    const registered = dispatches.find(d => d.id === dispatchId);
    if (registered) {
      console.error(`Warning: worktree already exists at ${worktreePath}, skipping creation`);
      return {
        branch,
        worktreePath,
        sessionId: null,
        dispatchId,
        issue: { number, title: issue.title },
        existing: true,
      };
    }
    // Stale worktree from a crashed attempt — clean up and re-create
    console.error(`Cleaning up stale worktree at ${worktreePath}`);
    try {
      removeWorktree(resolvedRepoPath, worktreePath, { _exec });
    } catch { /* best-effort */ }
    try {
      _exec('git', ['branch', '-D', branch], { cwd: resolvedRepoPath, encoding: 'utf8' });
    } catch { /* branch may not exist */ }
  }

  const setupArgs = {
    resolvedRepoPath,
    worktreePath,
    branch,
    dispatchId,
    repo,
    number,
    type: 'issue',
    initialStatus: 'implementing',
    title: issue.title,
    copilotPrompt: `Read .squad/dispatch-context.md for the full issue context, then work on issue #${number}.

## Instructions

1. **Plan with your team.** Use the squad skill to invoke your AI team and develop a plan. Have the Lead or relevant specialists analyze the issue and propose an approach.

2. **Execute the plan.** Spawn sub-agents to implement the solution in parallel where possible. Each agent should work on their area of expertise.

3. **Review the changes.** Spawn a reviewer sub-agent (different from the implementer) to review the code changes. Address any critical feedback.

4. **Run tests.** Execute the project's test suite. If there are test commands in package.json, use them. Common patterns:
   - \`npm test\`
   - \`npm run test\`
   - Look for test scripts in package.json

5. **Fix failing tests.** If tests fail, iterate:
   - Analyze the failure
   - Fix the issue
   - Re-run tests
   - Repeat until all tests pass

6. **Commit when ready.** Once tests pass and you're confident in the solution, commit the changes with a clear message referencing issue #${number}.

7. **Finalize with Scribe.** As the LAST step, spawn the Scribe agent to:
   - Merge any decisions from \`.squad/decisions/inbox/\` into \`.squad/decisions.md\`
   - Update agent history files with learnings from this session
   - Write an orchestration log entry summarizing what was done
   - Commit the \`.squad/\` changes
   
   Wait for Scribe to complete — do NOT fire-and-forget this step.`,
    postSymlinkFn: (wtPath) => {
      writeIssueContext(wtPath, { ...issue, number });
    },
    _exec,
    _spawn,
    _setupConsultMode,
    sandbox,
    denyToolsCopilot,
    denyToolsSandbox,
    disallowTempDir,
  };

  let setupResult = setupDispatchWorktree(setupArgs);

  if (setupResult.alreadyExists) {
    // Check if this dispatch is actually registered (TOCTOU race)
    const dispatches2 = getActiveDispatches();
    const registered2 = dispatches2.find(d => d.id === dispatchId);
    if (registered2) {
      console.error(`Warning: worktree already exists at ${worktreePath}, skipping creation`);
      return {
        branch,
        worktreePath,
        sessionId: null,
        dispatchId,
        issue: { number, title: issue.title },
        existing: true,
      };
    }
    // Stale worktree from a crashed attempt — clean up and re-create
    console.error(`Cleaning up stale worktree at ${worktreePath}`);
    try {
      removeWorktree(resolvedRepoPath, worktreePath, { _exec });
    } catch { /* best-effort */ }
    try {
      _exec('git', ['branch', '-D', branch], { cwd: resolvedRepoPath, encoding: 'utf8' });
    } catch { /* branch may not exist */ }
    setupResult = setupDispatchWorktree(setupArgs);
  }

  return {
    branch,
    worktreePath,
    sessionId: setupResult.sessionId,
    dispatchId,
    issue: { number, title: issue.title },
  };
}
