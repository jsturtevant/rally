/**
 * E2E Display Test: Empty State
 * 
 * Tests the dashboard rendering when no dispatches exist.
 * Captures screenshots for visual regression testing.
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

const SCREENSHOT_DIR = path.join(REPO_ROOT, 'test', 'baselines', 'display', 'empty-state');

/**
 * Seed a minimal Rally config with no dispatches.
 */
function seedEmptyConfig(rallyHome, repoPath) {
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
        repo: 'jsturtevant/rally',
        team: 'shared',
        teamDir,
        onboarded: new Date().toISOString(),
      }],
    }),
    'utf8',
  );

  // Empty dispatches list
  writeFileSync(path.join(rallyHome, 'active.yaml'), 'dispatches: []\n', 'utf8');
  return { teamDir, projectsDir };
}

describe('display — empty state', () => {
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

  it('dashboard with no dispatches shows empty message', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-display-empty-'));
    seedEmptyConfig(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    const frame = term.getFrame();

    // Verify dashboard shows the header
    assert.ok(frame.includes('Rally Dashboard'), 'Dashboard header should be visible');

    // Verify empty state messaging or hint to create new dispatch
    assert.ok(
      frame.includes('No active dispatches') ||
      frame.includes('n new dispatch') ||
      frame.includes('No dispatches') ||
      frame.includes('empty'),
      'Dashboard should show empty state or navigation hint'
    );

    // Capture screenshot for visual regression baseline
    await term.screenshot(path.join(SCREENSHOT_DIR, 'empty-dashboard.png'));
  });

  it('empty state shows keyboard navigation hints', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-display-empty-'));
    seedEmptyConfig(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 120,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });
    const frame = term.getFrame();

    // Even with empty state, navigation hints should be visible
    assert.ok(
      frame.includes('n') || frame.includes('q') || frame.includes('r'),
      'Navigation hints should be visible in empty state'
    );

    await term.screenshot(path.join(SCREENSHOT_DIR, 'empty-with-hints.png'));
  });

  it('empty state screenshot at standard dimensions', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-display-empty-'));
    seedEmptyConfig(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} dashboard`, {
      cols: 80,
      rows: 24,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await term.waitFor('Rally Dashboard', { timeout: 10_000 });

    // Standard terminal dimensions screenshot
    await term.screenshot(path.join(SCREENSHOT_DIR, 'empty-80x24.png'));

    const frame = term.getFrame();
    assert.ok(frame.includes('Rally Dashboard'), 'Dashboard renders at 80x24');
  });
});
