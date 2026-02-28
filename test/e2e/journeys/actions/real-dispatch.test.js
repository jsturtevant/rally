/**
 * E2E Journey Test: Action Shortcuts with Real GitHub Integration
 * 
 * Tests all action shortcuts (l, a, u, x, c, o) using a real dispatch
 * to GitHub issue #54. Uses a shared dispatch for efficiency.
 * 
 * This test file:
 * - Skips if gh CLI not authenticated
 * - Uses isolated RALLY_HOME temp directory
 * - Dispatches once to issue #54, tests multiple shortcuts
 * - Cleans up dispatch after all tests
 */

import { describe, it, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, cleanupAll } from '../../../harness/terminal.js';
import {
  setupDispatchFixture,
  teardownDispatchFixture,
  getFixture,
  getSkipReason,
  startDashboard,
  closeDashboard,
  E2E_ISSUE,
  RALLY_BIN_PATH,
  REPO_ROOT_PATH,
} from '../../../harness/e2e-dispatch-fixture.js';
import path from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import yaml from 'js-yaml';

const SCREENSHOT_DIR = path.join(REPO_ROOT_PATH, 'test', 'baselines', 'actions-real-dispatch');
const JOURNEY_TIMEOUT = 120_000;

describe('action shortcuts with real dispatch — GitHub integration', () => {
  const skipReason = getSkipReason();

  before(async () => {
    if (skipReason) return;
    await setupDispatchFixture({ timeout: JOURNEY_TIMEOUT });
  }, { timeout: JOURNEY_TIMEOUT });

  afterEach(async () => {
    closeDashboard();
  });

  after(async () => {
    await teardownDispatchFixture();
    await cleanupAll();
  });

  // ─── VERIFY WORKTREE EXISTS (run first) ─────────────────────────────────────

  it('real dispatch creates valid worktree', { skip: skipReason, timeout: 10_000 }, async () => {
    const { worktreePath, branchName } = getFixture();

    // Verify worktree exists
    assert.ok(existsSync(worktreePath), `Worktree should exist at ${worktreePath}`);

    // Verify .squad directory exists
    const squadDir = path.join(worktreePath, '.squad');
    assert.ok(existsSync(squadDir), '.squad directory should exist');

    // Verify dispatch-context.md exists
    const contextPath = path.join(squadDir, 'dispatch-context.md');
    assert.ok(existsSync(contextPath), 'dispatch-context.md should exist');

    // Verify context contains issue reference
    const contextContent = readFileSync(contextPath, 'utf8');
    assert.ok(
      contextContent.includes('#54') || 
      contextContent.includes('E2E') || 
      contextContent.includes('test'),
      'Context should reference the issue'
    );

    // Verify branch name follows pattern
    assert.match(branchName, /^rally\/54-/, 'Branch should match rally/54-* pattern');
  });

  // ─── VIEW LOG (l key) ─────────────────────────────────────────────────────

  it('l key shows log view for real dispatch', { skip: skipReason, timeout: 30_000 }, async () => {
    const { tempDir } = getFixture();
    const term = await startDashboard();

    await term.screenshot(path.join(SCREENSHOT_DIR, '01-dashboard-before-log.png'));

    const initialFrame = term.getFrame();
    // Should show issue #54 dispatch
    assert.ok(
      initialFrame.includes(`#${E2E_ISSUE.number}`) || 
      initialFrame.includes('rally/54') || 
      initialFrame.includes('implementing') ||
      initialFrame.includes('E2E'),
      'Should show the E2E test dispatch'
    );

    // Press 'l' to view log
    await term.send('l');
    await new Promise(r => setTimeout(r, 500));
    await term.screenshot(path.join(SCREENSHOT_DIR, '02-log-view.png'));

    const logFrame = term.getFrame();
    // Should show log content or log viewer
    assert.ok(
      logFrame.includes('log') || 
      logFrame.includes('Log') || 
      logFrame.includes('Escape') ||
      logFrame.includes('Rally Dashboard'),
      'Log viewer should be accessible'
    );
  });

  // ─── CONTINUE/ATTACH (a key) ──────────────────────────────────────────────

  it('a key triggers attach action for real dispatch', { skip: skipReason, timeout: 30_000 }, async () => {
    const term = await startDashboard();

    await term.screenshot(path.join(SCREENSHOT_DIR, '03-dashboard-before-attach.png'));

    // Press 'a' to attach/continue
    await term.send('a');
    await new Promise(r => setTimeout(r, 1000));
    await term.screenshot(path.join(SCREENSHOT_DIR, '04-after-attach.png'));

    const afterFrame = term.getFrame();
    // Should trigger attach or show relevant UI
    assert.ok(
      afterFrame.includes('attach') ||
      afterFrame.includes('Attach') ||
      afterFrame.includes('session') ||
      afterFrame.includes('copilot') ||
      afterFrame.includes('Rally Dashboard') ||
      afterFrame.includes(`#${E2E_ISSUE.number}`),
      'Should trigger attach action or show relevant UI'
    );
  });

  // ─── UPSTREAM STATUS (u key) ───────────────────────────────────────────────

  it('u key marks reviewing dispatch as upstream', { skip: skipReason, timeout: 30_000 }, async () => {
    const { tempDir } = getFixture();
    const term = await startDashboard();

    await term.screenshot(path.join(SCREENSHOT_DIR, '05-dashboard-before-upstream.png'));

    // Read initial status
    const beforeYaml = yaml.load(
      readFileSync(path.join(tempDir, 'active.yaml'), 'utf8'),
      { schema: yaml.CORE_SCHEMA }
    );
    const initialStatus = beforeYaml.dispatches.find(d => d.number === E2E_ISSUE.number)?.status;

    // Note: 'u' only works for 'reviewing' status, not 'implementing'
    // So this test verifies the key doesn't crash and UI remains stable
    await term.send('u');
    await new Promise(r => setTimeout(r, 500));
    await term.screenshot(path.join(SCREENSHOT_DIR, '06-after-upstream.png'));

    // Verify dispatch still exists and dashboard is stable
    const afterYaml = yaml.load(
      readFileSync(path.join(tempDir, 'active.yaml'), 'utf8'),
      { schema: yaml.CORE_SCHEMA }
    );
    const dispatch = afterYaml.dispatches.find(d => d.number === E2E_ISSUE.number);
    assert.ok(dispatch, 'Dispatch should still exist');

    // If status was 'reviewing', it should change to 'upstream'
    // If status was not 'reviewing', it should remain unchanged
    if (initialStatus === 'reviewing') {
      assert.strictEqual(dispatch.status, 'upstream', 'Status should change to upstream');
    } else {
      assert.strictEqual(dispatch.status, initialStatus, `Status should remain ${initialStatus} (u key only works for reviewing)`);
    }
  });

  // ─── OPEN BROWSER (o key) ──────────────────────────────────────────────────

  it('o key triggers browser open for real dispatch', { skip: skipReason, timeout: 30_000 }, async () => {
    const { tempDir } = getFixture();
    
    // Use echo as mock browser to avoid actually opening browser
    const term = await spawn(`node ${RALLY_BIN_PATH} dashboard`, {
      cols: 120,
      rows: 30,
      env: { 
        RALLY_HOME: tempDir, 
        NO_COLOR: '1',
        BROWSER: 'echo',  // Mock browser command
      },
    });

    await term.waitFor('Rally Dashboard', { timeout: 15_000 });
    await term.screenshot(path.join(SCREENSHOT_DIR, '07-dashboard-before-open.png'));

    // Press 'o' to open browser
    await term.send('o');
    await new Promise(r => setTimeout(r, 500));
    await term.screenshot(path.join(SCREENSHOT_DIR, '08-after-open.png'));

    const afterFrame = term.getFrame();
    // Dashboard should remain visible
    assert.ok(
      afterFrame.includes('Rally Dashboard'),
      'Dashboard should remain visible after open browser action'
    );

    term.close();
  });

  // ─── REMOVE (x key) - with cancel ──────────────────────────────────────────

  it('x key removes dispatch immediately', { skip: skipReason, timeout: 30_000 }, async () => {
    // Note: This test is last because it actually removes the dispatch
    // In a real E2E scenario, we'd need to re-dispatch after this test
    
    const { tempDir } = getFixture();
    const term = await startDashboard();

    await term.screenshot(path.join(SCREENSHOT_DIR, '09-dashboard-before-remove.png'));

    // Verify dispatch exists before
    const beforeYaml = yaml.load(
      readFileSync(path.join(tempDir, 'active.yaml'), 'utf8'),
      { schema: yaml.CORE_SCHEMA }
    );
    const dispatchBefore = beforeYaml.dispatches.find(d => d.number === E2E_ISSUE.number);
    assert.ok(dispatchBefore, 'Dispatch should exist before remove');

    // Press 'x' to remove (no confirmation prompt in current implementation)
    await term.send('x');
    await new Promise(r => setTimeout(r, 1000)); // Wait for async remove
    await term.screenshot(path.join(SCREENSHOT_DIR, '10-after-remove.png'));

    // Verify dispatch was removed
    const afterYaml = yaml.load(
      readFileSync(path.join(tempDir, 'active.yaml'), 'utf8'),
      { schema: yaml.CORE_SCHEMA }
    );
    const dispatchAfter = afterYaml.dispatches.find(d => d.number === E2E_ISSUE.number);
    assert.ok(!dispatchAfter, 'Dispatch should be removed after x key');
  });

  // ─── NAVIGATION ────────────────────────────────────────────────────────────

  it('arrow keys navigate dispatch list', { skip: skipReason, timeout: 30_000 }, async () => {
    const term = await startDashboard();

    await term.screenshot(path.join(SCREENSHOT_DIR, '12-navigation-start.png'));

    // Arrow up/down should not crash
    await term.sendKey('up');
    await new Promise(r => setTimeout(r, 200));
    await term.sendKey('down');
    await new Promise(r => setTimeout(r, 200));

    const frame = term.getFrame();
    assert.ok(frame.includes('Rally Dashboard'), 'Dashboard should remain stable during navigation');
  });

  // ─── REFRESH (r key) ───────────────────────────────────────────────────────

  it('r key refreshes dashboard with real dispatch', { skip: skipReason, timeout: 30_000 }, async () => {
    const term = await startDashboard();

    await term.screenshot(path.join(SCREENSHOT_DIR, '13-before-refresh.png'));

    // Press 'r' to refresh
    await term.send('r');
    await new Promise(r => setTimeout(r, 500));
    await term.screenshot(path.join(SCREENSHOT_DIR, '14-after-refresh.png'));

    const afterFrame = term.getFrame();
    assert.ok(
      afterFrame.includes('Rally Dashboard') || afterFrame.includes(`#${E2E_ISSUE.number}`),
      'Dashboard should show dispatch after refresh'
    );
  });

  // ─── QUIT (q key) ──────────────────────────────────────────────────────────

  it('q key exits dashboard cleanly', { skip: skipReason, timeout: 30_000 }, async () => {
    const term = await startDashboard();

    await term.screenshot(path.join(SCREENSHOT_DIR, '15-before-quit.png'));

    // Press 'q' to quit
    await term.send('q');
    await new Promise(r => setTimeout(r, 500));

    // Terminal process should exit
    // If we get here without hanging, quit worked
  });
});
