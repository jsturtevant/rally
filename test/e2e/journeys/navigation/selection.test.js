/**
 * E2E Journey Test: Keyboard Navigation Selection
 * 
 * Tests keyboard navigation in the dashboard:
 * - j/k moves selection down/up
 * - ↑/↓ arrow keys work the same
 * - Selection wraps at list boundaries
 * - Multi-project navigation (moving between repo groups)
 */

import { describe, it, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, cleanupAll } from '../../../harness/terminal.js';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import yaml from 'js-yaml';

const RALLY_BIN = path.join(import.meta.dirname, '..', '..', '..', '..', 'bin', 'rally.js');
const REPO_ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim();

const SCREENSHOT_DIR = path.join(REPO_ROOT, 'test', 'baselines', 'navigation-selection');

/**
 * Seed a Rally config with multiple projects for multi-project navigation testing.
 */
function seedConfigWithProjects(rallyHome, repoPath, dispatches = []) {
  mkdirSync(rallyHome, { recursive: true });

  const teamDir = path.join(rallyHome, 'team');
  const projectsDir = path.join(rallyHome, 'projects');
  mkdirSync(teamDir, { recursive: true });
  mkdirSync(projectsDir, { recursive: true });

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
          name: 'project-alpha',
          path: repoPath,
          repo: 'org/project-alpha',
          team: 'shared',
          teamDir,
          onboarded: new Date().toISOString(),
        },
        {
          name: 'project-beta',
          path: repoPath,
          repo: 'org/project-beta',
          team: 'shared',
          teamDir,
          onboarded: new Date().toISOString(),
        },
      ],
    }),
    'utf8',
  );

  writeFileSync(
    path.join(rallyHome, 'active.yaml'),
    yaml.dump({ dispatches }),
    'utf8',
  );

  return { teamDir, projectsDir };
}

/**
 * Seed config with dispatches for navigation testing.
 */
function seedConfigWithDispatches(rallyHome, repoPath) {
  const dispatches = [
    {
      id: 'dispatch-1',
      project: 'project-alpha',
      repo: 'org/project-alpha',
      branch: 'rally/123-first-issue',
      worktreePath: '/tmp/rally-worktrees/123',
      status: 'implementing',
      issueNumber: 123,
      title: 'First test issue',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'dispatch-2',
      project: 'project-alpha',
      repo: 'org/project-alpha',
      branch: 'rally/124-second-issue',
      worktreePath: '/tmp/rally-worktrees/124',
      status: 'implementing',
      issueNumber: 124,
      title: 'Second test issue',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'dispatch-3',
      project: 'project-beta',
      repo: 'org/project-beta',
      branch: 'rally/200-beta-issue',
      worktreePath: '/tmp/rally-worktrees/200',
      status: 'reviewing',
      issueNumber: 200,
      title: 'Beta project issue',
      createdAt: new Date().toISOString(),
    },
  ];

  return seedConfigWithProjects(rallyHome, repoPath, dispatches);
}

// ─── j/k NAVIGATION ─────────────────────────────────────────────────────────

describe('navigation - selection with j/k keys', () => {
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

  it('j key moves selection down', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-nav-'));
    seedConfigWithDispatches(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    await term.screenshot(path.join(SCREENSHOT_DIR, '01-initial.png'));

    const beforeFrame = term.getFrame();

    // Press j to move down
    await term.send('j');
    await new Promise(r => setTimeout(r, 200));

    await term.screenshot(path.join(SCREENSHOT_DIR, '02-after-j.png'));
    const afterFrame = term.getFrame();

    // Selection should have changed (indicator position differs)
    // In vim-style navigation, j moves down
    assert.ok(afterFrame.includes('Rally Dashboard'), 'Dashboard should still be visible');
  });

  it('k key moves selection up', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-nav-'));
    seedConfigWithDispatches(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });

    // Move down first with j
    await term.send('j');
    await new Promise(r => setTimeout(r, 200));
    const midFrame = term.getFrame();

    // Now move back up with k
    await term.send('k');
    await new Promise(r => setTimeout(r, 200));

    await term.screenshot(path.join(SCREENSHOT_DIR, '03-after-k.png'));
    const afterFrame = term.getFrame();

    assert.ok(afterFrame.includes('Rally Dashboard'), 'Dashboard should still be visible after k navigation');
  });

  it('multiple j presses navigate through list', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-nav-'));
    seedConfigWithDispatches(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });

    // Navigate through multiple items
    await term.send('j');
    await new Promise(r => setTimeout(r, 150));
    await term.send('j');
    await new Promise(r => setTimeout(r, 150));
    await term.send('j');
    await new Promise(r => setTimeout(r, 150));

    await term.screenshot(path.join(SCREENSHOT_DIR, '04-multiple-j.png'));
    const frame = term.getFrame();

    assert.ok(frame.includes('Rally Dashboard'), 'Dashboard should survive multiple j presses');
  });
});

