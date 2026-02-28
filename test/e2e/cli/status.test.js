/**
 * E2E CLI Test: Status Command
 * 
 * Tests the rally status command output.
 */

import { describe, it, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, cleanupAll } from '../../harness/terminal.js';
import path from 'node:path';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import yaml from 'js-yaml';
import { execFileSync } from 'node:child_process';

const RALLY_BIN = path.join(import.meta.dirname, '..', '..', '..', 'bin', 'rally.js');
const REPO_ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim();

/**
 * Seed a minimal Rally config.
 */
function seedConfig(rallyHome, repoPath) {
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

  writeFileSync(path.join(rallyHome, 'active.yaml'), 'dispatches: []\n', 'utf8');
}

/**
 * Seed a dispatch.
 */
function seedDispatch(rallyHome, dispatch) {
  writeFileSync(
    path.join(rallyHome, 'active.yaml'),
    yaml.dump({ dispatches: [dispatch] }),
    'utf8',
  );
}

describe('CLI — status command', () => {
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

  it('rally status shows configuration', { timeout: 15_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-status-'));
    seedConfig(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} status`, {
      cols: 100,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await new Promise(r => setTimeout(r, 2000));
    const frame = term.getFrame();

    // Status should show some config information
    assert.ok(
      frame.includes('Rally') || frame.includes('config') || frame.includes('project') || frame.includes('dispatch'),
      'status should show Rally information'
    );
  });

  it('rally status shows active dispatches', { timeout: 15_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-status-'));
    seedConfig(tempDir, REPO_ROOT);
    seedDispatch(tempDir, {
      id: 'test-dispatch-1',
      type: 'issue',
      number: 42,
      repo: 'jsturtevant/rally',
      branch: 'rally/42-test-issue',
      worktreePath: '/tmp/rally-worktree',
      status: 'implementing',
      createdAt: new Date().toISOString(),
    });

    term = await spawn(`node ${RALLY_BIN} status`, {
      cols: 100,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await new Promise(r => setTimeout(r, 2000));
    const frame = term.getFrame();

    // Status should mention active dispatches
    assert.ok(
      frame.includes('dispatch') || frame.includes('42') || frame.includes('implementing'),
      'status should show dispatch information'
    );
  });

  it('rally status --json outputs JSON', { timeout: 15_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-status-'));
    seedConfig(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} status --json`, {
      cols: 100,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await new Promise(r => setTimeout(r, 2000));
    const frame = term.getFrame();

    // Should output valid JSON (starts with { or [)
    const trimmed = frame.trim();
    assert.ok(
      trimmed.startsWith('{') || trimmed.startsWith('['),
      'status --json should output JSON'
    );
  });

  it('rally status with no config shows meaningful output', { timeout: 15_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-status-'));
    // Don't seed config

    term = await spawn(`node ${RALLY_BIN} status`, {
      cols: 100,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await new Promise(r => setTimeout(r, 2000));
    const frame = term.getFrame();

    // Should either show empty state or error message, not crash
    assert.ok(frame.length > 0, 'status should produce some output');
  });
});
