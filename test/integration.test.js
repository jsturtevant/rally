import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, rmSync, existsSync, readFileSync,
  mkdirSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import yaml from 'js-yaml';

import { dispatchIssue } from '../lib/dispatch-issue.js';
import { dispatchPr } from '../lib/dispatch-pr.js';
import { getActiveDispatches, removeDispatch } from '../lib/active.js';
import { getDashboardData, computeSummary, renderPlainDashboard } from '../lib/ui/dashboard-data.js';

// =====================================================
// Helpers
// =====================================================

let tempDir;
let repoPath;
let originalEnv;

function createTestRepo() {
  tempDir = mkdtempSync(join(tmpdir(), 'rally-integration-'));
  repoPath = join(tempDir, 'repo');
  originalEnv = process.env.RALLY_HOME;
  process.env.RALLY_HOME = join(tempDir, 'rally-home');

  mkdirSync(repoPath, { recursive: true });
  execFileSync('git', ['init'], { cwd: repoPath, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: repoPath, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: repoPath, stdio: 'ignore' });
  writeFileSync(join(repoPath, 'README.md'), '# Test');
  execFileSync('git', ['add', '.'], { cwd: repoPath, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'Initial commit'], { cwd: repoPath, stdio: 'ignore' });

  // Create .squad dir so symlink succeeds
  mkdirSync(join(repoPath, '.squad'), { recursive: true });
  writeFileSync(join(repoPath, '.squad', 'agents.yaml'), 'agents: []');
}

function setupRallyHome() {
  const rallyHome = process.env.RALLY_HOME;
  mkdirSync(rallyHome, { recursive: true });
  writeFileSync(join(rallyHome, 'config.yaml'), yaml.dump({ version: '0.1.0' }), 'utf8');
  writeFileSync(join(rallyHome, 'projects.yaml'), yaml.dump({
    projects: [{ name: 'repo', path: repoPath, team: 'shared', onboarded: new Date().toISOString() }],
  }), 'utf8');
  return rallyHome;
}

