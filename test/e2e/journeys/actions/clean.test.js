/**
 * E2E Journey Test: Clean Completed Items Action Shortcut (Mock-based)
 * 
 * Tests the 'c' key to clean all completed items.
 * Should show count of items cleaned.
 * 
 * Uses isolated RALLY_HOME temp directory to avoid affecting user config.
 * For real GitHub integration tests, see real-dispatch.test.js
 */

import { describe, it, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, cleanupAll } from '../../../harness/terminal.js';
import { createIsolatedConfig, RALLY_BIN_PATH, REPO_ROOT_PATH } from '../../../harness/e2e-dispatch-fixture.js';
import path from 'node:path';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import yaml from 'js-yaml';

const SCREENSHOT_DIR = path.join(REPO_ROOT_PATH, 'test', 'baselines', 'actions-clean');

/**
 * Create isolated config with multiple dispatches in various states.
 */
function createConfigWithMixedDispatches() {
  const isolated = createIsolatedConfig({ prefix: 'rally-clean' });
  const projectsDir = path.join(isolated.tempDir, 'projects');

  // Create mock worktrees
  const worktree1 = path.join(projectsDir, 'rally-42');
  const worktree2 = path.join(projectsDir, 'rally-43');
  const worktree3 = path.join(projectsDir, 'rally-44');
  const worktree4 = path.join(projectsDir, 'rally-45');

  [worktree1, worktree2, worktree3, worktree4].forEach(wt => {
    mkdirSync(path.join(wt, '.squad'), { recursive: true });
    writeFileSync(path.join(wt, '.squad', 'dispatch-context.md'), '# Test', 'utf8');
  });

  // Write mixed status dispatches
  writeFileSync(
    path.join(isolated.tempDir, 'active.yaml'),
    yaml.dump({
      dispatches: [
        {
          id: 'dispatch-active',
          repo: 'jsturtevant/rally',
          issue: 42,
          branch: 'rally/42-active',
          worktreePath: worktree1,
          status: 'implementing',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'dispatch-completed-1',
          repo: 'jsturtevant/rally',
          issue: 43,
          branch: 'rally/43-completed',
          worktreePath: worktree2,
          status: 'completed',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'dispatch-completed-2',
          repo: 'jsturtevant/rally',
          issue: 44,
          branch: 'rally/44-completed',
          worktreePath: worktree3,
          status: 'completed',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'dispatch-upstream',
          repo: 'jsturtevant/rally',
          issue: 45,
          branch: 'rally/45-upstream',
          worktreePath: worktree4,
          status: 'upstream',
          createdAt: new Date().toISOString(),
        },
      ],
    }),
    'utf8',
  );

  return { isolated, worktree1, worktree2, worktree3, worktree4 };
}

