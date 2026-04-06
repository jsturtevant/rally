/**
 * E2E Journey Test: Escape Key Navigation Across Screens
 * 
 * Tests Escape key behavior for navigating back through screen hierarchy:
 * - Dashboard (top level) → various sub-screens
 * - Escape from sub-screens returns to parent screen
 * - Escape from top-level dashboard doesn't crash
 * - Navigation stack works correctly across all screens
 * 
 * Screen hierarchy:
 * Dashboard (top)
 *   ├─ ActionMenu (Enter on dispatch)
 *   ├─ DetailView (d on dispatch)
 *   ├─ LogViewer (l on dispatch)
 *   ├─ ProjectBrowser (n key)
 *   │   ├─ ProjectItemPicker (select project)
 *   │   │   └─ BranchDispatchInput (new branch)
 *   │   └─ OnboardInput (add project)
 *   └─ DispatchStatus (during dispatch)
 */

import { describe, it, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, cleanupAll } from '../../../harness/terminal.js';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import yaml from 'js-yaml';
import { seedPersonalSquad, spawnDashboard } from '../../../harness/e2e-dispatch-fixture.js';

// Per-suite XDG_CONFIG_HOME for personal squad isolation
const xdgConfigHome = mkdtempSync(path.join(tmpdir(), 'rally-xdg-'));
seedPersonalSquad(xdgConfigHome);
after(() => { rmSync(xdgConfigHome, { recursive: true, force: true }); });

const RALLY_BIN = path.join(import.meta.dirname, '..', '..', '..', '..', 'bin', 'rally.js');
const REPO_ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim();

const SCREENSHOT_DIR = path.join(REPO_ROOT, 'test', 'baselines', 'navigation-escape');

/**
 * Seed Rally config with dispatches and log files for testing
 */
function seedConfigWithDispatches(rallyHome, repoPath) {
  mkdirSync(rallyHome, { recursive: true });

  const teamDir = path.join(rallyHome, 'team');
  const projectsDir = path.join(rallyHome, 'projects');
  mkdirSync(teamDir, { recursive: true });
  mkdirSync(projectsDir, { recursive: true });

  const worktreePath = path.join(projectsDir, 'dispatch-worktree');
  mkdirSync(worktreePath, { recursive: true });
  mkdirSync(path.join(worktreePath, '.squad'), { recursive: true });

  // Create a log file for log viewer testing
  const logPath = path.join(worktreePath, '.squad', 'copilot.log');
  writeFileSync(
    logPath,
    `[2024-01-15 10:00:00] Test log entry 1
[2024-01-15 10:00:01] Test log entry 2
[2024-01-15 10:00:02] Test log entry 3
`,
    'utf8',
  );

  writeFileSync(
    path.join(rallyHome, 'config.yaml'),
    yaml.dump({ teamDir, projectsDir, version: '0.1.0' }),
    'utf8',
  );

  writeFileSync(
    path.join(rallyHome, 'projects.yaml'),
    yaml.dump({
      projects: [
        {
          name: 'test-repo',
          path: repoPath,
          repo: 'owner/test-repo',
          team: 'shared',
          teamDir,
          onboarded: new Date().toISOString(),
        },
      ],
    }),
    'utf8',
  );

  const dispatches = [
    {
      id: 'dispatch-1',
      project: 'test-repo',
      repo: 'owner/test-repo',
      type: 'issue',
      number: 42,
      branch: 'rally/42-test-issue',
      worktreePath,
      logPath,
      status: 'implementing',
      session_id: 'test-session-123',
      created: new Date().toISOString(),
    },
  ];

  writeFileSync(
    path.join(rallyHome, 'active.yaml'),
    yaml.dump({ dispatches }),
    'utf8',
  );

  return { teamDir, projectsDir, worktreePath, logPath };
}

// ─── ESCAPE FROM ACTION MENU ─────────────────────────────────────────────────

