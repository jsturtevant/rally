import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render } from 'ink-testing-library';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import Dashboard from '../../lib/ui/Dashboard.js';
import { withTempRallyHome } from '../helpers/temp-env.js';

let TEST_DIR;
let WORKTREE_DIR;

function setupTestEnv(t, dispatches = []) {
  TEST_DIR = withTempRallyHome(t);
  WORKTREE_DIR = join(TEST_DIR, 'worktree-check');
  mkdirSync(WORKTREE_DIR, { recursive: true });
  writeFileSync(join(TEST_DIR, 'active.yaml'), yaml.dump({ dispatches }), 'utf8');
}

function makeSampleDispatches(logFile) {
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
      logPath: logFile,
      created: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'd2',
      repo: 'owner/repo-b',
      type: 'pr',
      number: 7,
      branch: 'rally/7-review',
      status: 'done',
      worktreePath: '/nonexistent/path',
      session_id: 'def456',
      created: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
  ];
}

describe('Log view cycle — keyboard shortcut regression', { timeout: 30000 }, () => {
  let instance;
  const delay = () => new Promise(r => setImmediate(r));

  afterEach(() => {
    if (instance) {
      instance.unmount();
      instance.cleanup();
    }
  });

  it('shortcuts survive multiple l → Escape → l → Escape cycles', async (t) => {
    const logFile = join(TEST_DIR || '', 'cycle-log.txt');
    setupTestEnv(t, []);
    const dispatches = makeSampleDispatches(join(TEST_DIR, 'cycle-log.txt'));
    writeFileSync(join(TEST_DIR, 'cycle-log.txt'), 'log-line-1\nlog-line-2\n', 'utf8');
    writeFileSync(join(TEST_DIR, 'active.yaml'), yaml.dump({ dispatches }), 'utf8');

    instance = render(React.createElement(Dashboard, { refreshInterval: 0 }));
    await delay();

    // Verify we start on the dashboard
    assert.ok(instance.lastFrame().includes('Rally Dashboard'), 'should start on dashboard');

    // --- Cycle 1: l → log viewer → Escape → dashboard ---
    instance.stdin.write('l');
    await delay();
    assert.ok(instance.lastFrame().includes('Logs for'), 'cycle 1: should show log viewer');

    instance.stdin.write('\x1B');
    await delay();
    assert.ok(instance.lastFrame().includes('Rally Dashboard'), 'cycle 1: Escape should return to dashboard');

    // --- Cycle 2: l → log viewer → Escape → dashboard (this is where the bug hits) ---
    instance.stdin.write('l');
    await delay();
    assert.ok(instance.lastFrame().includes('Logs for'), 'cycle 2: should show log viewer');

    instance.stdin.write('\x1B');
    await delay();
    assert.ok(instance.lastFrame().includes('Rally Dashboard'), 'cycle 2: Escape should return to dashboard');

    // --- Verify shortcuts still work after cycle 2 ---
    instance.stdin.write('r');
    await delay();
    assert.ok(instance.lastFrame().includes('Rally Dashboard'), 'r (refresh) should keep dashboard visible after cycle 2');

    // --- Cycle 3: l → log viewer → Escape → dashboard ---
    instance.stdin.write('l');
    await delay();
    assert.ok(instance.lastFrame().includes('Logs for'), 'cycle 3: should show log viewer');

    instance.stdin.write('\x1B');
    await delay();
    assert.ok(instance.lastFrame().includes('Rally Dashboard'), 'cycle 3: Escape should return to dashboard');

    // --- Verify d (detail) shortcut still works ---
    instance.stdin.write('d');
    await delay();
    assert.ok(instance.lastFrame().includes('Details for'), 'detail view should work after 3 log-view cycles');
  });

  it('action menu View Logs → Escape preserves shortcuts', async (t) => {
    setupTestEnv(t, []);
    const dispatches = makeSampleDispatches(join(TEST_DIR, 'action-log.txt'));
    writeFileSync(join(TEST_DIR, 'action-log.txt'), 'action-log-content\n', 'utf8');
    writeFileSync(join(TEST_DIR, 'active.yaml'), yaml.dump({ dispatches }), 'utf8');

    instance = render(React.createElement(Dashboard, { refreshInterval: 0 }));
    await delay();
    assert.ok(instance.lastFrame().includes('Rally Dashboard'), 'should start on dashboard');

    // Open action menu
    instance.stdin.write('\r');
    await delay();

    // Navigate to "View logs" (4th item: Details, View in editor, Open terminal, View logs)
    instance.stdin.write('\x1B[B'); // down
    await delay();
    instance.stdin.write('\x1B[B'); // down
    await delay();
    instance.stdin.write('\x1B[B'); // down
    await delay();
    instance.stdin.write('\r');     // select View logs
    await delay();
    assert.ok(instance.lastFrame().includes('Logs for'), 'action menu should open log viewer');

    // Escape back to dashboard
    instance.stdin.write('\x1B');
    await delay();
    assert.ok(instance.lastFrame().includes('Rally Dashboard'), 'Escape from action-menu logs should return to dashboard');

    // Verify shortcuts still work
    instance.stdin.write('l');
    await delay();
    assert.ok(instance.lastFrame().includes('Logs for'), 'l shortcut should work after action-menu log flow');

    instance.stdin.write('\x1B');
    await delay();
    assert.ok(instance.lastFrame().includes('Rally Dashboard'), 'Escape should return to dashboard again');

    instance.stdin.write('d');
    await delay();
    assert.ok(instance.lastFrame().includes('Details for'), 'detail shortcut should work after action-menu log flow');
  });
});
