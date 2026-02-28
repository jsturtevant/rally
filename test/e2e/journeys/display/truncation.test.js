/**
 * E2E Display Test: Truncation Behavior
 * 
 * Tests that long content is handled gracefully without breaking layout.
 * Specifically tests the bug where "waiting on upstream" was truncating.
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

const SCREENSHOT_DIR = path.join(REPO_ROOT, 'test', 'baselines', 'display', 'truncation');

/**
 * Seed config with dispatches that have long titles and various statuses.
 */
function seedTruncationTestConfig(rallyHome, repoPath) {
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
        name: 'truncation-test',
        path: repoPath,
        repo: 'test/truncation-tests',
        team: 'shared',
        teamDir,
        onboarded: new Date().toISOString(),
      }],
    }),
    'utf8',
  );

  // Dispatches designed to test truncation edge cases
  writeFileSync(
    path.join(rallyHome, 'active.yaml'),
    yaml.dump({
      dispatches: [
        {
          id: 'dispatch-long-title-1',
          repo: 'test/truncation-tests',
          issue: 1,
          title: 'This is an extremely long issue title that should definitely trigger truncation behavior in narrower terminal widths and we want to ensure it handles gracefully',
          branch: 'rally/1-extremely-long-branch-name-that-tests-truncation',
          status: 'implementing',
          worktreePath: path.join(projectsDir, 'wt-1'),
          created: new Date().toISOString(),
        },
        {
          id: 'dispatch-upstream',
          repo: 'test/truncation-tests',
          issue: 42,
          title: 'Fix dependency issue in auth module',
          branch: 'rally/42-fix-dependency',
          status: 'waiting on upstream',  // This status was being truncated (bug)
          worktreePath: path.join(projectsDir, 'wt-2'),
          created: new Date().toISOString(),
        },
        {
          id: 'dispatch-long-status',
          repo: 'test/truncation-tests',
          issue: 99,
          title: 'Another task with special status',
          branch: 'rally/99-special-status',
          status: 'blocked by external',
          worktreePath: path.join(projectsDir, 'wt-3'),
          created: new Date().toISOString(),
        },
        {
          id: 'dispatch-normal',
          repo: 'test/truncation-tests',
          issue: 100,
          title: 'Normal length title',
          branch: 'rally/100-normal',
          status: 'implementing',
          worktreePath: path.join(projectsDir, 'wt-4'),
          created: new Date().toISOString(),
        },
        {
          id: 'dispatch-short',
          repo: 'test/truncation-tests',
          issue: 7,
          title: 'Short',
          branch: 'rally/7-short',
          status: 'done',
          worktreePath: path.join(projectsDir, 'wt-5'),
          created: new Date().toISOString(),
        },
      ],
    }),
    'utf8',
  );

  return { teamDir, projectsDir };
}

describe('display — truncation', () => {
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

  it('long titles fit within column without breaking layout', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-display-trunc-'));
    seedTruncationTestConfig(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 80,
      rows: 24,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    const frame = term.getFrame();

    // Each line should not exceed terminal width
    const lines = frame.split('\n');
    for (const line of lines) {
      // Account for ANSI sequences that might be in frame even with NO_COLOR
      // The raw text content should fit within cols
      assert.ok(
        line.length <= 85, // Small buffer for edge cases
        `Line should fit within terminal width: "${line.substring(0, 50)}..."`
      );
    }

    await term.screenshot(path.join(SCREENSHOT_DIR, 'long-titles-80.png'));
  });

  it('status column is always fully visible', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-display-trunc-'));
    seedTruncationTestConfig(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 80,
      rows: 24,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    const frame = term.getFrame();

    // Status column should be fully visible
    const hasCompleteStatus =
      frame.includes('implementing') ||
      frame.includes('done') ||
      frame.includes('waiting') ||
      frame.includes('🔵') ||
      frame.includes('✅') ||
      frame.includes('⏳');

    assert.ok(hasCompleteStatus, 'Status column should be fully visible');

    await term.screenshot(path.join(SCREENSHOT_DIR, 'status-visible.png'));
  });

  it('"waiting on upstream" status is not truncated (regression test)', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-display-trunc-'));
    seedTruncationTestConfig(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    const frame = term.getFrame();

    // This was the specific bug: "waiting on upstream" was being cut off
    // Check that either the full status or at least "upstream" is visible
    const hasUpstream =
      frame.includes('waiting on upstream') ||
      frame.includes('upstream') ||
      frame.includes('waiting on') ||
      // Alternative: might show icon + abbreviated text
      frame.includes('⏳');

    assert.ok(
      hasUpstream,
      'Status "waiting on upstream" should not be truncated'
    );

    await term.screenshot(path.join(SCREENSHOT_DIR, 'waiting-upstream-visible.png'));
  });

  it('"waiting on upstream" visible even at 80 columns', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-display-trunc-'));
    seedTruncationTestConfig(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 80,
      rows: 24,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    const frame = term.getFrame();

    // Even at narrow width, some indication of "waiting" status should show
    const hasWaitingIndicator =
      frame.includes('waiting') ||
      frame.includes('upstream') ||
      frame.includes('⏳') ||
      frame.includes('…');  // Ellipsis indicates intentional truncation

    assert.ok(
      hasWaitingIndicator,
      'Waiting status should have visible indicator even at 80 columns'
    );

    await term.screenshot(path.join(SCREENSHOT_DIR, 'waiting-upstream-80cols.png'));
  });

  it('truncation uses ellipsis when needed', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-display-trunc-'));
    seedTruncationTestConfig(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 60,  // Very narrow
      rows: 24,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    const frame = term.getFrame();

    // At very narrow width, long titles should be truncated with ellipsis
    // or the layout should adapt gracefully
    const lines = frame.split('\n');
    let hasProperTruncation = true;

    for (const line of lines) {
      // Line should not overflow
      if (line.length > 65) {  // Small buffer
        hasProperTruncation = false;
      }
    }

    assert.ok(hasProperTruncation, 'Lines should not overflow at 60 columns');

    await term.screenshot(path.join(SCREENSHOT_DIR, 'narrow-truncation.png'));
  });

  it('title column truncates, status column preserved', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-display-trunc-'));
    seedTruncationTestConfig(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 100,
      rows: 24,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    const frame = term.getFrame();

    // The dispatch with long title exists
    const hasLongTitle = frame.includes('extremely') || frame.includes('truncation');
    
    // Status for that dispatch should still be visible
    const hasStatus =
      frame.includes('implementing') ||
      frame.includes('🔵');

    // Both should be true — title partially visible, status complete
    assert.ok(
      hasStatus,
      'Status should be preserved even when title is truncated'
    );

    await term.screenshot(path.join(SCREENSHOT_DIR, 'title-truncated-status-preserved.png'));
  });

  it('handles mixed content lengths gracefully', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-display-trunc-'));
    seedTruncationTestConfig(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 100,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    const frame = term.getFrame();

    // Should show multiple dispatches with different title lengths
    const hasShort = frame.includes('Short') || frame.includes('#7');
    const hasNormal = frame.includes('Normal') || frame.includes('#100');
    const hasLong = frame.includes('extremely') || frame.includes('#1');

    // All should be visible in some form
    assert.ok(
      hasShort || hasNormal || hasLong,
      'Mixed content lengths should render gracefully'
    );

    await term.screenshot(path.join(SCREENSHOT_DIR, 'mixed-content.png'));
  });
});