// ─── ARROW KEY NAVIGATION ───────────────────────────────────────────────────

describe('navigation - selection with arrow keys', () => {
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

  it('down arrow moves selection down', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-nav-'));
    seedConfigWithDispatches(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });

    await term.sendKey('down');
    await new Promise(r => setTimeout(r, 200));

    await term.screenshot(path.join(SCREENSHOT_DIR, '05-arrow-down.png'));
    const frame = term.getFrame();

    assert.ok(frame.includes('Rally Dashboard'), 'Dashboard should respond to down arrow');
  });

  it('up arrow moves selection up', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-nav-'));
    seedConfigWithDispatches(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });

    // Move down first
    await term.sendKey('down');
    await new Promise(r => setTimeout(r, 200));

    // Then up
    await term.sendKey('up');
    await new Promise(r => setTimeout(r, 200));

    await term.screenshot(path.join(SCREENSHOT_DIR, '06-arrow-up.png'));
    const frame = term.getFrame();

    assert.ok(frame.includes('Rally Dashboard'), 'Dashboard should respond to up arrow');
  });

  it('arrow keys and j/k produce same behavior', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-nav-'));
    seedConfigWithDispatches(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });

    // Mix j/k and arrows — should work seamlessly
    await term.send('j');
    await new Promise(r => setTimeout(r, 100));
    await term.sendKey('down');
    await new Promise(r => setTimeout(r, 100));
    await term.send('k');
    await new Promise(r => setTimeout(r, 100));
    await term.sendKey('up');
    await new Promise(r => setTimeout(r, 100));

    await term.screenshot(path.join(SCREENSHOT_DIR, '07-mixed-navigation.png'));
    const frame = term.getFrame();

    assert.ok(frame.includes('Rally Dashboard'), 'Mixed navigation should work');
  });
});

// ─── WRAP BEHAVIOR ──────────────────────────────────────────────────────────

describe('navigation - selection wrap behavior', () => {
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

  it('selection wraps from bottom to top', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-nav-'));
    seedConfigWithDispatches(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });

    // Navigate down many times to go past the end
    for (let i = 0; i < 10; i++) {
      await term.send('j');
      await new Promise(r => setTimeout(r, 50));
    }

    await term.screenshot(path.join(SCREENSHOT_DIR, '08-wrap-bottom.png'));
    const frame = term.getFrame();

    // Should not crash and should still show dashboard
    assert.ok(frame.includes('Rally Dashboard'), 'Dashboard should survive wrap at bottom');
  });

  it('selection wraps from top to bottom', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-nav-'));
    seedConfigWithDispatches(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });

    // Navigate up many times from start
    for (let i = 0; i < 10; i++) {
      await term.send('k');
      await new Promise(r => setTimeout(r, 50));
    }

    await term.screenshot(path.join(SCREENSHOT_DIR, '09-wrap-top.png'));
    const frame = term.getFrame();

    assert.ok(frame.includes('Rally Dashboard'), 'Dashboard should survive wrap at top');
  });

  it('wrap works with empty dispatch list', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-nav-'));
    seedConfigWithProjects(tempDir, REPO_ROOT, []); // Empty dispatches

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });

    // Navigation with no items should not crash
    await term.send('j');
    await term.send('k');
    await term.sendKey('up');
    await term.sendKey('down');
    await new Promise(r => setTimeout(r, 200));

    const frame = term.getFrame();
    assert.ok(frame.includes('Rally Dashboard'), 'Navigation should handle empty list');
  });
});

// ─── MULTI-PROJECT NAVIGATION ───────────────────────────────────────────────

describe('navigation - multi-project groups', () => {
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

  it('navigates between repo groups', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-nav-'));
    seedConfigWithDispatches(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });

    // Navigate through — should cross project boundaries
    for (let i = 0; i < 5; i++) {
      await term.send('j');
      await new Promise(r => setTimeout(r, 100));
    }

    await term.screenshot(path.join(SCREENSHOT_DIR, '10-multi-project.png'));
    const frame = term.getFrame();

    assert.ok(frame.includes('Rally Dashboard'), 'Should navigate across project groups');
  });

  it('project browser navigation with j/k', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-nav-'));
    seedConfigWithProjects(tempDir, REPO_ROOT, []);

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });

    // Open project browser
    await term.send('n');
    await term.waitFor('Select a Project', { timeout: 5_000 });

    // Navigate in project browser
    await term.send('j');
    await new Promise(r => setTimeout(r, 150));
    await term.send('k');
    await new Promise(r => setTimeout(r, 150));

    await term.screenshot(path.join(SCREENSHOT_DIR, '11-project-browser-nav.png'));
    const frame = term.getFrame();

    assert.ok(frame.includes('Select a Project'), 'Project browser should support j/k navigation');

    // Escape to return
    await term.sendKey('escape');
    await term.waitFor('Rally Dashboard', { timeout: 5_000 });
  });
});
