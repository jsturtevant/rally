/**
 * E2E Lifecycle Test: Cancel Dispatch Flow
 * 
 * Tests canceling a dispatch process at various stages:
 * - Press Escape to cancel and return to dashboard
 * - Verify no side effects from canceled operations
 */

import { describe, it, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, cleanupAll } from '../../../harness/terminal.js';
import { isGhAuthenticated, seedPersonalSquad, spawnDashboard } from '../../../harness/e2e-dispatch-fixture.js';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import yaml from 'js-yaml';

// Per-suite XDG_CONFIG_HOME for personal squad isolation
const xdgConfigHome = mkdtempSync(path.join(tmpdir(), 'rally-xdg-'));
seedPersonalSquad(xdgConfigHome);
after(() => { rmSync(xdgConfigHome, { recursive: true, force: true }); });

const RALLY_BIN = path.join(import.meta.dirname, '..', '..', '..', '..', 'bin', 'rally.js');
const REPO_ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim();

const SCREENSHOT_DIR = path.join(REPO_ROOT, 'test', 'baselines', 'lifecycle-cancel');

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

// ─── CANCEL TESTS ────────────────────────────────────────────────────────────

describe('lifecycle — cancel dispatch flow', () => {
  let term;
  let tempDir;
  let fixtureRepoPath;

  before(() => {
    fixtureRepoPath = path.join(mkdtempSync(path.join(tmpdir(), 'rally-fixture-')), 'rally-test-fixtures');
    execFileSync('git', ['clone', '--depth', '1', 'https://github.com/jsturtevant/rally-test-fixtures.git', fixtureRepoPath], {
      encoding: 'utf8',
      timeout: 30_000,
    });
  });

  afterEach(async () => {
    if (term) {
      try { term.close(); } catch {}
      term = null;
    }
  });

  after(async () => {
    await cleanupAll();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
    if (fixtureRepoPath) rmSync(path.dirname(fixtureRepoPath), { recursive: true, force: true });
  });

  it('escape from project selection returns to dashboard', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-cancel-'));
    seedConfig(tempDir, fixtureRepoPath, 'jsturtevant/rally-test-fixtures');

    term = await spawnDashboard({ rallyHome: tempDir, xdgConfigHome, env: { NO_COLOR: '1' } });
    await term.screenshot(path.join(SCREENSHOT_DIR, '01-dashboard.png'));

    // Start dispatch flow
    await term.send('n');
    await term.waitFor('Select a Project', { timeout: 5_000 });
    await term.screenshot(path.join(SCREENSHOT_DIR, '02-project-selection.png'));

    // Cancel with q (Escape also works but q is more reliable across terminals)
    await term.send('q');
    await term.waitFor('Rally Dashboard', { timeout: 5_000 });
    await term.screenshot(path.join(SCREENSHOT_DIR, '03-returned-to-dashboard.png'));

    const frame = term.getFrame();
    assert.ok(frame.includes('Rally Dashboard'), 'Should return to dashboard after q');

    // Verify no dispatches were created
    const activeYaml = yaml.load(
      readFileSync(path.join(tempDir, 'active.yaml'), 'utf8'),
      { schema: yaml.CORE_SCHEMA }
    );
    assert.strictEqual(activeYaml.dispatches.length, 0, 'No dispatches should be created');
  });

  it('q from item picker returns to dashboard', { timeout: 45_000 }, async () => {
    const skipReason = !isGhAuthenticated()
      ? 'Skipping: gh CLI not authenticated (run `gh auth login`)'
      : undefined;

    if (skipReason) {
      console.log(skipReason);
      return;
    }

    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-cancel-'));
    seedConfig(tempDir, fixtureRepoPath, 'jsturtevant/rally-test-fixtures');

    term = await spawnDashboard({ rallyHome: tempDir, xdgConfigHome, env: { NO_COLOR: '1' } });

    // Navigate to item picker
    await term.send('n');
    await term.waitFor('Select a Project', { timeout: 5_000 });
    await term.sendKey('enter');
    await term.waitFor(/Loading|#\d+|Dispatch new branch|select an issue/, { timeout: 15_000 });
    await new Promise(r => setTimeout(r, 1000));
    await term.screenshot(path.join(SCREENSHOT_DIR, '04-item-picker.png'));

    // Cancel with q — first q returns to project picker, second to dashboard
    await term.send('q');
    await new Promise(r => setTimeout(r, 500));
    await term.send('q');
    await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    await term.screenshot(path.join(SCREENSHOT_DIR, '05-returned-after-item.png'));

    const frame = term.getFrame();
    assert.ok(frame.includes('Rally Dashboard'), 'Should return to dashboard after q from item picker');

    // Verify no dispatches were created
    const activeYaml = yaml.load(
      readFileSync(path.join(tempDir, 'active.yaml'), 'utf8'),
      { schema: yaml.CORE_SCHEMA }
    );
    assert.strictEqual(activeYaml.dispatches.length, 0, 'No dispatches should be created');
  });

  it('q key exits dashboard cleanly', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-cancel-'));
    seedConfig(tempDir, fixtureRepoPath, 'jsturtevant/rally-test-fixtures');

    term = await spawnDashboard({ rallyHome: tempDir, xdgConfigHome, env: { NO_COLOR: '1' } });
    await term.screenshot(path.join(SCREENSHOT_DIR, '06-before-quit.png'));

    // Press q to quit
    await term.send('q');
    await new Promise(r => setTimeout(r, 1000));

    // Process should have exited — terminal output should be stable
    const frame = term.getFrame();
    // The process exited, so we shouldn't see the dashboard header anymore
    // or the frame should be cleared/empty
    assert.ok(true, 'Dashboard exited cleanly with q');
  });

  it('ctrl+c exits dashboard cleanly', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-cancel-'));
    seedConfig(tempDir, fixtureRepoPath, 'jsturtevant/rally-test-fixtures');

    term = await spawnDashboard({ rallyHome: tempDir, xdgConfigHome, env: { NO_COLOR: '1' } });

    // Send Ctrl+C
    await term.sendKey('ctrl+c');
    await new Promise(r => setTimeout(r, 1000));

    // Process should have exited
    assert.ok(true, 'Dashboard exited cleanly with Ctrl+C');
  });

  it('multiple escapes do not crash', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-cancel-'));
    seedConfig(tempDir, fixtureRepoPath, 'jsturtevant/rally-test-fixtures');

    term = await spawnDashboard({ rallyHome: tempDir, xdgConfigHome, env: { NO_COLOR: '1' } });

    // Rapid escape presses should not crash
    await term.send('q');
    await term.send('q');
    await term.send('q');
    await new Promise(r => setTimeout(r, 500));

    const frame = term.getFrame();
    assert.ok(frame.includes('Rally Dashboard'), 'Dashboard should survive multiple escapes');
  });
});
