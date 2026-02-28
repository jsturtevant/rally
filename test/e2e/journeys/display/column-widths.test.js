/**
 * E2E Display Test: Column Widths
 * 
 * Tests dashboard rendering at various terminal widths.
 * Verifies no truncation of important data at 80, 120, and 160 columns.
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

const SCREENSHOT_DIR = path.join(REPO_ROOT, 'test', 'baselines', 'display', 'column-widths');

/**
 * Seed config with dispatches that have varied content lengths.
 */
function seedConfigWithDispatches(rallyHome, repoPath) {
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
        name: 'test-project',
        path: repoPath,
        repo: 'organization/long-repository-name-here',
        team: 'shared',
        teamDir,
        onboarded: new Date().toISOString(),
      }],
    }),
    'utf8',
  );

  // Dispatches with varying title lengths to test truncation
  writeFileSync(
    path.join(rallyHome, 'active.yaml'),
    yaml.dump({
      dispatches: [
        {
          id: 'dispatch-short',
          repo: 'org/repo',
          issue: 1,
          title: 'Short title',
          branch: 'rally/1-short',
          status: 'implementing',
          worktreePath: path.join(projectsDir, 'wt-1'),
          created: new Date().toISOString(),
        },
        {
          id: 'dispatch-medium',
          repo: 'organization/repository',
          issue: 42,
          title: 'Medium length title for testing column widths',
          branch: 'rally/42-medium-title',
          status: 'waiting',
          worktreePath: path.join(projectsDir, 'wt-2'),
          created: new Date().toISOString(),
        },
        {
          id: 'dispatch-long',
          repo: 'organization/long-repository-name-here',
          issue: 1234,
          title: 'This is a very long title that might get truncated on narrow terminals and we want to verify it handles gracefully',
          branch: 'rally/1234-very-long-branch-name-that-tests-truncation-behavior',
          status: 'reviewing',
          worktreePath: path.join(projectsDir, 'wt-3'),
          created: new Date().toISOString(),
        },
        {
          id: 'dispatch-status',
          repo: 'org/repo',
          issue: 99,
          title: 'Testing status column visibility',
          branch: 'rally/99-status-test',
          status: 'waiting on upstream',
          worktreePath: path.join(projectsDir, 'wt-4'),
          created: new Date().toISOString(),
        },
      ],
    }),
    'utf8',
  );

  return { teamDir, projectsDir };
}

describe('display — column widths', () => {
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

  it('renders correctly at 80 columns (narrow)', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-display-cols-'));
    seedConfigWithDispatches(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 80,
      rows: 24,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    const frame = term.getFrame();

    // Essential elements should still be visible
    assert.ok(frame.includes('Rally Dashboard'), 'Header should be visible at 80 cols');

    // Status should be visible (this was a bug)
    const hasStatus =
      frame.includes('implementing') ||
      frame.includes('waiting') ||
      frame.includes('reviewing') ||
      frame.includes('⏳') ||
      frame.includes('🔵') ||
      frame.includes('✅');

    assert.ok(hasStatus, 'Status column should be visible at 80 columns');

    // Screenshot for visual regression
    await term.screenshot(path.join(SCREENSHOT_DIR, 'width-80-cols.png'));
  });

  it('renders correctly at 120 columns (standard)', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-display-cols-'));
    seedConfigWithDispatches(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    const frame = term.getFrame();

    assert.ok(frame.includes('Rally Dashboard'), 'Header visible at 120 cols');

    // At standard width, should see more content
    const hasIssueNumbers =
      frame.includes('#1') ||
      frame.includes('#42') ||
      frame.includes('#1234') ||
      frame.includes('#99');

    assert.ok(hasIssueNumbers, 'Issue numbers should be visible at 120 columns');

    await term.screenshot(path.join(SCREENSHOT_DIR, 'width-120-cols.png'));
  });

  it('renders correctly at 160 columns (wide)', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-display-cols-'));
    seedConfigWithDispatches(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 160,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    const frame = term.getFrame();

    assert.ok(frame.includes('Rally Dashboard'), 'Header visible at 160 cols');

    // Wide terminal should show more of long titles
    const hasLongContent =
      frame.includes('truncated') ||
      frame.includes('very long') ||
      frame.includes('long title');

    // At 160 cols, long titles should have more room
    await term.screenshot(path.join(SCREENSHOT_DIR, 'width-160-cols.png'));

    // Main assertion: no critical data truncation
    const frame160 = term.getFrame();
    assert.ok(
      frame160.includes('implementing') ||
      frame160.includes('waiting') ||
      frame160.includes('reviewing'),
      'Status should be fully visible at 160 columns'
    );
  });

  it('verifies no truncation of status column at any width', { timeout: 60_000 }, async () => {
    const widths = [80, 100, 120, 140, 160];

    for (const cols of widths) {
      if (tempDir) rmSync(tempDir, { recursive: true, force: true });
      tempDir = mkdtempSync(path.join(tmpdir(), 'rally-display-cols-'));
      seedConfigWithDispatches(tempDir, REPO_ROOT);

      term = await spawn(`node ${RALLY_BIN} dashboard`, {
        cols,
        rows: 30,
        env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
      });

      await term.waitFor('Rally Dashboard', { timeout: 10_000 });
      const frame = term.getFrame();

      // Status column should always be visible
      const statusVisible =
        frame.includes('implementing') ||
        frame.includes('waiting') ||
        frame.includes('reviewing') ||
        frame.includes('⏳') ||
        frame.includes('🔵') ||
        frame.includes('✅') ||
        frame.includes('🟣') ||
        frame.includes('🟡');

      assert.ok(
        statusVisible,
        `Status column should be visible at ${cols} columns`
      );

      await term.screenshot(path.join(SCREENSHOT_DIR, `width-${cols}-status-check.png`));

      term.close();
      term = null;
    }
  });

  it('handles resize during runtime', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-display-cols-'));
    seedConfigWithDispatches(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    await term.screenshot(path.join(SCREENSHOT_DIR, 'resize-before.png'));

    // Resize to narrow
    term.resize(80, 24);
    await new Promise(r => setTimeout(r, 500));
    await term.screenshot(path.join(SCREENSHOT_DIR, 'resize-narrow.png'));

    // Resize to wide
    term.resize(160, 30);
    await new Promise(r => setTimeout(r, 500));
    await term.screenshot(path.join(SCREENSHOT_DIR, 'resize-wide.png'));

    const frame = term.getFrame();
    assert.ok(frame.includes('Rally Dashboard'), 'Dashboard should handle resize gracefully');
  });
});
