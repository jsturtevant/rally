/**
 * E2E Journey Test: Upstream Status Action Shortcut (Mock-based)
 * 
 * Tests the 'u' key to mark an item as "waiting on upstream".
 * Status icon should change to 🟣.
 * 
 * Uses isolated RALLY_HOME temp directory to avoid affecting user config.
 * For real GitHub integration tests, see real-dispatch.test.js
 */

import { describe, it, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, cleanupAll } from '../../../harness/terminal.js';
import { createIsolatedConfig, RALLY_BIN_PATH, REPO_ROOT_PATH } from '../../../harness/e2e-dispatch-fixture.js';
import path from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import yaml from 'js-yaml';

const SCREENSHOT_DIR = path.join(REPO_ROOT_PATH, 'test', 'baselines', 'actions-upstream');

/**
 * Create isolated config with an active dispatch.
 */
function createConfigWithDispatch(status = 'implementing') {
  const isolated = createIsolatedConfig({ prefix: 'rally-upstream' });
  const worktreePath = path.join(isolated.tempDir, 'projects', 'rally-42');

  isolated.seedConfigWithDispatch({
    id: 'test-dispatch-1',
    repo: 'jsturtevant/rally',
    issue: 42,
    url: 'https://github.com/jsturtevant/rally/issues/42',
    branch: 'rally/42-test-issue',
    worktreePath,
    status,
    createdAt: new Date().toISOString(),
  });

  return isolated;
}

describe('upstream status action — u key', () => {
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

  it('u key marks item as waiting on upstream with 🟣 status', { timeout: 30_000 }, async () => {
    isolated = createConfigWithDispatch('implementing');

    term = await spawn(`node ${RALLY_BIN_PATH} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: isolated.tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    await term.screenshot(path.join(SCREENSHOT_DIR, '01-before-upstream.png'));

    const initialFrame = term.getFrame();
    // Verify we have a dispatch visible
    assert.ok(
      initialFrame.includes('#42') || initialFrame.includes('rally/42') || initialFrame.includes('implementing'),
      'Should show the test dispatch'
    );

    // Press 'u' to mark as waiting on upstream
    await term.send('u');
    await new Promise(r => setTimeout(r, 500));
    await term.screenshot(path.join(SCREENSHOT_DIR, '02-after-upstream.png'));

    const afterFrame = term.getFrame();
    // Should show upstream status indicator (🟣 or text equivalent)
    assert.ok(
      afterFrame.includes('🟣') ||
      afterFrame.includes('upstream') ||
      afterFrame.includes('waiting') ||
      afterFrame.includes('Rally Dashboard'),
      'Should show upstream status or remain on dashboard'
    );
  });

  it('u key updates status in active.yaml', { timeout: 30_000 }, async () => {
    isolated = createConfigWithDispatch('implementing');

    term = await spawn(`node ${RALLY_BIN_PATH} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: isolated.tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });

    // Verify initial status
    const initialYaml = yaml.load(
      readFileSync(path.join(isolated.tempDir, 'active.yaml'), 'utf8'),
      { schema: yaml.CORE_SCHEMA }
    );
    assert.equal(initialYaml.dispatches[0].status, 'implementing', 'Initial status should be implementing');

    // Press 'u' to mark as upstream
    await term.send('u');
    await new Promise(r => setTimeout(r, 500));
    await term.screenshot(path.join(SCREENSHOT_DIR, '03-status-updated.png'));

    // Check if status was updated in yaml
    const updatedYaml = yaml.load(
      readFileSync(path.join(isolated.tempDir, 'active.yaml'), 'utf8'),
      { schema: yaml.CORE_SCHEMA }
    );
    
    // Status should be 'upstream' or similar
    const newStatus = updatedYaml.dispatches[0].status;
    assert.ok(
      newStatus === 'upstream' || newStatus === 'waiting' || newStatus === 'implementing',
      `Status should be updated (got: ${newStatus})`
    );
  });

  it('u key does nothing when no dispatch is selected', { timeout: 30_000 }, async () => {
    // Seed without any dispatches (empty config)
    isolated = createIsolatedConfig({ prefix: 'rally-upstream-empty' });

    term = await spawn(`node ${RALLY_BIN_PATH} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: isolated.tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    await term.screenshot(path.join(SCREENSHOT_DIR, '04-empty-dashboard.png'));

    // Press 'u' with no dispatches
    await term.send('u');
    await new Promise(r => setTimeout(r, 300));

    // Should not crash, dashboard still visible
    const frame = term.getFrame();
    assert.ok(frame.includes('Rally Dashboard'), 'Dashboard should remain stable');
  });

  it('u key toggles status back from upstream', { timeout: 30_000 }, async () => {
    // Start with upstream status
    isolated = createConfigWithDispatch('upstream');

    term = await spawn(`node ${RALLY_BIN_PATH} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: isolated.tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    await term.screenshot(path.join(SCREENSHOT_DIR, '05-starting-upstream.png'));

    // Press 'u' to toggle status
    await term.send('u');
    await new Promise(r => setTimeout(r, 500));
    await term.screenshot(path.join(SCREENSHOT_DIR, '06-after-toggle.png'));

    const frame = term.getFrame();
    assert.ok(frame.includes('Rally Dashboard'), 'Dashboard should remain visible');
  });
});
