/**
 * E2E Journey Test: View Log Action Shortcut (Mock-based)
 * 
 * Tests the 'l' key to view copilot log output
 * and Escape to return to dashboard.
 * 
 * Uses isolated RALLY_HOME temp directory to avoid affecting user config.
 * For real GitHub integration tests, see real-dispatch.test.js
 */

import { describe, it, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, cleanupAll } from '../../../harness/terminal.js';
import { createIsolatedConfig, RALLY_BIN_PATH, REPO_ROOT_PATH } from '../../../harness/e2e-dispatch-fixture.js';
import path from 'node:path';
import { writeFileSync } from 'node:fs';

const SCREENSHOT_DIR = path.join(REPO_ROOT_PATH, 'test', 'baselines', 'actions-view-log');

/**
 * Create isolated config with an active dispatch that has log output.
 */
function createConfigWithDispatchAndLog() {
  const isolated = createIsolatedConfig({ prefix: 'rally-view-log' });
  const worktreePath = path.join(isolated.tempDir, 'projects', 'rally-42');

  isolated.seedConfigWithDispatch({
    id: 'test-dispatch-1',
    repo: 'jsturtevant/rally',
    issue: 42,
    url: 'https://github.com/jsturtevant/rally/issues/42',
    branch: 'rally/42-test-issue',
    worktreePath,
    status: 'implementing',
    createdAt: new Date().toISOString(),
  });

  // Create a mock copilot log file
  writeFileSync(
    path.join(worktreePath, '.squad', 'copilot.log'),
    `[2024-01-15 10:00:00] Starting copilot session...
[2024-01-15 10:00:01] Loading context from dispatch-context.md
[2024-01-15 10:00:02] Analyzing issue #42
[2024-01-15 10:00:05] Implementing solution...
[2024-01-15 10:00:10] Created file: src/feature.js
[2024-01-15 10:00:15] Running tests...
`,
    'utf8',
  );

  return isolated;
}

describe('view log action — l key', () => {
  let term;
  let isolated;

  afterEach(async () => {
    if (term) {
      try { term.close(); } catch {}
      term = null;
    }
    if (isolated) {
      isolated.cleanup();
      isolated = null;
    }
  });

  after(async () => {
    await cleanupAll();
  });

  it('l key shows copilot log output', { timeout: 30_000 }, async () => {
    isolated = createConfigWithDispatchAndLog();

    term = await spawn(`node ${RALLY_BIN_PATH} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: isolated.tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    await term.screenshot(path.join(SCREENSHOT_DIR, '01-dashboard.png'));

    // Press 'l' to view log
    await term.send('l');
    await new Promise(r => setTimeout(r, 500));
    await term.screenshot(path.join(SCREENSHOT_DIR, '02-log-view.png'));

    const logFrame = term.getFrame();
    // Should show log content or log viewer
    assert.ok(
      logFrame.includes('log') || 
      logFrame.includes('Log') || 
      logFrame.includes('copilot') ||
      logFrame.includes('Starting') ||
      logFrame.includes('Escape'),
      'Log viewer should be visible or show log content'
    );
  });

  it('Escape returns to dashboard from log view', { timeout: 30_000 }, async () => {
    isolated = createConfigWithDispatchAndLog();

    term = await spawn(`node ${RALLY_BIN_PATH} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: isolated.tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });

    // Press 'l' to view log
    await term.send('l');
    await new Promise(r => setTimeout(r, 500));
    await term.screenshot(path.join(SCREENSHOT_DIR, '03-log-before-escape.png'));

    // Press Escape to return
    await term.sendKey('escape');
    await new Promise(r => setTimeout(r, 500));
    await term.screenshot(path.join(SCREENSHOT_DIR, '04-after-escape.png'));

    const dashboardFrame = term.getFrame();
    assert.ok(
      dashboardFrame.includes('Rally Dashboard'),
      'Should return to dashboard after Escape'
    );
  });

  it('l key gracefully handles missing log file', { timeout: 30_000 }, async () => {
    // Create config with dispatch but NO log file
    isolated = createIsolatedConfig({ prefix: 'rally-view-log-empty' });
    const worktreePath = path.join(isolated.tempDir, 'projects', 'rally-99');

    isolated.seedConfigWithDispatch({
      id: 'test-dispatch-2',
      repo: 'jsturtevant/rally',
      issue: 99,
      branch: 'rally/99-no-log',
      worktreePath,
      status: 'implementing',
      createdAt: new Date().toISOString(),
    });
    // Note: NOT creating copilot.log file

    term = await spawn(`node ${RALLY_BIN_PATH} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: isolated.tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });

    // Press 'l' with no log file
    await term.send('l');
    await new Promise(r => setTimeout(r, 500));

    // Should not crash
    const frame = term.getFrame();
    assert.ok(
      frame.includes('Rally Dashboard') || frame.includes('No log') || frame.includes('empty'),
      'Should handle missing log gracefully'
    );
  });
});
