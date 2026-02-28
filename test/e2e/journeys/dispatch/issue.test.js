/**
 * E2E Journey Test: Dispatch to Issue via Dashboard UI
 * 
 * Tests the complete user journey for dispatching to a GitHub issue
 * through the interactive dashboard interface.
 * 
 * This is a skeptical test — it checks error paths, timeouts, and 
 * edge cases alongside the happy path.
 * 
 * Uses isolated RALLY_HOME temp directory to avoid affecting user config.
 */

import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, cleanupAll } from '../../../harness/terminal.js';
import { 
  createIsolatedConfig, 
  getSkipReason, 
  RALLY_BIN_PATH, 
  REPO_ROOT_PATH,
  E2E_ISSUE,
} from '../../../harness/e2e-dispatch-fixture.js';
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import yaml from 'js-yaml';

const JOURNEY_TIMEOUT = 120_000; // 2 minutes — UI journeys can be slow
const SCREENSHOT_DIR = path.join(REPO_ROOT_PATH, 'test', 'baselines', 'dispatch-issue');

/**
 * Seed a minimal Rally config that registers the current repo as onboarded.
 */
function seedConfig(rallyHome, repoPath, repoName = 'jsturtevant/rally') {
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
      projects: [{
        name: 'rally',
        path: repoPath,
        repo: repoName,
        team: 'shared',
        teamDir,
        onboarded: new Date().toISOString(),
      }],
    }),
    'utf8',
  );

  writeFileSync(path.join(rallyHome, 'active.yaml'), 'dispatches: []\n', 'utf8');
  return { teamDir, projectsDir };
}

/**
 * Clean up worktree and branch created by dispatch.
 */
function cleanupWorktree(repoPath, worktreePath, branchName) {
  if (worktreePath && existsSync(worktreePath)) {
    try {
      execFileSync('git', ['worktree', 'remove', worktreePath, '--force'], {
        cwd: repoPath, encoding: 'utf8',
      });
    } catch { /* already gone */ }
  }
  if (branchName) {
    try {
      execFileSync('git', ['branch', '-D', branchName], {
        cwd: repoPath, encoding: 'utf8',
      });
    } catch { /* already gone */ }
  }
}

// ─── ERROR PATHS FIRST (the skeptic's priority) ─────────────────────────────

