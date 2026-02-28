/**
 * E2E Dispatch Fixture
 * 
 * Shared test infrastructure for E2E action tests that need a real dispatch.
 * Creates an isolated RALLY_HOME, dispatches to a real GitHub issue (#54),
 * and cleans up after all tests complete.
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

// E2E test issue in jsturtevant/rally
const E2E_ISSUE_NUMBER = 54;
const E2E_ISSUE_URL = 'https://github.com/jsturtevant/rally/issues/54';
const E2E_REPO = 'jsturtevant/rally';

// Timeout for dispatch operations
const DISPATCH_TIMEOUT = 90_000;

// ─── Module State ────────────────────────────────────────────────────────────

let fixture = null;

/**
 * Check if GitHub token is available
 */
export function hasGitHubToken() {
  return !!(process.env.GH_TOKEN || process.env.GITHUB_TOKEN);
}

/**
 * Get skip reason if token is not available
 */
export function getSkipReason() {
  if (!hasGitHubToken()) {
    return 'Skipping: GH_TOKEN not set (E2E tests require GitHub API access)';
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
 * Dispatch to issue #54 using the CLI command (faster than UI interaction)
 */
async function dispatchToIssue(rallyHome) {
  const result = spawnSync('node', [
    RALLY_BIN,
    'dispatch',
    'issue',
    `${E2E_REPO}#${E2E_ISSUE_NUMBER}`,
    '--no-launch',  // Don't launch copilot
  ], {
    env: { ...process.env, RALLY_HOME: rallyHome, NO_COLOR: '1' },
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: DISPATCH_TIMEOUT,
  });

  if (result.status !== 0) {
    throw new Error(`Dispatch failed: ${result.stderr || result.stdout}`);
  }

  // Read active.yaml to get dispatch details
  const activeYaml = yaml.load(
    readFileSync(path.join(rallyHome, 'active.yaml'), 'utf8'),
    { schema: yaml.CORE_SCHEMA }
  );

  if (!activeYaml.dispatches || activeYaml.dispatches.length === 0) {
    throw new Error('Dispatch succeeded but no dispatch found in active.yaml');
  }

  // Find the dispatch for issue 54
  const dispatch = activeYaml.dispatches.find(d => d.issue === E2E_ISSUE_NUMBER);
  if (!dispatch) {
    throw new Error(`Dispatch for issue #${E2E_ISSUE_NUMBER} not found in active.yaml`);
  }

  return dispatch;
}

/**
 * Setup the E2E dispatch fixture.
 * Creates isolated RALLY_HOME, dispatches to issue #54.
 * 
 * @param {object} testContext - Mocha/node:test context (for timeout extension)
 * @returns {Promise<void>}
 */
export async function setupDispatchFixture(testContext) {
  if (!hasGitHubToken()) {
    return; // Skip setup if no token
  }

  // Extend test timeout for setup
  if (testContext && testContext.timeout) {
    testContext.timeout(DISPATCH_TIMEOUT + 30_000);
  }

  const randomId = crypto.randomBytes(4).toString('hex');
  const tempDir = mkdtempSync(path.join(tmpdir(), `rally-e2e-${randomId}-`));
  
  seedConfig(tempDir, REPO_ROOT);

  // Dispatch to issue #54
  const dispatch = await dispatchToIssue(tempDir);

  fixture = {
    tempDir,
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
 * Start the dashboard and wait for it to be ready.
 * @returns {Promise<object>} Terminal handle
 */
export async function startDashboard(options = {}) {
  if (!fixture) {
    throw new Error('Fixture not initialized. Call setupDispatchFixture first.');
  }

  const term = await spawn(`node ${RALLY_BIN} dashboard`, {
    cols: options.cols || 120,
    rows: options.rows || 30,
    env: { 
      RALLY_HOME: fixture.tempDir, 
      NO_COLOR: '1',
      ...options.env,
    },
  });

  await term.waitFor('Rally Dashboard', { timeout: 15_000 });
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

  // Cleanup worktree and branch
  if (fixture.worktreePath || fixture.branchName) {
    cleanupWorktree(REPO_ROOT, fixture.worktreePath, fixture.branchName);
  }

  // Remove temp directory
  if (fixture.tempDir) {
    rmSync(fixture.tempDir, { recursive: true, force: true });
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
