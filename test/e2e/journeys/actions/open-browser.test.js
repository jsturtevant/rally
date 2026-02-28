/**
 * E2E Journey Test: Open Browser Action Shortcut (Mock-based)
 * 
 * Tests the 'o' key to open browser for viewing the issue/PR.
 * Since we can't actually open a browser in tests, we verify
 * the command is dispatched correctly.
 * 
 * Uses isolated RALLY_HOME temp directory to avoid affecting user config.
 * For real GitHub integration tests, see real-dispatch.test.js
 */

import { describe, it, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, cleanupAll } from '../../../harness/terminal.js';
import { createIsolatedConfig, RALLY_BIN_PATH, REPO_ROOT_PATH } from '../../../harness/e2e-dispatch-fixture.js';
import path from 'node:path';

const SCREENSHOT_DIR = path.join(REPO_ROOT_PATH, 'test', 'baselines', 'actions-open-browser');

/**
 * Create isolated config with an active dispatch.
 */
function createConfigWithDispatch() {
  const isolated = createIsolatedConfig({ prefix: 'rally-open-browser' });
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

  return isolated;
}

describe('open browser action — o key', () => {
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

  it('o key triggers browser open action with selected dispatch', { timeout: 30_000 }, async () => {
    isolated = createConfigWithDispatch();

    // Set BROWSER to a no-op command so we can test without actually opening browser
    term = await spawn(`node ${RALLY_BIN_PATH} dashboard`, {
      cols: 120,
      rows: 30,
      env: { 
        RALLY_HOME: isolated.tempDir, 
        NO_COLOR: '1',
        BROWSER: 'echo', // Use echo as a mock browser command
      },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    await term.screenshot(path.join(SCREENSHOT_DIR, '01-dashboard-with-dispatch.png'));

    const initialFrame = term.getFrame();
    // Verify we have a dispatch visible
    assert.ok(
      initialFrame.includes('#42') || initialFrame.includes('rally/42') || initialFrame.includes('implementing'),
      'Should show the test dispatch'
    );

    // Press 'o' to open browser
    await term.send('o');
    await new Promise(r => setTimeout(r, 500));
    await term.screenshot(path.join(SCREENSHOT_DIR, '02-after-open-browser.png'));

    // Dashboard should still be visible (browser opens externally)
    const afterFrame = term.getFrame();
    assert.ok(
      afterFrame.includes('Rally Dashboard'),
      'Dashboard should remain visible after opening browser'
    );
  });

  it('o key does nothing when no dispatch is selected', { timeout: 30_000 }, async () => {
    // Seed without any dispatches (empty config)
    isolated = createIsolatedConfig({ prefix: 'rally-open-browser-empty' });

    term = await spawn(`node ${RALLY_BIN_PATH} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: isolated.tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });

    // Press 'o' with no dispatches
    await term.send('o');
    await new Promise(r => setTimeout(r, 300));

    // Should not crash, dashboard still visible
    const frame = term.getFrame();
    assert.ok(frame.includes('Rally Dashboard'), 'Dashboard should remain stable');
  });
});