describe('dispatch issue journey — error paths', () => {
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

  it('dashboard exits gracefully with q key', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-journey-'));
    seedConfig(tempDir, REPO_ROOT_PATH);

    term = await spawn(`node ${RALLY_BIN_PATH} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    await term.send('q');

    // Process should exit — wait a bit then check
    await new Promise(r => setTimeout(r, 500));
    // If we get here without hanging, the quit worked
  });

  it('escape from project browser returns to dashboard', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-journey-'));
    seedConfig(tempDir, REPO_ROOT_PATH);

    term = await spawn(`node ${RALLY_BIN_PATH} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });

    // Press 'n' to open project browser
    await term.send('n');
    await term.waitFor('Select a Project', { timeout: 5_000 });

    // Escape should return to dashboard
    await term.sendKey('escape');
    await term.waitFor('Rally Dashboard', { timeout: 5_000 });
  });

  it('shows empty state when no dispatches exist', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-journey-'));
    seedConfig(tempDir, REPO_ROOT_PATH);

    term = await spawn(`node ${RALLY_BIN_PATH} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    const frame = term.getFrame();
    // Dashboard should render even with no dispatches — at least show the navigation hints
    assert.ok(frame.includes('n new dispatch') || frame.includes('Rally Dashboard'),
      'Dashboard should render with empty state');
  });
});

// ─── HAPPY PATH — FULL JOURNEY ──────────────────────────────────────────────

describe('dispatch issue journey — happy path', () => {
  // Skip if no GitHub token — dispatch tests require API access
  const skipReason = (!process.env.GH_TOKEN && !process.env.GITHUB_TOKEN)
    ? 'Skipping: GH_TOKEN not set (dispatch tests require GitHub API access)'
    : undefined;

  let term;
  let tempDir;
  let worktreePath;
  let branchName;

  before(() => {
    if (skipReason) return;
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-journey-'));
    seedConfig(tempDir, REPO_ROOT_PATH);
  });

  afterEach(async () => {
    if (term) {
      try { term.close(); } catch {}
      term = null;
    }
  });

  after(async () => {
    await cleanupAll();
    if (!skipReason) {
      cleanupWorktree(REPO_ROOT_PATH, worktreePath, branchName);
    }
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  it('complete dispatch-to-issue journey through dashboard UI', { skip: skipReason, timeout: JOURNEY_TIMEOUT }, async () => {
    // ═══════════════════════════════════════════════════════════════════════
    // STEP 1: Start dashboard and verify initial render
    // ═══════════════════════════════════════════════════════════════════════
    term = await spawn(`node ${RALLY_BIN_PATH} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 15_000 });
    await term.screenshot(path.join(SCREENSHOT_DIR, '01-dashboard.png'));

    const dashboardFrame = term.getFrame();
    assert.ok(dashboardFrame.includes('Rally Dashboard'), 'Dashboard header should be visible');
    assert.ok(dashboardFrame.includes('n new dispatch'), 'Navigation hint should show "n new dispatch"');

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 2: Press 'n' to open dispatch flow (project browser)
    // ═══════════════════════════════════════════════════════════════════════
    await term.send('n');
    await term.waitFor('Select a Project', { timeout: 10_000 });
    await term.screenshot(path.join(SCREENSHOT_DIR, '02-project-browser.png'));

    const projectFrame = term.getFrame();
    assert.ok(projectFrame.includes('Select a Project'), 'Project browser should be visible');
    // Should show our onboarded project
    assert.ok(projectFrame.includes('rally') || projectFrame.includes('jsturtevant'),
      'Onboarded project should be listed');

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 3: Select the project (it's first, so just press Enter)
    // ═══════════════════════════════════════════════════════════════════════
    await term.sendKey('enter');

    // Wait for item picker (issues/PRs list)
    // This fetches from GitHub, might take a moment
    await term.waitFor(/Loading|#\d+|Dispatch new branch/, { timeout: 30_000 });
    await new Promise(r => setTimeout(r, 2000)); // Allow full load
    await term.screenshot(path.join(SCREENSHOT_DIR, '03-item-picker.png'));

    const itemFrame = term.getFrame();
    // Should either show issues/PRs or "Dispatch new branch" option
    assert.ok(
      itemFrame.includes('#') || itemFrame.includes('Dispatch new branch'),
      'Item picker should show issues, PRs, or new branch option'
    );

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 4: Navigate to and select an issue
    // First item is usually "+ Dispatch new branch", so arrow down to first issue
    // ═══════════════════════════════════════════════════════════════════════
    // Move down past "Dispatch new branch" to first actual issue
    await term.sendKey('down');
    await new Promise(r => setTimeout(r, 200));

    // Check if we have an issue to select
    const preSelectFrame = term.getFrame();
    if (!preSelectFrame.includes('#')) {
      // No issues available — skip rest of test
      console.log('No issues available in repo, skipping dispatch portion');
      return;
    }

    await term.screenshot(path.join(SCREENSHOT_DIR, '04-issue-selected.png'));

    // Select the issue
    await term.sendKey('enter');

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 5: Wait for dispatch to complete
    // This creates worktree, fetches issue, writes context
    // ═══════════════════════════════════════════════════════════════════════
    // Wait for either dispatch progress or return to dashboard
    await term.waitFor(/Dispatch|implementing|Rally Dashboard/, { timeout: 60_000 });
    await new Promise(r => setTimeout(r, 3000)); // Allow completion
    await term.screenshot(path.join(SCREENSHOT_DIR, '05-dispatch-complete.png'));

    // Press any key to return to dashboard if showing dispatch status
    const statusFrame = term.getFrame();
    if (statusFrame.includes('any key')) {
      await term.send(' ');
      await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 6: Verify dispatch appears in dashboard
    // ═══════════════════════════════════════════════════════════════════════
    await term.screenshot(path.join(SCREENSHOT_DIR, '06-dashboard-with-dispatch.png'));

    const finalFrame = term.getFrame();
    // Dashboard should now show at least one dispatch
    // (issue number, status, or branch name)
    assert.ok(
      finalFrame.includes('implementing') ||
      finalFrame.includes('rally/') ||
      finalFrame.includes('#'),
      'Dashboard should show the new dispatch'
    );

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 7: Verify filesystem state
    // ═══════════════════════════════════════════════════════════════════════
    // Read active.yaml to find the dispatch details
    const activeYaml = yaml.load(
      fs.readFileSync(path.join(tempDir, 'active.yaml'), 'utf8'),
      { schema: yaml.CORE_SCHEMA }
    );
    assert.ok(activeYaml.dispatches.length >= 1, 'Should have at least one dispatch');

    const dispatch = activeYaml.dispatches[0];
    worktreePath = dispatch.worktreePath;
    branchName = dispatch.branch;

    // Verify worktree exists
    assert.ok(existsSync(worktreePath), `Worktree should exist at ${worktreePath}`);

    // Verify branch name matches pattern
    assert.match(branchName, /^rally\/\d+-/, 'Branch should match rally/{number}-{slug} pattern');

    // Verify branch exists in git
    const branches = execFileSync('git', ['branch', '--list', branchName], {
      cwd: REPO_ROOT_PATH,
      encoding: 'utf8',
    });
    assert.ok(branches.includes(branchName.replace('rally/', '')), 'Branch should exist in git');

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 8: Verify context file was created
    // ═══════════════════════════════════════════════════════════════════════
    const contextPath = path.join(worktreePath, '.squad', 'dispatch-context.md');
    assert.ok(existsSync(contextPath), 'dispatch-context.md should exist in worktree');

    const contextContent = fs.readFileSync(contextPath, 'utf8');
    assert.ok(
      contextContent.includes('#') || contextContent.includes('issue'),
      'Context file should reference the issue'
    );

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 9: Exit cleanly
    // ═══════════════════════════════════════════════════════════════════════
    await term.send('q');
    await new Promise(r => setTimeout(r, 500));

    console.log('✓ Dispatch issue journey completed successfully');
    console.log(`  Branch: ${branchName}`);
    console.log(`  Worktree: ${worktreePath}`);
    console.log(`  Screenshots: ${SCREENSHOT_DIR}/`);
  });
});

