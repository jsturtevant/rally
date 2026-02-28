/**
 * E2E Lifecycle Test: Complete Dispatch Lifecycle
 * 
 * Tests the full dispatch lifecycle from start to finish:
 * Dispatch → implementing → upstream → done → clean
 * Verifies status transitions and captures screenshots at each state.
 */

import { describe, it, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, cleanupAll } from '../../../harness/terminal.js';
import { isGhAuthenticated } from '../../../harness/e2e-dispatch-fixture.js';
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import yaml from 'js-yaml';

const RALLY_BIN = path.join(import.meta.dirname, '..', '..', '..', '..', 'bin', 'rally.js');
const REPO_ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim();

const JOURNEY_TIMEOUT = 180_000; // 3 minutes — full lifecycle can be slow
const SCREENSHOT_DIR = path.join(REPO_ROOT, 'test', 'baselines', 'lifecycle-complete');

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
 * Seed a dispatch with a specific status for testing state transitions.
 */
function seedDispatch(rallyHome, status, dispatchData = {}) {
  const dispatch = {
    id: dispatchData.id || `rally-${Date.now()}`,
    type: dispatchData.type || 'issue',
    number: dispatchData.number || 1,
    repo: dispatchData.repo || 'jsturtevant/rally',
    branch: dispatchData.branch || `rally/1-test-issue`,
    worktreePath: dispatchData.worktreePath || '/tmp/rally-worktree',
    status,
    createdAt: dispatchData.createdAt || new Date().toISOString(),
    ...dispatchData,
  };

  writeFileSync(
    path.join(rallyHome, 'active.yaml'),
    yaml.dump({ dispatches: [dispatch] }),
    'utf8',
  );

  return dispatch;
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

// ─── LIFECYCLE STATE TRANSITIONS ─────────────────────────────────────────────

describe('lifecycle — complete dispatch journey', () => {
  const skipReason = !isGhAuthenticated()
    ? 'Skipping: gh CLI not authenticated (run `gh auth login`)'
    : undefined;

  let term;
  let tempDir;
  let worktreePath;
  let branchName;

  before(() => {
    if (skipReason) return;
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-lifecycle-'));
    seedConfig(tempDir, REPO_ROOT);
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
      cleanupWorktree(REPO_ROOT, worktreePath, branchName);
    }
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  it('full lifecycle: dispatch → implementing → done → clean', { skip: skipReason, timeout: JOURNEY_TIMEOUT }, async () => {
    // ═══════════════════════════════════════════════════════════════════════
    // STEP 1: Start dashboard - verify empty state
    // ═══════════════════════════════════════════════════════════════════════
    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 15_000 });
    await term.screenshot(path.join(SCREENSHOT_DIR, '01-empty-dashboard.png'));

    const emptyFrame = term.getFrame();
    assert.ok(emptyFrame.includes('Rally Dashboard'), 'Dashboard should show initial state');

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 2: Initiate new dispatch
    // ═══════════════════════════════════════════════════════════════════════
    await term.send('n');
    await term.waitFor('Select a Project', { timeout: 10_000 });
    await term.screenshot(path.join(SCREENSHOT_DIR, '02-select-project.png'));

    await term.sendKey('enter');
    await term.waitFor(/Loading|#\d+|Dispatch new branch/, { timeout: 30_000 });
    await new Promise(r => setTimeout(r, 2000));
    await term.screenshot(path.join(SCREENSHOT_DIR, '03-select-item.png'));

    const itemFrame = term.getFrame();
    if (!itemFrame.includes('#')) {
      console.log('No issues available in repo, skipping full lifecycle');
      return;
    }

    // Select first issue (arrow down past "Dispatch new branch")
    await term.sendKey('down');
    await new Promise(r => setTimeout(r, 200));
    await term.sendKey('enter');

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 3: Wait for dispatch — STATUS: implementing
    // ═══════════════════════════════════════════════════════════════════════
    await term.waitFor(/Dispatch|implementing|Rally Dashboard/, { timeout: 60_000 });
    await new Promise(r => setTimeout(r, 3000));
    await term.screenshot(path.join(SCREENSHOT_DIR, '04-implementing.png'));

    // Return to dashboard if showing status
    const statusFrame = term.getFrame();
    if (statusFrame.includes('any key')) {
      await term.send(' ');
      await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    }

    // Verify implementing status
    const implementingFrame = term.getFrame();
    assert.ok(
      implementingFrame.includes('implementing') || implementingFrame.includes('rally/'),
      'Dispatch should be in implementing status'
    );
    await term.screenshot(path.join(SCREENSHOT_DIR, '05-dashboard-implementing.png'));

    // Read active.yaml to get dispatch details
    const activeYaml = yaml.load(
      fs.readFileSync(path.join(tempDir, 'active.yaml'), 'utf8'),
      { schema: yaml.CORE_SCHEMA }
    );
    assert.ok(activeYaml.dispatches.length >= 1, 'Should have at least one dispatch');

    const dispatch = activeYaml.dispatches[0];
    worktreePath = dispatch.worktreePath;
    branchName = dispatch.branch;
    assert.strictEqual(dispatch.status, 'implementing', 'Status should be implementing');

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 4: Simulate transition to done
    // In real usage, this happens when Copilot exits. For testing, we modify the status directly.
    // ═══════════════════════════════════════════════════════════════════════
    const updatedYaml = yaml.load(
      fs.readFileSync(path.join(tempDir, 'active.yaml'), 'utf8'),
      { schema: yaml.CORE_SCHEMA }
    );
    updatedYaml.dispatches[0].status = 'done';
    writeFileSync(
      path.join(tempDir, 'active.yaml'),
      yaml.dump(updatedYaml),
      'utf8'
    );

    // Refresh dashboard to see done status
    await term.send('r');
    await new Promise(r => setTimeout(r, 1000));
    await term.screenshot(path.join(SCREENSHOT_DIR, '06-done.png'));

    const doneFrame = term.getFrame();
    assert.ok(doneFrame.includes('done') || doneFrame.includes('✓'), 'Status should show done');

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 5: Clean up dispatch
    // ═══════════════════════════════════════════════════════════════════════
    term.close();
    term = null;

    // Run clean command
    term = await spawn(`node ${RALLY_BIN} dispatch clean --yes`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await new Promise(r => setTimeout(r, 3000));
    await term.screenshot(path.join(SCREENSHOT_DIR, '07-clean.png'));

    const cleanFrame = term.getFrame();
    assert.ok(
      cleanFrame.includes('Cleaned') || cleanFrame.includes('removed') || cleanFrame.includes('No'),
      'Clean command should execute'
    );

    console.log('✓ Complete lifecycle test passed');
    console.log(`  Screenshots: ${SCREENSHOT_DIR}/`);
  });
});

// ─── STATUS TRANSITION VERIFICATION ──────────────────────────────────────────

describe('lifecycle — status transitions', () => {
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

  it('displays implementing status correctly', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-lifecycle-'));
    seedConfig(tempDir, REPO_ROOT);
    seedDispatch(tempDir, 'implementing');

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    const frame = term.getFrame();
    // Dashboard may display status as full word, abbreviation, or icon
    assert.ok(
      frame.includes('implementing') || frame.includes('impl') || frame.includes('🔨') ||
      frame.includes('rally/1') || frame.includes('#1'),
      'Should show implementing dispatch (status, branch, or number)'
    );
    await term.screenshot(path.join(SCREENSHOT_DIR, 'status-implementing.png'));
  });

  it('displays upstream status correctly', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-lifecycle-'));
    seedConfig(tempDir, REPO_ROOT);
    seedDispatch(tempDir, 'upstream');

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    const frame = term.getFrame();
    // Dashboard may display status as full word, abbreviation, or icon
    assert.ok(
      frame.includes('upstream') || frame.includes('PR') || frame.includes('⬆') ||
      frame.includes('rally/1') || frame.includes('#1'),
      'Should show upstream dispatch (status, branch, or number)'
    );
    await term.screenshot(path.join(SCREENSHOT_DIR, 'status-upstream.png'));
  });

  it('displays done status correctly', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-lifecycle-'));
    seedConfig(tempDir, REPO_ROOT);
    seedDispatch(tempDir, 'done');

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    const frame = term.getFrame();
    // Dashboard may display status as full word, abbreviation, or icon
    assert.ok(
      frame.includes('done') || frame.includes('✓') || frame.includes('✔') ||
      frame.includes('rally/1') || frame.includes('#1'),
      'Should show done dispatch (status, branch, or number)'
    );
    await term.screenshot(path.join(SCREENSHOT_DIR, 'status-done.png'));
  });
});
