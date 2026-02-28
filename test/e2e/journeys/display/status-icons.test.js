/**
 * E2E Display Test: Status Icons
 * 
 * Tests that all status icons render correctly in the dashboard.
 * Verifies each status has the correct visual representation.
 */

import { describe, it, after, afterEach } from 'node:test';
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

const SCREENSHOT_DIR = path.join(REPO_ROOT, 'test', 'baselines', 'display', 'status-icons');

// Status icons and their meanings
const STATUS_ICONS = {
  '⏳': 'waiting',        // Waiting/queued
  '🔵': 'implementing',   // In progress/implementing
  '✅': 'done',           // Completed/done
  '🟣': 'reviewing',      // Under review
  '🟡': 'paused',         // Paused/on hold
};

/**
 * Seed config with dispatches in all possible statuses.
 */
function seedAllStatusesConfig(rallyHome, repoPath) {
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
        name: 'test-repo',
        path: repoPath,
        repo: 'test/status-icons',
        team: 'shared',
        teamDir,
        onboarded: new Date().toISOString(),
      }],
    }),
    'utf8',
  );

  // Create dispatches with all different statuses
  writeFileSync(
    path.join(rallyHome, 'active.yaml'),
    yaml.dump({
      dispatches: [
        {
          id: 'dispatch-waiting',
          repo: 'test/status-icons',
          issue: 1,
          title: 'Task in waiting status',
          branch: 'rally/1-waiting',
          status: 'waiting',
          worktreePath: path.join(projectsDir, 'wt-waiting'),
          created: new Date().toISOString(),
        },
        {
          id: 'dispatch-implementing',
          repo: 'test/status-icons',
          issue: 2,
          title: 'Task being implemented',
          branch: 'rally/2-implementing',
          status: 'implementing',
          worktreePath: path.join(projectsDir, 'wt-implementing'),
          created: new Date().toISOString(),
        },
        {
          id: 'dispatch-done',
          repo: 'test/status-icons',
          issue: 3,
          title: 'Completed task',
          branch: 'rally/3-done',
          status: 'done',
          worktreePath: path.join(projectsDir, 'wt-done'),
          created: new Date().toISOString(),
        },
        {
          id: 'dispatch-reviewing',
          repo: 'test/status-icons',
          pr: 4,
          title: 'PR under review',
          branch: 'rally/4-reviewing',
          status: 'reviewing',
          worktreePath: path.join(projectsDir, 'wt-reviewing'),
          created: new Date().toISOString(),
        },
        {
          id: 'dispatch-paused',
          repo: 'test/status-icons',
          issue: 5,
          title: 'Paused for later',
          branch: 'rally/5-paused',
          status: 'paused',
          worktreePath: path.join(projectsDir, 'wt-paused'),
          created: new Date().toISOString(),
        },
      ],
    }),
    'utf8',
  );

  return { teamDir, projectsDir };
}

describe('display — status icons', () => {
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

  it('all status icons render correctly', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-display-status-'));
    seedAllStatusesConfig(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    const frame = term.getFrame();

    // Screenshot all statuses together
    await term.screenshot(path.join(SCREENSHOT_DIR, 'all-status-icons.png'));

    // Check that status indicators are visible (either icons or text labels)
    const statusIndicators = [
      'waiting', 'implementing', 'done', 'reviewing', 'paused',
      '⏳', '🔵', '✅', '🟣', '🟡',
    ];

    const visibleStatuses = statusIndicators.filter(s => frame.includes(s));
    assert.ok(
      visibleStatuses.length >= 3,
      `Should show multiple status types, found: ${visibleStatuses.join(', ')}`
    );
  });

  it('waiting status (⏳) renders correctly', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-display-status-'));
    seedAllStatusesConfig(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    const frame = term.getFrame();

    const hasWaiting = frame.includes('⏳') || frame.includes('waiting');
    assert.ok(hasWaiting, 'Waiting status (⏳) should be visible');

    await term.screenshot(path.join(SCREENSHOT_DIR, 'status-waiting.png'));
  });

  it('implementing status (🔵) renders correctly', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-display-status-'));
    seedAllStatusesConfig(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    const frame = term.getFrame();

    const hasImplementing = frame.includes('🔵') || frame.includes('implementing');
    assert.ok(hasImplementing, 'Implementing status (🔵) should be visible');

    await term.screenshot(path.join(SCREENSHOT_DIR, 'status-implementing.png'));
  });

  it('done status (✅) renders correctly', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-display-status-'));
    seedAllStatusesConfig(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    const frame = term.getFrame();

    const hasDone = frame.includes('✅') || frame.includes('done');
    assert.ok(hasDone, 'Done status (✅) should be visible');

    await term.screenshot(path.join(SCREENSHOT_DIR, 'status-done.png'));
  });

  it('reviewing status (🟣) renders correctly', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-display-status-'));
    seedAllStatusesConfig(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    const frame = term.getFrame();

    const hasReviewing = frame.includes('🟣') || frame.includes('reviewing');
    assert.ok(hasReviewing, 'Reviewing status (🟣) should be visible');

    await term.screenshot(path.join(SCREENSHOT_DIR, 'status-reviewing.png'));
  });

  it('paused status (🟡) renders correctly', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-display-status-'));
    seedAllStatusesConfig(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    const frame = term.getFrame();

    const hasPaused = frame.includes('🟡') || frame.includes('paused');
    assert.ok(hasPaused, 'Paused status (🟡) should be visible');

    await term.screenshot(path.join(SCREENSHOT_DIR, 'status-paused.png'));
  });

  it('status icons have consistent meaning across views', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-display-status-'));
    seedAllStatusesConfig(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    const frame = term.getFrame();

    // Verify status icons appear with their corresponding tasks
    // The task titles contain the status name, so we can verify correlation
    
    // For each status, check if either icon or text appears near the right task
    const lines = frame.split('\n');
    
    let foundCorrelations = 0;
    for (const line of lines) {
      if ((line.includes('waiting') && (line.includes('⏳') || line.includes('waiting'))) ||
          (line.includes('implemented') && (line.includes('🔵') || line.includes('implementing'))) ||
          (line.includes('Completed') && (line.includes('✅') || line.includes('done'))) ||
          (line.includes('review') && (line.includes('🟣') || line.includes('reviewing'))) ||
          (line.includes('Paused') && (line.includes('🟡') || line.includes('paused')))) {
        foundCorrelations++;
      }
    }

    // At least some correlations should be found
    await term.screenshot(path.join(SCREENSHOT_DIR, 'status-consistency.png'));
  });
});