function cleanup() {
  if (originalEnv !== undefined) {
    process.env.RALLY_HOME = originalEnv;
  } else {
    delete process.env.RALLY_HOME;
  }
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function makeIssue(overrides = {}) {
  return {
    title: 'Add login form',
    body: 'Implement a login form with email and password.',
    labels: [{ name: 'enhancement' }],
    assignees: [{ login: 'alice' }],
    ...overrides,
  };
}

function makePr(overrides = {}) {
  return {
    title: 'Fix login validation',
    body: 'Fixes the login validation bug.',
    headRefName: 'fix/login',
    baseRefName: 'main',
    state: 'OPEN',
    files: [
      { path: 'src/login.js', additions: 10, deletions: 3 },
    ],
    ...overrides,
  };
}

function createExecWithIssue(issueData) {
  return (cmd, args, opts) => {
    if (cmd === 'gh' && args[0] === 'issue' && args[1] === 'view') {
      if (!issueData) {
        throw new Error('Could not resolve to an Issue with the number of 999');
      }
      return JSON.stringify(issueData);
    }
    return execFileSync(cmd, args, opts);
  };
}

function createExecWithPr(prData) {
  return (cmd, args, opts) => {
    if (cmd === 'gh' && args[0] === 'pr' && args[1] === 'view') {
      if (!prData) {
        throw new Error('Could not resolve to a PullRequest with the number of 999');
      }
      return JSON.stringify(prData);
    }
    // Simulate refs/pull/N/head fetch — in tests, fetch the PR branch directly
    if (cmd === 'git' && args.includes('fetch') && args.some(a => a.startsWith('refs/pull/'))) {
      const cFlag = args.indexOf('-C');
      const cwd = cFlag >= 0 ? args[cFlag + 1] : opts?.cwd;
      return execFileSync('git', ['-C', cwd, 'fetch', 'origin', prData?.headRefName || 'main'], opts);
    }
    return execFileSync(cmd, args, opts);
  };
}

function noopSpawn() {
  // Use current process PID so refreshDispatchStatuses considers it alive
  return { pid: process.pid, unref() {} };
}

// =====================================================
// Integration: Issue dispatch workflow
// =====================================================

describe('Integration: issue dispatch → dashboard → clean', () => {
  beforeEach(() => {
    createTestRepo();
    setupRallyHome();
  });
  afterEach(cleanup);

  test('full workflow: dispatch issue, verify dashboard, then clean', async () => {
    const issue = makeIssue();
    const exec = createExecWithIssue(issue);

    // 1. Dispatch the issue
    const result = await dispatchIssue({
      issueNumber: 42,
      repo: 'owner/repo',
      repoPath,
      _exec: exec,
      _spawn: noopSpawn,
    });

    // Verify dispatch result
    assert.strictEqual(result.branch, 'rally/42-add-login-form');
    assert.ok(existsSync(result.worktreePath), 'worktree should exist');
    assert.strictEqual(result.dispatchId, 'repo-issue-42');

    // Verify dispatch-context.md written
    const contextPath = join(result.worktreePath, '.squad', 'dispatch-context.md');
    assert.ok(existsSync(contextPath), 'dispatch-context.md should exist');
    const ctx = readFileSync(contextPath, 'utf8');
    assert.ok(ctx.includes('#42'));
    assert.ok(ctx.includes('Add login form'));

    // Verify active.yaml updated
    const dispatches = getActiveDispatches();
    assert.strictEqual(dispatches.length, 1);
    assert.strictEqual(dispatches[0].id, 'repo-issue-42');
    assert.strictEqual(dispatches[0].status, 'planning');

    // 2. Verify dashboard sees the dispatch
    const dashData = getDashboardData();
    assert.strictEqual(dashData.dispatches.length, 1);
    assert.strictEqual(dashData.dispatches[0].id, 'repo-issue-42');
    assert.strictEqual(dashData.dispatches[0].healthy, true);
    assert.strictEqual(dashData.summary.active, 1);
    assert.strictEqual(dashData.summary.done, 0);

    // 3. Verify plain dashboard output
    const plain = renderPlainDashboard();
    assert.ok(plain.includes('Rally Dashboard'));
    assert.ok(plain.includes('owner/repo'));
    assert.ok(plain.includes('Issue #42'));
    assert.ok(plain.includes('1 active'));

    // 4. Clean: remove dispatch
    const removed = removeDispatch('repo-issue-42');
    assert.strictEqual(removed.id, 'repo-issue-42');

    // Verify dashboard is now empty
    const afterClean = getDashboardData();
    assert.strictEqual(afterClean.dispatches.length, 0);
    assert.strictEqual(afterClean.summary.active, 0);
  });
});

// =====================================================
// Integration: PR dispatch workflow
// =====================================================

describe('Integration: PR dispatch workflow', () => {
  beforeEach(() => {
    createTestRepo();
    setupRallyHome();

    // Create a PR head ref branch for fetch/checkout
    execFileSync('git', ['checkout', '-b', 'fix/login'], { cwd: repoPath, stdio: 'ignore' });
    writeFileSync(join(repoPath, 'pr-change.txt'), 'PR content');
    execFileSync('git', ['add', '.'], { cwd: repoPath, stdio: 'ignore' });
    execFileSync('git', ['commit', '-m', 'PR commit'], { cwd: repoPath, stdio: 'ignore' });
    execFileSync('git', ['checkout', '-'], { cwd: repoPath, stdio: 'ignore' });
    execFileSync('git', ['remote', 'add', 'origin', repoPath], { cwd: repoPath, stdio: 'ignore' });
  });
  afterEach(cleanup);

  test('dispatch PR, verify in dashboard, then clean', async () => {
    const pr = makePr();
    const exec = createExecWithPr(pr);

    const result = await dispatchPr({
      prNumber: 10,
      repo: 'owner/repo',
      repoPath,
      _exec: exec,
      _spawn: noopSpawn,
    });

    assert.strictEqual(result.branch, 'rally/pr-10-fix-login-validation');
    assert.ok(existsSync(result.worktreePath));
    assert.strictEqual(result.dispatchId, 'repo-pr-10');

    // Verify PR content in worktree
    assert.ok(existsSync(join(result.worktreePath, 'pr-change.txt')));

    // Verify dispatch-context.md has PR details
    const ctx = readFileSync(join(result.worktreePath, '.squad', 'dispatch-context.md'), 'utf8');
    assert.ok(ctx.includes('PR #10'));
    assert.ok(ctx.includes('Fix login validation'));

    // Verify dashboard
    const dashData = getDashboardData();
    assert.strictEqual(dashData.dispatches.length, 1);
    assert.strictEqual(dashData.dispatches[0].type, 'pr');
    assert.strictEqual(dashData.dispatches[0].status, 'reviewing');

    // Clean
    removeDispatch('repo-pr-10');
    assert.strictEqual(getActiveDispatches().length, 0);
  });
});

// =====================================================
// Integration: Error cases
// =====================================================

describe('Integration: error cases', () => {
  beforeEach(() => {
    createTestRepo();
  });
  afterEach(cleanup);

  test('dispatchIssue fails when not onboarded (no projects.yaml)', async () => {
    // Set up rally home WITHOUT projects.yaml
    const rallyHome = process.env.RALLY_HOME;
    mkdirSync(rallyHome, { recursive: true });
    writeFileSync(join(rallyHome, 'config.yaml'), yaml.dump({ version: '0.1.0' }), 'utf8');

    const exec = createExecWithIssue(makeIssue());
    await assert.rejects(
      () => dispatchIssue({
        issueNumber: 1,
        repo: 'owner/repo',
        repoPath,
        _exec: exec,
        _spawn: noopSpawn,
      }),
      (err) => {
        assert.ok(err.message.includes('not onboarded'));
        return true;
      }
    );
  });

  test('dispatchIssue fails when issue not found', async () => {
    setupRallyHome();
    const exec = createExecWithIssue(null);
    await assert.rejects(
      () => dispatchIssue({
        issueNumber: 999,
        repo: 'owner/repo',
        repoPath,
        _exec: exec,
        _spawn: noopSpawn,
      }),
      (err) => {
        assert.ok(err.message.includes('not found') || err.message.includes('999'));
        return true;
      }
    );
  });

  test('dispatchIssue returns idempotently when worktree already exists', async () => {
    setupRallyHome();
    const issue = makeIssue();
    const exec = createExecWithIssue(issue);

    // Create an actual git worktree so worktreeExists() returns true
    const wtPath = join(repoPath, '.worktrees', 'rally-42');
    execFileSync('git', ['worktree', 'add', wtPath, '-b', 'rally/42-test-issue'], { cwd: repoPath, stdio: 'ignore' });

    const result = await dispatchIssue({
      issueNumber: 42,
      repo: 'owner/repo',
      repoPath,
      _exec: exec,
      _spawn: noopSpawn,
    });

    assert.strictEqual(result.existing, true);
    assert.ok(result.worktreePath.includes('rally-42'));
    assert.strictEqual(result.sessionId, null);
  });

  test('dispatchPr fails when not onboarded', async () => {
    const rallyHome = process.env.RALLY_HOME;
    mkdirSync(rallyHome, { recursive: true });
    writeFileSync(join(rallyHome, 'config.yaml'), yaml.dump({ version: '0.1.0' }), 'utf8');

    const exec = createExecWithPr(makePr());
    await assert.rejects(
      () => dispatchPr({
        prNumber: 1,
        repo: 'owner/repo',
        repoPath,
        _exec: exec,
        _spawn: noopSpawn,
      }),
      (err) => {
        assert.ok(err.message.includes('not onboarded'));
        return true;
      }
    );
  });

  test('dispatchPr returns idempotently when worktree already exists', async () => {
    setupRallyHome();
    const exec = createExecWithPr(makePr());

    // Create an actual git worktree so worktreeExists() returns true
    const wtPath = join(repoPath, '.worktrees', 'rally-pr-42');
    execFileSync('git', ['worktree', 'add', wtPath, '-b', 'rally/pr-42-test-pr'], { cwd: repoPath, stdio: 'ignore' });

    const result = await dispatchPr({
      prNumber: 42,
      repo: 'owner/repo',
      repoPath,
      _exec: exec,
      _spawn: noopSpawn,
    });

    assert.strictEqual(result.existing, true);
    assert.ok(result.worktreePath.includes('rally-pr-42'));
    assert.strictEqual(result.sessionId, null);
  });
});

// =====================================================
// Integration: Dashboard rendering
// =====================================================

describe('Integration: dashboard data and rendering', () => {
  beforeEach(() => {
    createTestRepo();
    setupRallyHome();
  });
  afterEach(cleanup);

  test('getDashboardData returns correct structure with multiple dispatches', () => {
    const rallyHome = process.env.RALLY_HOME;
    const worktreeDir = join(tempDir, 'existing-worktree');
    mkdirSync(worktreeDir, { recursive: true });

    writeFileSync(join(rallyHome, 'active.yaml'), yaml.dump({
      dispatches: [
        {
          id: 'repo-issue-1',
          repo: 'owner/repo',
          number: 1,
          type: 'issue',
          branch: 'rally/1-feat',
          worktreePath: worktreeDir,
          status: 'implementing',
          session_id: 's1',
          created: new Date().toISOString(),
        },
        {
          id: 'repo-pr-2',
          repo: 'owner/repo',
          number: 2,
          type: 'pr',
          branch: 'rally/pr-2-fix',
          worktreePath: '/nonexistent/path',
          status: 'reviewing',
          session_id: 's2',
          created: new Date().toISOString(),
        },
        {
          id: 'repo-issue-3',
          repo: 'owner/repo',
          number: 3,
          type: 'issue',
          branch: 'rally/3-done',
          worktreePath: '/also/nonexistent',
          status: 'done',
          session_id: 's3',
          created: new Date().toISOString(),
        },
      ],
    }), 'utf8');

    const data = getDashboardData();
    assert.strictEqual(data.dispatches.length, 3);

    // Health checks
    assert.strictEqual(data.dispatches[0].healthy, true);
    assert.strictEqual(data.dispatches[1].healthy, false);
    assert.strictEqual(data.dispatches[2].healthy, false);

    // Summary: d1 = active (healthy+implementing), d2 = orphaned (unhealthy+reviewing), d3 = done
    assert.strictEqual(data.summary.active, 1);
    assert.strictEqual(data.summary.orphaned, 1);
    assert.strictEqual(data.summary.done, 1);
  });

  test('computeSummary counts statuses correctly', () => {
    const dispatches = [
      { status: 'planning', healthy: true },
      { status: 'implementing', healthy: true },
      { status: 'done', healthy: true },
      { status: 'cleaned', healthy: false },
      { status: 'reviewing', healthy: false },
    ];
    const summary = computeSummary(dispatches);
    assert.strictEqual(summary.active, 2);
    assert.strictEqual(summary.done, 2);
    assert.strictEqual(summary.orphaned, 1);
  });

  test('renderPlainDashboard outputs formatted text', () => {
    const rallyHome = process.env.RALLY_HOME;
    const worktreeDir = join(tempDir, 'wt-plain');
    mkdirSync(worktreeDir, { recursive: true });

    writeFileSync(join(rallyHome, 'active.yaml'), yaml.dump({
      dispatches: [
        {
          id: 'repo-issue-5',
          repo: 'owner/repo',
          number: 5,
          type: 'issue',
          branch: 'rally/5-feature',
          worktreePath: worktreeDir,
          status: 'planning',
          session_id: 's5',
          created: new Date().toISOString(),
        },
      ],
    }), 'utf8');

    const output = renderPlainDashboard();

    // Check structure
    assert.ok(output.includes('Rally Dashboard'), 'should include title');
    assert.ok(output.includes('Project'), 'should include headers');
    assert.ok(output.includes('Issue/PR'), 'should include headers');
    assert.ok(output.includes('owner/repo'), 'should include repo');
    assert.ok(output.includes('Issue #5'), 'should include issue ref');
    assert.ok(output.includes('rally/5-feature'), 'should include branch');
    assert.ok(output.includes('planning'), 'should include status');
    assert.ok(output.includes('1 active'), 'should include summary');

    // No ANSI codes
    assert.ok(!output.includes('\x1B['), 'should not contain ANSI codes');
  });

  test('renderPlainDashboard filters by project', () => {
    const rallyHome = process.env.RALLY_HOME;
    writeFileSync(join(rallyHome, 'active.yaml'), yaml.dump({
      dispatches: [
        {
          id: 'alpha-issue-1',
          repo: 'owner/alpha',
          number: 1,
          type: 'issue',
          branch: 'rally/1-a',
          worktreePath: '/nope',
          status: 'planning',
          session_id: 's1',
          created: new Date().toISOString(),
        },
        {
          id: 'beta-issue-2',
          repo: 'owner/beta',
          number: 2,
          type: 'issue',
          branch: 'rally/2-b',
          worktreePath: '/nope2',
          status: 'planning',
          session_id: 's2',
          created: new Date().toISOString(),
        },
      ],
    }), 'utf8');

    const output = renderPlainDashboard({ project: 'alpha' });
    assert.ok(output.includes('owner/alpha'));
    assert.ok(!output.includes('owner/beta'));
  });

  test('getDashboardData returns empty when no dispatches', () => {
    const data = getDashboardData();
    assert.strictEqual(data.dispatches.length, 0);
    assert.deepStrictEqual(data.summary, { active: 0, done: 0, orphaned: 0 });
  });
});

// =====================================================
// Integration: Multiple dispatches coexist
// =====================================================

describe('Integration: multiple dispatches', () => {
  beforeEach(() => {
    createTestRepo();
    setupRallyHome();
  });
  afterEach(cleanup);

  test('two issue dispatches show in dashboard together', async () => {
    const exec1 = createExecWithIssue(makeIssue({ title: 'First issue' }));
    const exec2 = createExecWithIssue(makeIssue({ title: 'Second issue' }));

    await dispatchIssue({
      issueNumber: 1,
      repo: 'owner/repo',
      repoPath,
      _exec: exec1,
      _spawn: noopSpawn,
    });

    await dispatchIssue({
      issueNumber: 2,
      repo: 'owner/repo',
      repoPath,
      _exec: exec2,
      _spawn: noopSpawn,
    });

    const dispatches = getActiveDispatches();
    assert.strictEqual(dispatches.length, 2);

    const data = getDashboardData();
    assert.strictEqual(data.dispatches.length, 2);
    assert.strictEqual(data.summary.active, 2);

    const plain = renderPlainDashboard();
    assert.ok(plain.includes('Issue #1'));
    assert.ok(plain.includes('Issue #2'));

    // Remove first, verify second remains
    removeDispatch('repo-issue-1');
    const afterRemove = getDashboardData();
    assert.strictEqual(afterRemove.dispatches.length, 1);
    assert.strictEqual(afterRemove.dispatches[0].id, 'repo-issue-2');
  });
});