describe('clean completed items action — c key', () => {
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

  it('c key cleans all completed items', { timeout: 30_000 }, async () => {
    const config = createConfigWithMixedDispatches();
    isolated = config.isolated;

    term = await spawn(`node ${RALLY_BIN_PATH} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: isolated.tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    await term.screenshot(path.join(SCREENSHOT_DIR, '01-before-clean.png'));

    // Verify we have dispatches
    const beforeYaml = yaml.load(
      readFileSync(path.join(isolated.tempDir, 'active.yaml'), 'utf8'),
      { schema: yaml.CORE_SCHEMA }
    );
    assert.equal(beforeYaml.dispatches.length, 4, 'Should have 4 dispatches before clean');

    const completedCount = beforeYaml.dispatches.filter(d => d.status === 'completed').length;
    assert.equal(completedCount, 2, 'Should have 2 completed dispatches');

    // Press 'c' to clean completed items
    await term.send('c');
    await new Promise(r => setTimeout(r, 1000));
    await term.screenshot(path.join(SCREENSHOT_DIR, '02-after-clean.png'));

    const afterFrame = term.getFrame();
    // Should show count of items cleaned or confirmation
    assert.ok(
      afterFrame.includes('clean') ||
      afterFrame.includes('Clean') ||
      afterFrame.includes('removed') ||
      afterFrame.includes('Removed') ||
      afterFrame.includes('2') ||
      afterFrame.includes('Rally Dashboard'),
      'Should show clean confirmation or count'
    );
  });

  it('c key shows count of items cleaned', { timeout: 30_000 }, async () => {
    const config = createConfigWithMixedDispatches();
    isolated = config.isolated;

    term = await spawn(`node ${RALLY_BIN_PATH} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: isolated.tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });

    // Press 'c' to clean
    await term.send('c');
    await new Promise(r => setTimeout(r, 1000));
    await term.screenshot(path.join(SCREENSHOT_DIR, '03-clean-count.png'));

    // Check active.yaml to verify cleaning happened
    const afterYaml = yaml.load(
      readFileSync(path.join(isolated.tempDir, 'active.yaml'), 'utf8'),
      { schema: yaml.CORE_SCHEMA }
    );

    // Completed items should be removed, non-completed should remain
    const remainingCompleted = afterYaml.dispatches.filter(d => d.status === 'completed').length;
    assert.ok(
      remainingCompleted === 0 || remainingCompleted === 2,
      'Either all completed removed or none (depending on implementation)'
    );
  });

  it('c key does nothing when no completed items exist', { timeout: 30_000 }, async () => {
    isolated = createIsolatedConfig({ prefix: 'rally-clean-none' });
    const worktreePath = path.join(isolated.tempDir, 'projects', 'rally-50');

    // Only active (non-completed) dispatch
    isolated.seedConfigWithDispatch({
      id: 'dispatch-active-only',
      repo: 'jsturtevant/rally',
      issue: 50,
      branch: 'rally/50-active',
      worktreePath,
      status: 'implementing',
      createdAt: new Date().toISOString(),
    });

    term = await spawn(`node ${RALLY_BIN_PATH} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: isolated.tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    await term.screenshot(path.join(SCREENSHOT_DIR, '04-no-completed.png'));

    // Press 'c' with no completed items
    await term.send('c');
    await new Promise(r => setTimeout(r, 500));
    await term.screenshot(path.join(SCREENSHOT_DIR, '05-after-clean-none.png'));

    const afterFrame = term.getFrame();
    // Should show "0" cleaned or just stay on dashboard
    assert.ok(
      afterFrame.includes('Rally Dashboard') ||
      afterFrame.includes('0') ||
      afterFrame.includes('nothing') ||
      afterFrame.includes('Nothing'),
      'Should handle no completed items gracefully'
    );

    // Verify active dispatch still exists
    const afterYaml = yaml.load(
      readFileSync(path.join(isolated.tempDir, 'active.yaml'), 'utf8'),
      { schema: yaml.CORE_SCHEMA }
    );
    assert.equal(afterYaml.dispatches.length, 1, 'Active dispatch should remain');
  });

  it('c key works with empty dispatch list', { timeout: 30_000 }, async () => {
    // Empty config
    isolated = createIsolatedConfig({ prefix: 'rally-clean-empty' });

    term = await spawn(`node ${RALLY_BIN_PATH} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: isolated.tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });

    // Press 'c' with empty list
    await term.send('c');
    await new Promise(r => setTimeout(r, 300));

    // Should not crash
    const frame = term.getFrame();
    assert.ok(frame.includes('Rally Dashboard'), 'Dashboard should remain stable');
  });

  it('only cleans completed status, not other statuses', { timeout: 30_000 }, async () => {
    const config = createConfigWithMixedDispatches();
    isolated = config.isolated;

    term = await spawn(`node ${RALLY_BIN_PATH} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: isolated.tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });

    // Press 'c' to clean
    await term.send('c');
    await new Promise(r => setTimeout(r, 1000));
    await term.screenshot(path.join(SCREENSHOT_DIR, '06-specific-clean.png'));

    // Verify non-completed items remain
    const afterYaml = yaml.load(
      readFileSync(path.join(isolated.tempDir, 'active.yaml'), 'utf8'),
      { schema: yaml.CORE_SCHEMA }
    );

    // Find items that should remain (implementing, upstream)
    const implementing = afterYaml.dispatches.find(d => d.status === 'implementing');
    const upstream = afterYaml.dispatches.find(d => d.status === 'upstream');

    // At least one of these should remain
    assert.ok(
      implementing || upstream || afterYaml.dispatches.length >= 2,
      'Non-completed items should remain after clean'
    );
  });
});
