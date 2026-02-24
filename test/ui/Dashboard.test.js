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
  const delay = () => new Promise(r => setImmediate(r));

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
    assert.ok(output.includes('Enter actions'), 'should show Enter actions hint');
    assert.ok(output.includes('v open'), 'should show v shortcut hint');
    assert.ok(output.includes('l logs'), 'should show l shortcut hint');
    assert.ok(output.includes('owner/repo-a'), 'should render dispatches');
  });

  it('shows action menu on Enter instead of opening VS Code', async () => {
    instance = render(
      React.createElement(Dashboard, { refreshInterval: 0 })
    );
    await delay();
    instance.stdin.write('\r');
    await delay();
    const output = instance.lastFrame();
    assert.ok(output.includes('Actions for'), 'should show action menu title');
    assert.ok(output.includes('Issue #42'), 'should show dispatch issue ref');
    assert.ok(output.includes('(v) Open in VS Code'), 'should show VS Code option with shortcut hint');
    assert.ok(output.includes('Back'), 'should show Back option');
  });

  it('action menu shows View dispatch logs when logPath exists', async () => {
    const dispatches = makeSampleDispatches();
    dispatches[0].logPath = '/tmp/test-log.txt';
    setupTestEnv(dispatches);
    mkdirSync(WORKTREE_DIR, { recursive: true });

    instance = render(
      React.createElement(Dashboard, { refreshInterval: 0 })
    );
    await delay();
    instance.stdin.write('\r');
    await delay();
    const output = instance.lastFrame();
    assert.ok(output.includes('(l) View dispatch logs'), 'should show View logs option with shortcut hint when logPath exists');
  });

  it('action menu hides View dispatch logs when no logPath', async () => {
    instance = render(
      React.createElement(Dashboard, { refreshInterval: 0 })
    );
    await delay();
    instance.stdin.write('\r');
    await delay();
    const output = instance.lastFrame();
    assert.ok(!output.includes('(l) View dispatch logs'), 'should not show View logs when no logPath');
  });

  it('action menu Back returns to dispatch list', async () => {
    instance = render(
      React.createElement(Dashboard, { refreshInterval: 0 })
    );
    await delay();
    instance.stdin.write('\r');
    await delay();
    assert.ok(instance.lastFrame().includes('Actions for'), 'should show action menu');
    instance.stdin.write('\x1B');
    await delay();
    const output = instance.lastFrame();
    assert.ok(output.includes('Rally Dashboard'), 'should return to dashboard');
  });

  it('action menu Open in VS Code spawns code', async () => {
    let spawnCalled = false;
    const spawnMock = (cmd, args) => {
      spawnCalled = true;
      assert.equal(cmd, 'code');
      return { unref: () => {}, on: () => {} };
    };

    instance = render(
      React.createElement(Dashboard, { refreshInterval: 0, _spawn: spawnMock })
    );
    await delay();
    instance.stdin.write('\r');
    await delay();
    assert.ok(instance.lastFrame().includes('(v) Open in VS Code'), 'should show VS Code option');
    instance.stdin.write('\r');
    await delay();
    assert.ok(spawnCalled, 'should have called spawn');
  });

  it('v shortcut opens VS Code for selected dispatch', async () => {
    let spawnCalled = false;
    let spawnArgs;
    const spawnMock = (cmd, args) => {
      spawnCalled = true;
      spawnArgs = { cmd, args };
      return { unref: () => {}, on: () => {} };
    };

    instance = render(
      React.createElement(Dashboard, { refreshInterval: 0, _spawn: spawnMock })
    );
    await delay();
    instance.stdin.write('v');
    await delay();
    assert.ok(spawnCalled, 'v shortcut should spawn VS Code');
    assert.equal(spawnArgs.cmd, 'code');
  });

  it('l shortcut shows inline log viewer for selected dispatch with logPath', async () => {
    const dispatches = makeSampleDispatches();
    dispatches[0].logPath = '/tmp/test-log.txt';
    writeFileSync(dispatches[0].logPath, 'line1\nline2\nline3', 'utf8');
    writeFileSync(join(TEST_DIR, 'active.yaml'), yaml.dump({ dispatches }), 'utf8');

    instance = render(
      React.createElement(Dashboard, {
        refreshInterval: 0,
      })
    );
    await delay();
    instance.stdin.write('l');
    await delay();
    const output = instance.lastFrame();
    assert.ok(output.includes('Logs for'), 'should show log viewer title');
    assert.ok(output.includes('Issue #42'), 'should show dispatch ref');
    assert.ok(output.includes('Esc back'), 'should show escape hint');
  });

  it('l shortcut does nothing when no logPath', async () => {
    let logCalled = false;
    const mockDispatchLog = async () => { logCalled = true; };

    instance = render(
      React.createElement(Dashboard, {
        refreshInterval: 0,
        _dispatchLog: mockDispatchLog,
      })
    );
    await delay();
    instance.stdin.write('l');
    await delay();
    assert.ok(!logCalled, 'l shortcut should not call dispatchLog without logPath');
    assert.ok(instance.lastFrame().includes('Rally Dashboard'), 'should stay on dashboard');
  });

  it('d shortcut removes selected dispatch', async () => {
    let removeCalled = false;
    let removeNumber;
    const mockDispatchRemove = async (number, opts) => {
      removeCalled = true;
      removeNumber = number;
    };

    instance = render(
      React.createElement(Dashboard, {
        refreshInterval: 0,
        _dispatchRemove: mockDispatchRemove,
      })
    );
    await delay();
    instance.stdin.write('d');
    await delay();
    assert.ok(removeCalled, 'd shortcut should call dispatchRemove');
    assert.equal(removeNumber, 42, 'should pass dispatch number');
  });

  it('action menu View logs opens inline log viewer', async () => {
    const dispatches = makeSampleDispatches();
    dispatches[0].logPath = '/tmp/test-log.txt';
    writeFileSync(dispatches[0].logPath, 'action-log-line', 'utf8');
    writeFileSync(join(TEST_DIR, 'active.yaml'), yaml.dump({ dispatches }), 'utf8');

    instance = render(
      React.createElement(Dashboard, {
        refreshInterval: 0,
      })
    );
    await delay();
    instance.stdin.write('\r');
    await delay();
    instance.stdin.write('\x1B[B');
    await delay();
    instance.stdin.write('\r');
    await delay();
    const output = instance.lastFrame();
    assert.ok(output.includes('Logs for'), 'should show log viewer');
    assert.ok(output.includes('Issue #42'), 'should show dispatch ref');
  });

  it('log viewer Escape returns to dashboard', async () => {
    const dispatches = makeSampleDispatches();
    dispatches[0].logPath = '/tmp/test-log.txt';
    writeFileSync(dispatches[0].logPath, 'escape-test-log', 'utf8');
    writeFileSync(join(TEST_DIR, 'active.yaml'), yaml.dump({ dispatches }), 'utf8');

    instance = render(
      React.createElement(Dashboard, { refreshInterval: 0 })
    );
    await delay();
    instance.stdin.write('l');
    await delay();
    assert.ok(instance.lastFrame().includes('Logs for'), 'should show log viewer');
    instance.stdin.write('\x1B');
    await delay();
    const output = instance.lastFrame();
    assert.ok(output.includes('Rally Dashboard'), 'Escape should return to dashboard');
  });

  it('v shortcut does not quit the dashboard', async () => {
    let spawnCalled = false;
    const spawnMock = (cmd, args) => {
      spawnCalled = true;
      return { unref: () => {}, on: () => {} };
    };

    instance = render(
      React.createElement(Dashboard, { refreshInterval: 0, _spawn: spawnMock })
    );
    await delay();
    instance.stdin.write('v');
    await delay();
    assert.ok(spawnCalled, 'should have called spawn');
    const output = instance.lastFrame();
    assert.ok(output.includes('Rally Dashboard'), 'dashboard should still be visible after v');
  });

  it('d shortcut does not quit the dashboard', async () => {
    let removeCalled = false;
    const mockDispatchRemove = async (number) => { removeCalled = true; };

    instance = render(
      React.createElement(Dashboard, {
        refreshInterval: 0,
        _dispatchRemove: mockDispatchRemove,
      })
    );
    await delay();
    instance.stdin.write('d');
    await delay();
    assert.ok(removeCalled, 'd should call dispatchRemove');
    const output = instance.lastFrame();
    assert.ok(output.includes('Rally Dashboard'), 'dashboard should still be visible after d');
  });
});
