import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render } from 'ink-testing-library';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import yaml from 'js-yaml';
import Dashboard, { getDashboardData } from '../../lib/ui/Dashboard.js';
import { withTempRallyHome } from '../helpers/temp-env.js';

let TEST_DIR;
let WORKTREE_DIR;

function setupTestEnv(t, dispatches = []) {
  if (!TEST_DIR) {
    TEST_DIR = withTempRallyHome(t);
    WORKTREE_DIR = join(TEST_DIR, 'worktree-check');
  }
  mkdirSync(TEST_DIR, { recursive: true });
  const content = yaml.dump({ dispatches });
  writeFileSync(join(TEST_DIR, 'active.yaml'), content, 'utf8');
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
      status: 'implementing',
      worktreePath: '/another/nonexistent/path',
      session_id: 'ghi789',
      created: new Date(Date.now() - 7200000).toISOString(),
    },
  ];
}

function setupWithDispatches(t) {
  TEST_DIR = withTempRallyHome(t);
  WORKTREE_DIR = join(TEST_DIR, 'worktree-check');
  const dispatches = makeSampleDispatches();
  setupTestEnv(t, dispatches);
  mkdirSync(WORKTREE_DIR, { recursive: true });
}


describe('getDashboardData', () => {
  beforeEach((t) => {
    setupWithDispatches(t);
  });

  it('loads dispatches and adds health status', () => {
    const data = getDashboardData();
    assert.equal(data.dispatches.length, 3);
    // d1 has a real worktree dir
    assert.equal(data.dispatches[0].healthy, true);
    // d2 has a nonexistent path
    assert.equal(data.dispatches[1].healthy, false);
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

  it('returns empty when no dispatches exist', (t) => {
    setupTestEnv(t, []);
    const data = getDashboardData();
    assert.equal(data.dispatches.length, 0);
  });
});

describe('Dashboard component', () => {
  let instance;
  const delay = () => new Promise(r => setImmediate(r));

  beforeEach((t) => {
    setupWithDispatches(t);
  });

  afterEach(() => {
    if (instance) {
      instance.unmount();
      instance.cleanup();
    }
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
    assert.ok(output.includes('#42'), 'should show issue ref');
    assert.ok(output.includes('#7'), 'should show PR ref');
    assert.ok(output.includes('Issue'), 'should show Issue type');
    assert.ok(output.includes('PR'), 'should show PR type');
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
    writeFileSync(join(TEST_DIR, 'active.yaml'), yaml.dump({ dispatches: [] }), 'utf8');
    instance = render(React.createElement(Dashboard, { refreshInterval: 0 }));
    const output = instance.lastFrame();
    assert.ok(output.includes('No active dispatches'), 'should show empty state');
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
    assert.ok(output.includes('d details'), 'should show d shortcut hint');
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
    assert.ok(output.includes('#42'), 'should show dispatch issue ref');
    assert.ok(output.includes('(v) Open in VS Code'), 'should show VS Code option with shortcut hint');
    assert.ok(output.includes('Back'), 'should show Back option');
  });

  it('action menu shows View dispatch logs when logPath exists', async () => {
    const dispatches = makeSampleDispatches();
    dispatches[0].logPath = join(tmpdir(), 'test-log.txt');
    writeFileSync(join(TEST_DIR, 'active.yaml'), yaml.dump({ dispatches }), 'utf8');
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
    const logFile = join(TEST_DIR, 'test-log.txt');
    dispatches[0].logPath = logFile;
    writeFileSync(logFile, 'line1\nline2\nline3', 'utf8');
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
    assert.ok(output.includes('#42'), 'should show dispatch ref');
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

  it('d shortcut shows detail view for selected dispatch', async () => {
    instance = render(
      React.createElement(Dashboard, {
        refreshInterval: 0,
      })
    );
    await delay();
    instance.stdin.write('d');
    await delay();
    const output = instance.lastFrame();
    assert.ok(output.includes('Details for'), 'should show detail view title');
    assert.ok(output.includes('#42'), 'should show dispatch issue ref');
    assert.ok(output.includes('rally/42-fix-bug'), 'should show branch in detail view');
    assert.ok(output.includes('Esc back'), 'should show escape hint');
  });

  it('detail view Escape returns to dashboard', async () => {
    instance = render(
      React.createElement(Dashboard, { refreshInterval: 0 })
    );
    await delay();
    instance.stdin.write('d');
    await delay();
    assert.ok(instance.lastFrame().includes('Details for'), 'should show detail view');
    instance.stdin.write('\x1B');
    await delay();
    const output = instance.lastFrame();
    assert.ok(output.includes('Rally Dashboard'), 'Escape should return to dashboard');
  });

  it('x shortcut removes selected dispatch', async () => {
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
    instance.stdin.write('x');
    await delay();
    assert.ok(removeCalled, 'x shortcut should call dispatchRemove');
    assert.equal(removeNumber, 42, 'should pass dispatch number');
  });

  it('action menu View logs opens inline log viewer', async () => {
    const dispatches = makeSampleDispatches();
    const logFile = join(TEST_DIR, 'test-log.txt');
    dispatches[0].logPath = logFile;
    writeFileSync(logFile, 'action-log-line', 'utf8');
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
    instance.stdin.write('\x1B[B');
    await delay();
    instance.stdin.write('\x1B[B');
    await delay();
    instance.stdin.write('\r');
    await delay();
    const output = instance.lastFrame();
    assert.ok(output.includes('Logs for'), 'should show log viewer');
    assert.ok(output.includes('#42'), 'should show dispatch ref');
  });

  it('log viewer Escape returns to dashboard', async () => {
    const dispatches = makeSampleDispatches();
    const logFile = join(TEST_DIR, 'test-log.txt');
    dispatches[0].logPath = logFile;
    writeFileSync(logFile, 'escape-test-log', 'utf8');
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
    instance = render(
      React.createElement(Dashboard, {
        refreshInterval: 0,
      })
    );
    await delay();
    instance.stdin.write('d');
    await delay();
    const output = instance.lastFrame();
    assert.ok(output.includes('Details for'), 'detail view should be visible after d');
  });

  it('x shortcut does not quit the dashboard', async () => {
    let removeCalled = false;
    const mockDispatchRemove = async (number) => { removeCalled = true; };

    instance = render(
      React.createElement(Dashboard, {
        refreshInterval: 0,
        _dispatchRemove: mockDispatchRemove,
      })
    );
    await delay();
    instance.stdin.write('x');
    await delay();
    assert.ok(removeCalled, 'x should call dispatchRemove');
    const output = instance.lastFrame();
    assert.ok(output.includes('Rally Dashboard'), 'dashboard should still be visible after x');
  });

  it('c shortcut spawns both code and gh copilot when session is a UUID', async () => {
    const dispatches = makeSampleDispatches();
    dispatches[0].session_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    writeFileSync(join(TEST_DIR, 'active.yaml'), yaml.dump({ dispatches }), 'utf8');

    const spawnedCmds = [];
    const spawnMock = (cmd, args, opts) => {
      spawnedCmds.push({ cmd, args });
      return { unref: () => {}, on: () => {} };
    };

    instance = render(
      React.createElement(Dashboard, { refreshInterval: 0, _spawn: spawnMock })
    );
    await delay();
    instance.stdin.write('c');
    await delay();
    assert.equal(spawnedCmds.length, 2, 'should spawn two processes');
    assert.equal(spawnedCmds[0].cmd, 'code', 'first spawn should be VS Code');
    assert.equal(spawnedCmds[1].cmd, 'gh', 'second spawn should be gh');
    assert.ok(spawnedCmds[1].args.includes('copilot'), 'should include copilot arg');
    assert.ok(spawnedCmds[1].args.includes('--resume'), 'should include --resume arg');
    assert.ok(spawnedCmds[1].args.includes('a1b2c3d4-e5f6-7890-abcd-ef1234567890'), 'should include session ID');
  });

  it('c shortcut does nothing when session is not a UUID', async () => {
    const dispatches = makeSampleDispatches();
    dispatches[0].session_id = '12345'; // PID, not UUID
    writeFileSync(join(TEST_DIR, 'active.yaml'), yaml.dump({ dispatches }), 'utf8');

    let spawnCalled = false;
    const spawnMock = () => {
      spawnCalled = true;
      return { unref: () => {}, on: () => {} };
    };

    instance = render(
      React.createElement(Dashboard, { refreshInterval: 0, _spawn: spawnMock })
    );
    await delay();
    instance.stdin.write('c');
    await delay();
    assert.ok(!spawnCalled, 'should not spawn when session is a PID');
  });

  it('action menu shows Connect IDE only when session is a UUID', async () => {
    const dispatches = makeSampleDispatches();
    dispatches[0].session_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    writeFileSync(join(TEST_DIR, 'active.yaml'), yaml.dump({ dispatches }), 'utf8');

    instance = render(
      React.createElement(Dashboard, { refreshInterval: 0 })
    );
    await delay();
    instance.stdin.write('\r');
    await delay();
    const output = instance.lastFrame();
    assert.ok(output.includes('Connect IDE session'), 'should show Connect IDE for UUID session');
  });

  it('action menu hides Connect IDE when session is not a UUID', async () => {
    const dispatches = makeSampleDispatches();
    dispatches[0].session_id = 'not-a-uuid';
    writeFileSync(join(TEST_DIR, 'active.yaml'), yaml.dump({ dispatches }), 'utf8');

    instance = render(
      React.createElement(Dashboard, { refreshInterval: 0 })
    );
    await delay();
    instance.stdin.write('\r');
    await delay();
    const output = instance.lastFrame();
    assert.ok(!output.includes('Connect IDE session'), 'should not show Connect IDE for non-UUID session');
  });

  it('p shortcut marks reviewing dispatch as pushed', async () => {
    const dispatches = makeSampleDispatches();
    dispatches[0].status = 'reviewing';
    writeFileSync(join(TEST_DIR, 'active.yaml'), yaml.dump({ dispatches }), 'utf8');

    let updatedId;
    let updatedStatus;
    const mockUpdateStatus = (id, status) => {
      updatedId = id;
      updatedStatus = status;
      return { id, status };
    };

    instance = render(
      React.createElement(Dashboard, {
        refreshInterval: 0,
        _updateDispatchStatus: mockUpdateStatus,
      })
    );
    await delay();
    instance.stdin.write('p');
    await delay();
    assert.equal(updatedId, 'd1', 'should update the selected dispatch');
    assert.equal(updatedStatus, 'waiting', 'should set status to pushed');
  });

  it('p shortcut does nothing when dispatch is not reviewing', async () => {
    let updateCalled = false;
    const mockUpdateStatus = () => { updateCalled = true; return {}; };

    instance = render(
      React.createElement(Dashboard, {
        refreshInterval: 0,
        _updateDispatchStatus: mockUpdateStatus,
      })
    );
    await delay();
    instance.stdin.write('p');
    await delay();
    assert.ok(!updateCalled, 'p shortcut should not update non-reviewing dispatch');
  });

  it('help text includes p pushed shortcut', () => {
    instance = render(React.createElement(Dashboard, { refreshInterval: 0 }));
    const output = instance.lastFrame();
    assert.ok(output.includes('p pushed'), 'should show p pushed shortcut hint');
  });

  it('help text includes a attach shortcut', () => {
    instance = render(React.createElement(Dashboard, { refreshInterval: 0 }));
    const output = instance.lastFrame();
    assert.ok(output.includes('a attach'), 'should show a attach shortcut hint');
  });

  it('action menu shows Attach to session when dispatch has worktreePath', async () => {
    instance = render(
      React.createElement(Dashboard, { refreshInterval: 0 })
    );
    await delay();
    instance.stdin.write('\r');
    await delay();
    const output = instance.lastFrame();
    assert.ok(output.includes('(a) Attach to session'), 'should show Attach option when worktreePath exists');
  });

  it('action menu hides Attach to session when no worktreePath', async () => {
    const dispatches = makeSampleDispatches();
    dispatches[0].worktreePath = '';
    writeFileSync(join(TEST_DIR, 'active.yaml'), yaml.dump({ dispatches }), 'utf8');

    instance = render(
      React.createElement(Dashboard, { refreshInterval: 0 })
    );
    await delay();
    instance.stdin.write('\r');
    await delay();
    const output = instance.lastFrame();
    assert.ok(!output.includes('(a) Attach to session'), 'should not show Attach when no worktreePath');
  });

  it('a shortcut calls onAttachSession with selected dispatch', async () => {
    let attachedDispatch = null;
    const onAttachSession = (dispatch) => { attachedDispatch = dispatch; };

    instance = render(
      React.createElement(Dashboard, {
        refreshInterval: 0,
        onAttachSession,
      })
    );
    await delay();
    instance.stdin.write('a');
    await delay();
    assert.ok(attachedDispatch, 'a shortcut should call onAttachSession');
    assert.equal(attachedDispatch.number, 42, 'should pass the selected dispatch');
    assert.equal(attachedDispatch.worktreePath, WORKTREE_DIR, 'should include worktreePath');
  });

  it('a shortcut does nothing when dispatch has no worktreePath', async () => {
    const dispatches = makeSampleDispatches();
    dispatches[0].worktreePath = '';
    writeFileSync(join(TEST_DIR, 'active.yaml'), yaml.dump({ dispatches }), 'utf8');

    let attachCalled = false;
    const onAttachSession = () => { attachCalled = true; };

    instance = render(
      React.createElement(Dashboard, {
        refreshInterval: 0,
        onAttachSession,
      })
    );
    await delay();
    instance.stdin.write('a');
    await delay();
    assert.ok(!attachCalled, 'a shortcut should not trigger when no worktreePath');
  });

  it('action menu Attach to session calls onAttachSession via shortcut', async () => {
    let attachedDispatch = null;
    const onAttachSession = (dispatch) => { attachedDispatch = dispatch; };

    instance = render(
      React.createElement(Dashboard, {
        refreshInterval: 0,
        onAttachSession,
      })
    );
    await delay();
    instance.stdin.write('\r');
    await delay();
    instance.stdin.write('a');
    await delay();
    assert.ok(attachedDispatch, 'action menu a shortcut should call onAttachSession');
    assert.equal(attachedDispatch.number, 42, 'should pass dispatch number');
  });

  it('help text includes n new dispatch shortcut', () => {
    instance = render(React.createElement(Dashboard, { refreshInterval: 0 }));
    const output = instance.lastFrame();
    // Strip ANSI codes and collapse wrapped lines so the assertion
    // is immune to terminal-width line wrapping.
    const plain = output.replace(/\u001b\[[0-9;]*m/g, '').replace(/\n\s*/g, ' ');
    assert.ok(plain.includes('n new dispatch'), 'should show n new dispatch shortcut hint');
  });

  it('help text includes o browser shortcut', () => {
    instance = render(React.createElement(Dashboard, { refreshInterval: 0 }));
    const output = instance.lastFrame();
    const plain = output.replace(/\u001b\[[0-9;]*m/g, '').replace(/\n\s*/g, ' ');
    assert.ok(plain.includes('o browser'), 'should show o browser shortcut hint');
  });

  it('o shortcut opens issue in browser via gh cli', async () => {
    let spawnArgs;
    const spawnMock = (cmd, args, opts) => {
      spawnArgs = { cmd, args };
      return { unref: () => {}, on: () => {} };
    };

    instance = render(
      React.createElement(Dashboard, { refreshInterval: 0, _spawn: spawnMock })
    );
    await delay();
    instance.stdin.write('o');
    await delay();
    assert.ok(spawnArgs, 'o shortcut should spawn gh');
    assert.equal(spawnArgs.cmd, 'gh');
    assert.deepEqual(spawnArgs.args, ['issue', 'view', '42', '--repo', 'owner/repo-a', '--web']);
  });

  it('o shortcut opens PR in browser via gh cli', async () => {
    const dispatches = makeSampleDispatches();
    writeFileSync(join(TEST_DIR, 'active.yaml'), yaml.dump({ dispatches }), 'utf8');

    let spawnArgs;
    const spawnMock = (cmd, args, opts) => {
      spawnArgs = { cmd, args };
      return { unref: () => {}, on: () => {} };
    };

    instance = render(
      React.createElement(Dashboard, { refreshInterval: 0, _spawn: spawnMock })
    );
    await delay();
    // Navigate down to the PR dispatch (index 1)
    instance.stdin.write('\x1B[B');
    await delay();
    instance.stdin.write('o');
    await delay();
    assert.ok(spawnArgs, 'o shortcut should spawn gh for PR');
    assert.equal(spawnArgs.cmd, 'gh');
    assert.deepEqual(spawnArgs.args, ['pr', 'view', '7', '--repo', 'owner/repo-b', '--web']);
  });

  it('o shortcut does not quit the dashboard', async () => {
    const spawnMock = (cmd, args, opts) => {
      return { unref: () => {}, on: () => {} };
    };

    instance = render(
      React.createElement(Dashboard, { refreshInterval: 0, _spawn: spawnMock })
    );
    await delay();
    instance.stdin.write('o');
    await delay();
    const output = instance.lastFrame();
    assert.ok(output.includes('Rally Dashboard'), 'dashboard should still be visible after o');
  });

  it('action menu shows Open in browser option', async () => {
    instance = render(
      React.createElement(Dashboard, { refreshInterval: 0 })
    );
    await delay();
    instance.stdin.write('\r');
    await delay();
    const output = instance.lastFrame();
    assert.ok(output.includes('(o) Open in browser'), 'should show Open in browser option');
  });

  it('action menu o shortcut opens in browser', async () => {
    let spawnArgs;
    const spawnMock = (cmd, args, opts) => {
      spawnArgs = { cmd, args };
      return { unref: () => {}, on: () => {} };
    };

    instance = render(
      React.createElement(Dashboard, { refreshInterval: 0, _spawn: spawnMock })
    );
    await delay();
    instance.stdin.write('\r');
    await delay();
    instance.stdin.write('o');
    await delay();
    assert.ok(spawnArgs, 'action menu o shortcut should spawn gh');
    assert.equal(spawnArgs.cmd, 'gh');
    assert.deepEqual(spawnArgs.args, ['issue', 'view', '42', '--repo', 'owner/repo-a', '--web']);
  });

  it('n shortcut opens project browser', async () => {
    instance = render(
      React.createElement(Dashboard, {
        refreshInterval: 0,
        _listOnboardedRepos: () => [
          { repo: 'owner/repo-x', name: 'repo-x', path: '/home/user/repo-x' },
        ],
      })
    );
    await delay();
    instance.stdin.write('n');
    await delay();
    const output = instance.lastFrame();
    assert.ok(output.includes('Select a Project'), 'n shortcut should open project browser');
    assert.ok(output.includes('owner/repo-x'), 'should show onboarded project');
  });
});
