/**
 * E2E Dispatch Fixture
 * 
 * Shared test infrastructure for E2E action tests that need a real dispatch.
 * Clones rally-test-fixtures into a temp directory, creates an isolated
 * RALLY_HOME, dispatches to a real GitHub issue (#1), and cleans up after
 * all tests complete.
 * 
 * Usage:
 *   import { setupDispatchFixture, getFixture, teardownDispatchFixture } from '../../../harness/e2e-dispatch-fixture.js';
 *   
 *   describe('my action tests', () => {
 *     before(async function() { await setupDispatchFixture(this); });
 *     after(async () => { await teardownDispatchFixture(); });
 *     
 *     it('tests something', async () => {
 *       const { term, tempDir, dispatch } = getFixture();
 *       // use term to interact with dashboard
 *     });
 *   });
 */

import { spawn, cleanupAll } from './terminal.js';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import yaml from 'js-yaml';
import crypto from 'node:crypto';

// ─── Constants ───────────────────────────────────────────────────────────────

const RALLY_BIN = path.join(import.meta.dirname, '..', '..', 'bin', 'rally.js');
const REPO_ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim();

// E2E test issue in jsturtevant/rally-test-fixtures
const E2E_ISSUE_NUMBER = 1;
const E2E_ISSUE_URL = 'https://github.com/jsturtevant/rally-test-fixtures/issues/1';
const E2E_REPO = 'jsturtevant/rally-test-fixtures';

// Timeout for dispatch operations
const DISPATCH_TIMEOUT = 90_000;

// ─── Module State ────────────────────────────────────────────────────────────

let fixture = null;
let fixtureRepoPath = null;

/**
 * Check if GitHub CLI is authenticated
 */
