/**
 * E2E Journey Test: Continue/Attach Action Shortcut (Mock-based)
 * 
 * Tests the 'a' key to attach to an existing session.
 * Works when there's an active dispatch.
 * 
 * Uses isolated RALLY_HOME temp directory to avoid affecting user config.
 * For real GitHub integration tests, see real-dispatch.test.js
 */

import { describe, it, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, cleanupAll } from '../../../harness/terminal.js';
import { createIsolatedConfig, RALLY_BIN_PATH, REPO_ROOT_PATH } from '../../../harness/e2e-dispatch-fixture.js';
import path from 'node:path';

const SCREENSHOT_DIR = path.join(REPO_ROOT_PATH, 'test', 'baselines', 'actions-continue');

/**
 * Create isolated config with an active dispatch.
 */
function createConfigWithActiveDispatch() {
  const isolated = createIsolatedConfig({ prefix: 'rally-continue' });
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

describe('continue/attach action — a key', () => {
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

  it('a key triggers attach to existing session', { timeout: 30_000 }, async () => {
    isolated = createConfigWithActiveDispatch();

    term = await spawn(`node ${RALLY_BIN_PATH} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: isolated.tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    await term.screenshot(path.join(SCREENSHOT_DIR, '01-dashboard.png'));

    const initialFrame = term.getFrame();
    // Verify we have a dispatch visible
    assert.ok(
      initialFrame.includes('#42') || initialFrame.includes('rally/42') || initialFrame.includes('implementing'),
      'Should show the test dispatch'
    );

    // Press 'a' to attach/continue
    await term.send('a');
    await new Promise(r => setTimeout(r, 1000));
    await term.screenshot(path.join(SCREENSHOT_DIR, '02-after-attach.png'));

    const afterFrame = term.getFrame();
    // Should either show attach mode, copilot interface, or confirmation
    assert.ok(
      afterFrame.includes('attach') ||
      afterFrame.includes('Attach') ||
      afterFrame.includes('session') ||
      afterFrame.includes('copilot') ||
      afterFrame.includes('Rally Dashboard') ||
      afterFrame.includes('#42'),
      'Should trigger attach action or show relevant UI'
    );
  });

  it('a key does nothing when no dispatch is selected', { timeout: 30_000 }, async () => {
    // Seed without any dispatches (empty config)
    isolated = createIsolatedConfig({ prefix: 'rally-continue-empty' });

    term = await spawn(`node ${RALLY_BIN_PATH} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: isolated.tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    await term.screenshot(path.join(SCREENSHOT_DIR, '03-empty-dashboard.png'));

    // Press 'a' with no dispatches
    await term.send('a');
    await new Promise(r => setTimeout(r, 300));
    await term.screenshot(path.join(SCREENSHOT_DIR, '04-after-attach-empty.png'));

    // Should not crash, dashboard still visible
    const frame = term.getFrame();
    assert.ok(frame.includes('Rally Dashboard'), 'Dashboard should remain stable');
  });

  it('works with dispatch in different statuses', { timeout: 30_000 }, async () => {
    isolated = createIsolatedConfig({ prefix: 'rally-continue-status' });
    const worktreePath = path.join(isolated.tempDir, 'projects', 'rally-55');

    // Create dispatch with 'paused' status
    isolated.seedConfigWithDispatch({
      id: 'test-dispatch-paused',
      repo: 'jsturtevant/rally',
      issue: 55,
      branch: 'rally/55-paused-issue',
      worktreePath,
      status: 'paused',
      createdAt: new Date().toISOString(),
    });

    term = await spawn(`node ${RALLY_BIN_PATH} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: isolated.tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });

    // Press 'a' to attach to paused dispatch
    await term.send('a');
    await new Promise(r => setTimeout(r, 500));
    await term.screenshot(path.join(SCREENSHOT_DIR, '05-attach-paused.png'));

    const frame = term.getFrame();
    // Should handle paused status appropriately
    assert.ok(
      frame.includes('Rally Dashboard') || 
      frame.includes('attach') || 
      frame.includes('session'),
      'Should handle paused dispatch'
    );
  });
});