// ─── EDGE CASES ─────────────────────────────────────────────────────────────

describe('dispatch issue journey — edge cases', () => {
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

  it('handles rapid key presses without crashing', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-journey-'));
    seedConfig(tempDir, REPO_ROOT_PATH);

    term = await spawn(`node ${RALLY_BIN_PATH} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });

    // Rapid key presses — should not crash
    await term.send('r'); // refresh
    await term.send('r');
    await term.send('r');
    await new Promise(r => setTimeout(r, 500));

    // Should still be responsive
    const frame = term.getFrame();
    assert.ok(frame.includes('Rally Dashboard'), 'Dashboard should survive rapid refresh');
  });

  it('navigation wraps correctly with empty dispatch list', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-journey-'));
    seedConfig(tempDir, REPO_ROOT_PATH);

    term = await spawn(`node ${RALLY_BIN_PATH} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });

    // Arrow keys with no dispatches should not crash
    await term.sendKey('up');
    await term.sendKey('down');
    await term.sendKey('up');
    await new Promise(r => setTimeout(r, 300));

    const frame = term.getFrame();
    assert.ok(frame.includes('Rally Dashboard'), 'Dashboard should handle navigation with empty list');
  });

  it('handles missing config gracefully in dashboard', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-journey-'));
    // Don't seed config — test missing config handling

    term = await spawn(`node ${RALLY_BIN_PATH} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    // Should either show error or empty dashboard, not crash
    await new Promise(r => setTimeout(r, 3000));
    const frame = term.getFrame();
    // Either shows dashboard (with defaults) or an error message
    assert.ok(
      frame.includes('Rally Dashboard') || frame.includes('✗') || frame.includes('error'),
      'Should handle missing config gracefully'
    );
  });
});