export function isGhAuthenticated() {
  try {
    const result = spawnSync('gh', ['auth', 'status'], {
      encoding: 'utf8',
      timeout: 5000,
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

/**
 * Get skip reason if gh CLI is not authenticated
 */
export function getSkipReason() {
  if (!isGhAuthenticated()) {
    return 'Skipping: gh CLI not authenticated (run `gh auth login`)';
  }
  return undefined;
}

/**
 * Seed a minimal Rally config that registers the current repo as onboarded.
 */
function seedConfig(rallyHome, repoPath, repoName = E2E_REPO) {
  mkdirSync(rallyHome, { recursive: true });

  const teamDir = path.join(rallyHome, 'team');
  const projectsDir = path.join(rallyHome, 'projects');
  mkdirSync(teamDir, { recursive: true });
  mkdirSync(projectsDir, { recursive: true });

  writeFileSync(
    path.join(rallyHome, 'config.yaml'),
    yaml.dump({ teamDir, projectsDir, version: '0.1.0' }),
    'utf8',
  );

  writeFileSync(
    path.join(rallyHome, 'projects.yaml'),
    yaml.dump({
      projects: [{
        name: 'rally',
        path: repoPath,
        repo: repoName,
        team: 'shared',
        teamDir,
        onboarded: new Date().toISOString(),
      }],
    }),
    'utf8',
  );

  writeFileSync(path.join(rallyHome, 'active.yaml'), 'dispatches: []\n', 'utf8');
  return { teamDir, projectsDir };
}

/**
 * Clean up worktree and branch created by dispatch.
 */
function cleanupWorktree(repoPath, worktreePath, branchName) {
  if (worktreePath && existsSync(worktreePath)) {
    try {
      execFileSync('git', ['worktree', 'remove', worktreePath, '--force'], {
        cwd: repoPath, encoding: 'utf8',
      });
    } catch { /* already gone */ }
  }
  if (branchName) {
    try {
      execFileSync('git', ['branch', '-D', branchName], {
        cwd: repoPath, encoding: 'utf8',
      });
    } catch { /* already gone */ }
  }
}

/**
 * Dispatch to an issue using the library function (skips Copilot launch).
 * Uses the cloned fixture repo so we don't create worktrees inside the rally repo itself.
 */
async function dispatchToIssue(rallyHome, xdgConfigHome, repoPath) {
  // Set RALLY_HOME and XDG_CONFIG_HOME so the library writes to the right place
  // and finds the personal squad (avoids interactive prompt)
  const origRallyHome = process.env.RALLY_HOME;
  const origXdg = process.env.XDG_CONFIG_HOME;
  process.env.RALLY_HOME = rallyHome;
  if (xdgConfigHome) process.env.XDG_CONFIG_HOME = xdgConfigHome;

  try {
    const { dispatchIssue } = await import('../../lib/dispatch-issue.js');
    
    const result = await dispatchIssue({
      issueNumber: E2E_ISSUE_NUMBER,
      repo: E2E_REPO,
      repoPath,
      teamDir: path.join(rallyHome, 'team'),
      _setupConsultMode: () => {},
    });

    return {
      ...result,
      issue: E2E_ISSUE_NUMBER,
    };
  } finally {
    // Restore original RALLY_HOME
    if (origRallyHome !== undefined) {
      process.env.RALLY_HOME = origRallyHome;
    } else {
      delete process.env.RALLY_HOME;
    }
    // Restore original XDG_CONFIG_HOME
    if (origXdg !== undefined) {
      process.env.XDG_CONFIG_HOME = origXdg;
    } else {
      delete process.env.XDG_CONFIG_HOME;
    }
  }
}

/**
 * Setup the E2E dispatch fixture.
 * Clones rally-test-fixtures, creates isolated RALLY_HOME, dispatches to issue #1.
 * 
 * @param {object} testContext - Mocha/node:test context (for timeout extension)
 * @returns {Promise<void>}
 */
export async function setupDispatchFixture(options = {}) {
  if (!isGhAuthenticated()) {
    return; // Skip setup if not authenticated
  }

  // Clone the test fixture repo (no .squad/ → no consult mode conflict)
  fixtureRepoPath = path.join(mkdtempSync(path.join(tmpdir(), 'rally-fixture-')), 'rally-test-fixtures');
  execFileSync('git', ['clone', '--depth', '1', 'https://github.com/jsturtevant/rally-test-fixtures.git', fixtureRepoPath], {
    encoding: 'utf8',
    timeout: 30_000,
  });

  const randomId = crypto.randomBytes(4).toString('hex');
  const tempDir = mkdtempSync(path.join(tmpdir(), `rally-e2e-${randomId}-`));
  
  seedConfig(tempDir, fixtureRepoPath, E2E_REPO);

  // Create isolated XDG_CONFIG_HOME with seeded personal squad
  // so the in-process dispatch doesn't prompt for squad creation
  const xdgConfigHome = options.xdgConfigHome || mkdtempSync(path.join(tmpdir(), 'rally-xdg-dispatch-'));
  if (!options.xdgConfigHome) seedPersonalSquad(xdgConfigHome);

  // Dispatch to issue #1 against the cloned fixture repo
  const dispatch = await dispatchToIssue(tempDir, xdgConfigHome, fixtureRepoPath);

  fixture = {
    tempDir,
    xdgConfigHome,
    xdgOwned: !options.xdgConfigHome, // track whether we created it
    dispatch,
    worktreePath: dispatch.worktreePath,
    branchName: dispatch.branch,
    term: null, // Will be set when tests start dashboard
  };
}

/**
 * Get the current fixture state.
 * @returns {{ tempDir: string, dispatch: object, worktreePath: string, branchName: string, term: object|null }}
 */
export function getFixture() {
  if (!fixture) {
    throw new Error('Fixture not initialized. Call setupDispatchFixture first.');
  }
  return fixture;
}

/**
 * Seed a minimal personal squad so the dashboard skips the creation prompt.
 * Creates the directory structure that personalSquadExists() checks for.
 * 
 * @param {string} xdgConfigHome - XDG_CONFIG_HOME directory (personal squad resolves under here)
 * @returns {string} Path to the squad root
 */
export function seedPersonalSquad(xdgConfigHome) {
  const squadRoot = path.join(xdgConfigHome, 'squad', '.squad');
  mkdirSync(squadRoot, { recursive: true });
  writeFileSync(path.join(squadRoot, 'team.md'), '# Squad\n## Members\n', 'utf8');
  return squadRoot;
}

/**
 * Spawn the dashboard with an isolated XDG_CONFIG_HOME for personal squad resolution.
 * The personal squad must be pre-seeded via seedPersonalSquad() before calling this.
 * 
 * @param {object} options
 * @param {string} [options.rallyHome] - RALLY_HOME directory
 * @param {string} [options.xdgConfigHome] - XDG_CONFIG_HOME directory (isolates personal squad)
 * @param {number} [options.cols=120] - Terminal columns
 * @param {number} [options.rows=30] - Terminal rows
 * @param {object} [options.env={}] - Additional environment variables
 * @returns {Promise<object>} Terminal handle
 */
export async function spawnDashboard(options = {}) {
  const { rallyHome, xdgConfigHome, cols = 120, rows = 30, env = {} } = options;

  const term = await spawn(`node ${RALLY_BIN} dashboard`, {
    cols,
    rows,
    env: {
      ...(rallyHome ? { RALLY_HOME: rallyHome } : {}),
      ...(xdgConfigHome ? { XDG_CONFIG_HOME: xdgConfigHome } : {}),
      NO_COLOR: '1',
      CI: '0', // Ink defers rendering in CI mode — disable so PTY captures frames
      ...env,
    },
  });

  try {
    await term.waitFor('Rally Dashboard', { timeout: 15_000 });
  } catch (err) {
    const frame = term.getFrame();
    throw new Error(
      `Dashboard failed to start. Current terminal content:\n${frame}\n\nOriginal error: ${err.message}`
    );
  }

  return term;
}

/**
 * Start the dashboard and wait for it to be ready.
 * Uses spawnDashboard internally with pre-seeded personal squad.
 * @returns {Promise<object>} Terminal handle
 */
export async function startDashboard(options = {}) {
  if (!fixture) {
    throw new Error('Fixture not initialized. Call setupDispatchFixture first.');
  }

  const term = await spawnDashboard({
    rallyHome: fixture.tempDir,
    xdgConfigHome: options.xdgConfigHome || fixture.xdgConfigHome,
    cols: options.cols || 120,
    rows: options.rows || 30,
    env: options.env,
  });

  fixture.term = term;
  return term;
}

/**
 * Close the current dashboard terminal.
 */
export function closeDashboard() {
  if (fixture && fixture.term) {
    try {
      fixture.term.close();
    } catch { /* ignore */ }
    fixture.term = null;
  }
}

/**
 * Teardown the fixture and clean up all resources.
 */
export async function teardownDispatchFixture() {
  if (!fixture) {
    return;
  }

  // Close terminal if still open
  closeDashboard();

  // Cleanup worktree and branch against the cloned fixture repo
  if (fixture.worktreePath || fixture.branchName) {
    const cleanupRepo = fixtureRepoPath || REPO_ROOT;
    cleanupWorktree(cleanupRepo, fixture.worktreePath, fixture.branchName);
  }

  // Remove temp directory
  if (fixture.tempDir) {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }

  // Remove XDG_CONFIG_HOME if we created it
  if (fixture.xdgOwned && fixture.xdgConfigHome) {
    rmSync(fixture.xdgConfigHome, { recursive: true, force: true });
  }

  // Remove cloned fixture repo
  if (fixtureRepoPath) {
    rmSync(path.dirname(fixtureRepoPath), { recursive: true, force: true });
    fixtureRepoPath = null;
  }

  // Cleanup any lingering terminals
  await cleanupAll();

  fixture = null;
}

/**
 * Create an isolated config directory for tests that don't need a real dispatch.
 * Use this for tests that need isolation but use mock data.
 * 
 * @param {object} options - Configuration options
 * @param {string} [options.prefix='rally-test'] - Temp directory prefix
 * @returns {{ tempDir: string, cleanup: () => void }}
 */
export function createIsolatedConfig(options = {}) {
  const prefix = options.prefix || 'rally-test';
  const randomId = crypto.randomBytes(4).toString('hex');
  const tempDir = mkdtempSync(path.join(tmpdir(), `${prefix}-${randomId}-`));
  
  seedConfig(tempDir, REPO_ROOT);

  return {
    tempDir,
    cleanup: () => rmSync(tempDir, { recursive: true, force: true }),
    /**
     * Seed active.yaml with a dispatch record.
     * Accepts simplified params (issue, title) and converts to proper schema.
     * 
     * Required schema fields: id, repo, number, type, branch, worktreePath, status, session_id
     */
    seedConfigWithDispatch: (dispatchData) => {
      // Map 'issue' field to 'number' + 'type' for convenience
      const number = dispatchData.number ?? dispatchData.issue;
      const type = dispatchData.type ?? 'issue';
      
      const dispatch = {
        id: dispatchData.id || `test-dispatch-${number}`,
        repo: dispatchData.repo || 'jsturtevant/rally',
        number,
        type,
        branch: dispatchData.branch || `rally/${number}-test`,
        worktreePath: dispatchData.worktreePath,
        status: dispatchData.status || 'implementing',
        session_id: dispatchData.session_id || null,
        title: dispatchData.title || `Test Issue #${number}`,
        url: dispatchData.url || `https://github.com/${dispatchData.repo || 'jsturtevant/rally'}/issues/${number}`,
        created: dispatchData.created || dispatchData.createdAt || new Date().toISOString(),
      };
      
      const activeYaml = { dispatches: [dispatch] };
      writeFileSync(
        path.join(tempDir, 'active.yaml'),
        yaml.dump(activeYaml),
        'utf8',
      );
      
      // Create worktree directory if specified
      if (dispatch.worktreePath) {
        mkdirSync(path.join(dispatch.worktreePath, '.squad'), { recursive: true });
        writeFileSync(
          path.join(dispatch.worktreePath, '.squad', 'dispatch-context.md'),
          `# ${type === 'pr' ? 'PR' : 'Issue'} #${number}: ${dispatch.title}\nTest dispatch.`,
          'utf8',
        );
      }
    },
  };
}

// Export constants for tests
export const RALLY_BIN_PATH = RALLY_BIN;
export const REPO_ROOT_PATH = REPO_ROOT;
export const E2E_ISSUE = {
  number: E2E_ISSUE_NUMBER,
  url: E2E_ISSUE_URL,
  repo: E2E_REPO,
};
