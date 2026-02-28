/**
 * E2E Journey Test: Remove Worktree Action Shortcut (Mock-based)
 * 
 * Tests the 'x' key to remove a worktree.
 * Note: The 'x' key removes immediately without a confirmation prompt.
 * 
 * Uses isolated RALLY_HOME temp directory to avoid affecting user config.
 * For real GitHub integration tests, see real-dispatch.test.js
 */

import { describe, it, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, cleanupAll } from '../../../harness/terminal.js';
import { createIsolatedConfig, RALLY_BIN_PATH, REPO_ROOT_PATH } from '../../../harness/e2e-dispatch-fixture.js';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';

const SCREENSHOT_DIR = path.join(REPO_ROOT_PATH, 'test', 'baselines', 'actions-remove');

/**
 * Create isolated config with an active dispatch.
 */
function createConfigWithMockDispatch() {
  const isolated = createIsolatedConfig({ prefix: 'rally-remove' });
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

  return { isolated, worktreePath };
}

describe('remove worktree action — x key', () => {
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

  it('x key removes the dispatch', { timeout: 30_000 }, async () => {
    const config = createConfigWithMockDispatch();
    isolated = config.isolated;

    term = await spawn(`node ${RALLY_BIN_PATH} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: isolated.tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    await term.screenshot(path.join(SCREENSHOT_DIR, '01-before-remove.png'));

    const initialFrame = term.getFrame();
    assert.ok(
      initialFrame.includes('#42') || initialFrame.includes('rally/42') || initialFrame.includes('implementing'),
      'Should show the test dispatch'
    );

    // Verify dispatch exists before removal
    const beforeYaml = yaml.load(
      readFileSync(path.join(isolated.tempDir, 'active.yaml'), 'utf8'),
      { schema: yaml.CORE_SCHEMA }
    );
    assert.equal(beforeYaml.dispatches.length, 1, 'Should have one dispatch before removal');

    // Press 'x' to remove
    await term.send('x');
    await new Promise(r => setTimeout(r, 1000));
    await term.screenshot(path.join(SCREENSHOT_DIR, '02-after-remove.png'));

    // Verify dispatch was removed from active.yaml
    const afterYaml = yaml.load(
      readFileSync(path.join(isolated.tempDir, 'active.yaml'), 'utf8'),
      { schema: yaml.CORE_SCHEMA }
    );
    assert.ok(
      afterYaml.dispatches.length === 0 || 
      !afterYaml.dispatches.some(d => d.id === 'test-dispatch-1'),
      'Dispatch should be removed from active.yaml'
    );
  });

  it('x key does nothing when no dispatch is selected', { timeout: 30_000 }, async () => {
    // Seed without any dispatches (empty config)
    isolated = createIsolatedConfig({ prefix: 'rally-remove-empty' });

    term = await spawn(`node ${RALLY_BIN_PATH} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: isolated.tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });

    // Press 'x' with no dispatches
    await term.send('x');
    await new Promise(r => setTimeout(r, 300));

    // Should not crash, dashboard still visible
    const frame = term.getFrame();
    assert.ok(frame.includes('Rally Dashboard'), 'Dashboard should remain stable');
  });

  it('dashboard refreshes after removal', { timeout: 30_000 }, async () => {
    const config = createConfigWithMockDispatch();
    isolated = config.isolated;

    term = await spawn(`node ${RALLY_BIN_PATH} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: isolated.tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    await term.screenshot(path.join(SCREENSHOT_DIR, '03-with-dispatch.png'));

    // Press 'x' to remove
    await term.send('x');
    await new Promise(r => setTimeout(r, 1000));
    await term.screenshot(path.join(SCREENSHOT_DIR, '04-after-remove-refresh.png'));

    const afterFrame = term.getFrame();
    // Dashboard should remain visible (possibly showing no dispatches)
    assert.ok(
      afterFrame.includes('Rally Dashboard'),
      'Dashboard should remain visible after removal'
    );
  });
});