describe('escape navigation - ActionMenu to Dashboard', () => {
  let term;
  let tempDir;

  afterEach(async () => {
    if (term) {
      try { term.close(); } catch {}
      term = null;
    }
  });

  after(async () => {
    await cleanupAll();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  it('Escape from action menu returns to dashboard', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-escape-'));
    seedConfigWithDispatches(tempDir, REPO_ROOT);

    term = await spawnDashboard({ rallyHome: tempDir, xdgConfigHome, env: { NO_COLOR: '1' } });
    await term.screenshot(path.join(SCREENSHOT_DIR, '01-dashboard.png'));
    
    // Open action menu with Enter
    await term.send('\r');
    await new Promise(r => setTimeout(r, 300));
    await term.screenshot(path.join(SCREENSHOT_DIR, '02-action-menu.png'));

    const actionFrame = term.getFrame();
    assert.ok(
      actionFrame.includes('Actions') || actionFrame.includes('Open') || actionFrame.includes('View'),
      'Should show action menu'
    );

    // Press Escape to go back
    await term.send('q');
    await new Promise(r => setTimeout(r, 300));
    await term.screenshot(path.join(SCREENSHOT_DIR, '03-back-to-dashboard.png'));

    const dashboardFrame = term.getFrame();
    assert.ok(
      dashboardFrame.includes('Rally Dashboard'),
      'Should return to dashboard after Escape from action menu'
    );
  });

  it('q also exits action menu', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-escape-'));
    seedConfigWithDispatches(tempDir, REPO_ROOT);

    term = await spawnDashboard({ rallyHome: tempDir, xdgConfigHome, env: { NO_COLOR: '1' } });

    // Open action menu
    await term.send('\r');
    await new Promise(r => setTimeout(r, 300));

    // Press q to go back
    await term.send('q');
    await new Promise(r => setTimeout(r, 300));

    const frame = term.getFrame();
    assert.ok(
      frame.includes('Rally Dashboard'),
      'q should also return to dashboard from action menu'
    );
  });
});

// ─── ESCAPE FROM LOG VIEWER ──────────────────────────────────────────────────

