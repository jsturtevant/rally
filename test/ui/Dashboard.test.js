import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render } from 'ink-testing-library';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import yaml from 'js-yaml';
import Dashboard, { getDashboardData, computeSummary } from '../../lib/ui/Dashboard.js';

let TEST_DIR;
let WORKTREE_DIR;
let originalRallyHome;

function setupTestEnv(dispatches = []) {
  originalRallyHome = process.env.RALLY_HOME;
  if (!TEST_DIR) {
    TEST_DIR = join(tmpdir(), `rally-dashboard-test-${process.pid}-${Date.now()}`);
    WORKTREE_DIR = join(TEST_DIR, 'worktree-check');
  }
  mkdirSync(TEST_DIR, { recursive: true });
  const content = yaml.dump({ dispatches });
  writeFileSync(join(TEST_DIR, 'active.yaml'), content, 'utf8');
  process.env.RALLY_HOME = TEST_DIR;
}

function teardownTestEnv() {
  if (originalRallyHome !== undefined) {
    process.env.RALLY_HOME = originalRallyHome;
  } else {
    delete process.env.RALLY_HOME;
  }
  if (TEST_DIR) {
    rmSync(TEST_DIR, { recursive: true, force: true });
    TEST_DIR = null;
    WORKTREE_DIR = null;
  }
}

function makeSampleDispatches() {
  return [
    {
      id: 'd1',
      repo: 'owner/repo-a',
      type: 'issue',
      number: 42,
      branch: 'rally/42-fix-bug',
      status: 'implementing',
      worktreePath: WORKTREE_DIR,
      session_id: 'abc123',
      created: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'd2',
      repo: 'owner/repo-b',
      type: 'pr',
      number: 7,
      branch: 'rally/7-review',
      status: 'done',
      worktreePath: '/nonexistent/path/that/does/not/exist',
      session_id: 'def456',
      created: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: 'd3',
      repo: 'owner/repo-a',
      type: 'issue',
      number: 10,
      branch: 'rally/10-feat',
      status: 'planning',
      worktreePath: '/another/nonexistent/path',
      session_id: 'ghi789',
      created: new Date(Date.now() - 7200000).toISOString(),
    },
  ];
}

function setupWithDispatches() {
  TEST_DIR = join(tmpdir(), `rally-dashboard-test-${process.pid}-${Date.now()}`);
  WORKTREE_DIR = join(TEST_DIR, 'worktree-check');
  const dispatches = makeSampleDispatches();
  setupTestEnv(dispatches);
  mkdirSync(WORKTREE_DIR, { recursive: true });
}

describe('computeSummary', () => {
  it('counts active, done, and orphaned dispatches', () => {
    const dispatches = [
      { status: 'implementing', healthy: true },
      { status: 'done', healthy: true },
      { status: 'cleaned', healthy: false },
      { status: 'planning', healthy: false },
    ];
    const summary = computeSummary(dispatches);
    assert.equal(summary.active, 1);
    assert.equal(summary.done, 2);
    assert.equal(summary.orphaned, 1);
  });

  it('returns zeros for empty array', () => {
    const summary = computeSummary([]);
    assert.equal(summary.active, 0);
    assert.equal(summary.done, 0);
    assert.equal(summary.orphaned, 0);
  });
});

describe('getDashboardData', () => {
  beforeEach(() => {
    setupWithDispatches();
  });

  afterEach(() => {
    teardownTestEnv();
  });

  it('loads dispatches and adds health status', () => {
    const data = getDashboardData();
    assert.equal(data.dispatches.length, 3);
    // d1 has a real worktree dir
    assert.equal(data.dispatches[0].healthy, true);
    // d2 has a nonexistent path
    assert.equal(data.dispatches[1].healthy, false);
  });

  it('computes summary from dispatches', () => {
    const data = getDashboardData();
    assert.equal(typeof data.summary.active, 'number');
    assert.equal(typeof data.summary.done, 'number');
    assert.equal(typeof data.summary.orphaned, 'number');
    // d1=implementing+healthy → active, d2=done → done, d3=planning+unhealthy → orphaned
    assert.equal(data.summary.active, 1);
    assert.equal(data.summary.done, 1);
    assert.equal(data.summary.orphaned, 1);
  });

  it('filters by project name', () => {
    const data = getDashboardData({ project: 'repo-b' });
    assert.equal(data.dispatches.length, 1);
    assert.equal(data.dispatches[0].repo, 'owner/repo-b');
  });

  it('returns all dispatches when project is not set', () => {
    const data = getDashboardData();
    assert.equal(data.dispatches.length, 3);
  });

  it('returns empty when no dispatches exist', () => {
    setupTestEnv([]);
    const data = getDashboardData();
    assert.equal(data.dispatches.length, 0);
    assert.deepEqual(data.summary, { active: 0, done: 0, orphaned: 0 });
  });
});

describe('Dashboard component', () => {
  let instance;

  beforeEach(() => {
    setupWithDispatches();
  });

  afterEach(() => {
    if (instance) instance.unmount();
    teardownTestEnv();
  });

  it('renders the dashboard title', () => {
    instance = render(React.createElement(Dashboard, { refreshInterval: 0 }));
    const output = instance.lastFrame();
    assert.ok(output.includes('Rally Dashboard'), 'should show dashboard title');
  });

  it('renders dispatch table with data', () => {
    instance = render(React.createElement(Dashboard, { refreshInterval: 0 }));
    const output = instance.lastFrame();
    assert.ok(output.includes('owner/repo-a'), 'should show repo name');
    assert.ok(output.includes('Issue #42'), 'should show issue ref');
    assert.ok(output.includes('PR #7'), 'should show PR ref');
  });

  it('renders summary line', () => {
    instance = render(React.createElement(Dashboard, { refreshInterval: 0 }));
    const output = instance.lastFrame();
    assert.ok(output.includes('1 active'), 'should show active count');
    assert.ok(output.includes('1 done'), 'should show done count');
    assert.ok(output.includes('1 orphaned'), 'should show orphaned count');
  });

  it('filters by project prop', () => {
    instance = render(
      React.createElement(Dashboard, { project: 'repo-b', refreshInterval: 0 })
    );
    const output = instance.lastFrame();
    assert.ok(output.includes('owner/repo-b'), 'should show filtered repo');
    assert.ok(!output.includes('owner/repo-a'), 'should not show other repos');
  });

  it('renders empty state when no dispatches', () => {
    setupTestEnv([]);
    instance = render(React.createElement(Dashboard, { refreshInterval: 0 }));
    const output = instance.lastFrame();
    assert.ok(output.includes('No active dispatches'), 'should show empty state');
    assert.ok(output.includes('0 active'), 'should show zero active');
  });

  it('accepts _spawn prop for testability', () => {
    const spawnMock = (cmd, args, options) => {
      return {
        unref: () => {},
        on: () => {},
      };
    };
    
    instance = render(
      React.createElement(Dashboard, { refreshInterval: 0, _spawn: spawnMock })
    );
    
    const output = instance.lastFrame();
    assert.ok(output.includes('Enter select'), 'should show Enter select hint');
    assert.ok(output.includes('owner/repo-a'), 'should render dispatches');
  });
});