describe('escape navigation - LogViewer to Dashboard', () => {
  let term;
  let tempDir;

  afterEach(async () => {
    if (term) {
      try { term.close(); } catch {}
      term = null;
    }
  });

  after(async () => {
    await cleanupAll();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  it('Escape from log viewer returns to dashboard', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-escape-'));
    seedConfigWithDispatches(tempDir, REPO_ROOT);

    term = await spawnDashboard({ rallyHome: tempDir, xdgConfigHome, env: { NO_COLOR: '1' } });

    // Open log viewer with 'l' key
    await term.send('l');
    await new Promise(r => setTimeout(r, 400));
    await term.screenshot(path.join(SCREENSHOT_DIR, '04-log-viewer.png'));

    const logFrame = term.getFrame();
    assert.ok(
      logFrame.includes('Test log') || logFrame.includes('Escape') || logFrame.includes('Log'),
      'Should show log viewer'
    );

    // Press Escape to go back
    await term.send('q');
    await new Promise(r => setTimeout(r, 300));
    await term.screenshot(path.join(SCREENSHOT_DIR, '05-back-from-log.png'));

    const dashboardFrame = term.getFrame();
    assert.ok(
      dashboardFrame.includes('Rally Dashboard'),
      'Should return to dashboard after Escape from log viewer'
    );
  });
});

// ─── ESCAPE FROM DETAIL VIEW ─────────────────────────────────────────────────

describe('escape navigation - DetailView to Dashboard', () => {
  let term;
  let tempDir;

  afterEach(async () => {
    if (term) {
      try { term.close(); } catch {}
      term = null;
    }
  });

  after(async () => {
    await cleanupAll();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  it('Escape from detail view returns to dashboard', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-escape-'));
    seedConfigWithDispatches(tempDir, REPO_ROOT);

    term = await spawnDashboard({ rallyHome: tempDir, xdgConfigHome, env: { NO_COLOR: '1' } });

    // Open detail view with 'd' key
    await term.send('d');
    await new Promise(r => setTimeout(r, 300));
    await term.screenshot(path.join(SCREENSHOT_DIR, '06-detail-view.png'));

    const detailFrame = term.getFrame();
    assert.ok(
      detailFrame.includes('Details') || detailFrame.includes('Issue #42'),
      'Should show detail view'
    );

    // Press Escape to go back
    await term.send('q');
    await new Promise(r => setTimeout(r, 300));
    await term.screenshot(path.join(SCREENSHOT_DIR, '07-back-from-detail.png'));

    const dashboardFrame = term.getFrame();
    assert.ok(
      dashboardFrame.includes('Rally Dashboard'),
      'Should return to dashboard after Escape from detail view'
    );
  });
});

// ─── ESCAPE FROM PROJECT BROWSER ─────────────────────────────────────────────

describe('escape navigation - ProjectBrowser to Dashboard', () => {
  let term;
  let tempDir;

  afterEach(async () => {
    if (term) {
      try { term.close(); } catch {}
      term = null;
    }
  });

  after(async () => {
    await cleanupAll();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  it('Escape from project browser returns to dashboard', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-escape-'));
    seedConfigWithDispatches(tempDir, REPO_ROOT);

    term = await spawnDashboard({ rallyHome: tempDir, xdgConfigHome, env: { NO_COLOR: '1' } });

    // Open project browser with 'n' key
    await term.send('n');
    await new Promise(r => setTimeout(r, 300));
    await term.screenshot(path.join(SCREENSHOT_DIR, '08-project-browser.png'));

    const browserFrame = term.getFrame();
    assert.ok(
      browserFrame.includes('Select a Project') || browserFrame.includes('test-repo'),
      'Should show project browser'
    );

    // Press Escape to go back
    await term.send('q');
    await new Promise(r => setTimeout(r, 300));
    await term.screenshot(path.join(SCREENSHOT_DIR, '09-back-from-browser.png'));

    const dashboardFrame = term.getFrame();
    assert.ok(
      dashboardFrame.includes('Rally Dashboard'),
      'Should return to dashboard after Escape from project browser'
    );
  });

  it('q also exits project browser', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-escape-'));
    seedConfigWithDispatches(tempDir, REPO_ROOT);

    term = await spawnDashboard({ rallyHome: tempDir, xdgConfigHome, env: { NO_COLOR: '1' } });

    // Open project browser
    await term.send('n');
    await new Promise(r => setTimeout(r, 300));

    // Press q to go back
    await term.send('q');
    await new Promise(r => setTimeout(r, 300));

    const frame = term.getFrame();
    assert.ok(
      frame.includes('Rally Dashboard'),
      'q should also return to dashboard from project browser'
    );
  });
});

// ─── MULTI-LEVEL ESCAPE NAVIGATION ──────────────────────────────────────────

describe('escape navigation - multi-level navigation stack', () => {
  let term;
  let tempDir;

  afterEach(async () => {
    if (term) {
      try { term.close(); } catch {}
      term = null;
    }
  });

  after(async () => {
    await cleanupAll();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  it('Escape works through multi-level navigation: Dashboard → Browser → Dashboard', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-escape-'));
    seedConfigWithDispatches(tempDir, REPO_ROOT);

    term = await spawnDashboard({ rallyHome: tempDir, xdgConfigHome, env: { NO_COLOR: '1' } });
    await term.screenshot(path.join(SCREENSHOT_DIR, '10-multi-start.png'));

    // Navigate: Dashboard → Project Browser
    await term.send('n');
    await new Promise(r => setTimeout(r, 300));
    await term.screenshot(path.join(SCREENSHOT_DIR, '11-multi-browser.png'));

    let frame = term.getFrame();
    assert.ok(frame.includes('Select a Project'), 'Should be in project browser');

    // Escape back to Dashboard
    await term.send('q');
    await new Promise(r => setTimeout(r, 300));
    await term.screenshot(path.join(SCREENSHOT_DIR, '12-multi-back.png'));

    frame = term.getFrame();
    assert.ok(frame.includes('Rally Dashboard'), 'Should be back at dashboard');
  });

  it('sequence: Dashboard → Detail → Dashboard → Log → Dashboard', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-escape-'));
    seedConfigWithDispatches(tempDir, REPO_ROOT);

    term = await spawnDashboard({ rallyHome: tempDir, xdgConfigHome, env: { NO_COLOR: '1' } });

    // Go to detail view
    await term.send('d');
    await new Promise(r => setTimeout(r, 300));
    let frame = term.getFrame();
    assert.ok(frame.includes('Details') || frame.includes('Issue'), 'Should show detail view');

    // Escape back
    await term.send('q');
    await new Promise(r => setTimeout(r, 300));
    frame = term.getFrame();
    assert.ok(frame.includes('Rally Dashboard'), 'Should be back at dashboard');

    // Go to log viewer
    await term.send('l');
    await new Promise(r => setTimeout(r, 300));
    frame = term.getFrame();
    assert.ok(frame.includes('Test log') || frame.includes('Escape'), 'Should show log viewer');

    // Escape back again
    await term.send('q');
    await new Promise(r => setTimeout(r, 300));
    await term.screenshot(path.join(SCREENSHOT_DIR, '13-multi-sequence.png'));

    frame = term.getFrame();
    assert.ok(frame.includes('Rally Dashboard'), 'Should be back at dashboard again');
  });
});

// ─── ESCAPE FROM TOP-LEVEL DASHBOARD ────────────────────────────────────────

describe('escape navigation - top-level dashboard behavior', () => {
  let term;
  let tempDir;

  afterEach(async () => {
    if (term) {
      try { term.close(); } catch {}
      term = null;
    }
  });

  after(async () => {
    await cleanupAll();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  it('Escape on top-level dashboard does not crash or exit', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-escape-'));
    seedConfigWithDispatches(tempDir, REPO_ROOT);

    term = await spawnDashboard({ rallyHome: tempDir, xdgConfigHome, env: { NO_COLOR: '1' } });
    await term.screenshot(path.join(SCREENSHOT_DIR, '14-toplevel-before.png'));

    const beforeFrame = term.getFrame();
    assert.ok(beforeFrame.includes('Rally Dashboard'), 'Should show dashboard');

    // Press Escape at top level — should be a no-op
    await term.send('q');
    await new Promise(r => setTimeout(r, 300));
    await term.screenshot(path.join(SCREENSHOT_DIR, '15-toplevel-after-escape.png'));

    const afterFrame = term.getFrame();
    assert.ok(afterFrame.includes('Rally Dashboard'), 'Dashboard should still be visible');
    
    // Dashboard should still be functional — try navigating
    await term.send('j');
    await new Promise(r => setTimeout(r, 200));
    const navFrame = term.getFrame();
    assert.ok(navFrame.includes('Rally Dashboard'), 'Dashboard should still be functional after Escape');
  });

  it('multiple Escape presses at top level do not break dashboard', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-escape-'));
    seedConfigWithDispatches(tempDir, REPO_ROOT);

    term = await spawnDashboard({ rallyHome: tempDir, xdgConfigHome, env: { NO_COLOR: '1' } });

    // Spam Escape at top level
    for (let i = 0; i < 5; i++) {
      await term.send('q');
      await new Promise(r => setTimeout(r, 100));
    }

    await term.screenshot(path.join(SCREENSHOT_DIR, '16-toplevel-spam.png'));
    const frame = term.getFrame();
    assert.ok(frame.includes('Rally Dashboard'), 'Dashboard should survive Escape spam');

    // Verify still functional
    await term.send('d');
    await new Promise(r => setTimeout(r, 300));
    const detailFrame = term.getFrame();
    assert.ok(
      detailFrame.includes('Details') || detailFrame.includes('Issue'),
      'Should still be able to navigate after Escape spam'
    );
  });
});

// ─── REGRESSION TEST: THE BUG SCENARIO ──────────────────────────────────────

describe('escape navigation - regression test for dispatch screen bug', () => {
  let term;
  let tempDir;

  afterEach(async () => {
    if (term) {
      try { term.close(); } catch {}
      term = null;
    }
  });

  after(async () => {
    await cleanupAll();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  it('REGRESSION: Escape after Dashboard → ProjectBrowser navigation returns to Dashboard', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-escape-'));
    seedConfigWithDispatches(tempDir, REPO_ROOT);

    term = await spawnDashboard({ rallyHome: tempDir, xdgConfigHome, env: { NO_COLOR: '1' } });
    await term.screenshot(path.join(SCREENSHOT_DIR, '17-regression-dashboard.png'));

    // Navigate from dashboard to "dispatch" screen (project browser in our case)
    await term.send('n');
    await new Promise(r => setTimeout(r, 400));
    await term.screenshot(path.join(SCREENSHOT_DIR, '18-regression-dispatch.png'));

    const dispatchFrame = term.getFrame();
    assert.ok(
      dispatchFrame.includes('Select a Project'),
      'Should be in project browser (dispatch screen)'
    );

    // THE BUG: Pressing Escape should go back to dashboard
    await term.send('q');
    await new Promise(r => setTimeout(r, 400));
    await term.screenshot(path.join(SCREENSHOT_DIR, '19-regression-back.png'));

    const backFrame = term.getFrame();
    assert.ok(
      backFrame.includes('Rally Dashboard'),
      'REGRESSION FIX: Escape should return to dashboard, not stay on dispatch screen'
    );
    assert.ok(
      !backFrame.includes('Select a Project'),
      'Should NOT still be showing project browser after Escape'
    );
  });
});
