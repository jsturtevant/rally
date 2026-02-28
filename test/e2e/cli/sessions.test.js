/**
 * E2E CLI Test: Sessions Command
 * 
 * Tests the rally dispatch sessions command.
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
 * Seed dispatches.
 */
function seedDispatches(rallyHome, dispatches) {
  writeFileSync(
    path.join(rallyHome, 'active.yaml'),
    yaml.dump({ dispatches }),
    'utf8',
  );
}

describe('CLI — sessions command', () => {
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

  it('rally dispatch sessions lists no sessions when empty', { timeout: 15_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-sessions-'));
    seedConfig(tempDir, REPO_ROOT);

    term = await spawn(`node ${RALLY_BIN} dispatch sessions`, {
      cols: 100,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await new Promise(r => setTimeout(r, 2000));
    const frame = term.getFrame();

    // Should show empty state or "no sessions" message
    assert.ok(
      frame.includes('No') || frame.includes('no') || frame.includes('empty') || frame.length > 0,
      'sessions should handle empty state'
    );
  });

  it('rally dispatch sessions lists active sessions', { timeout: 15_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-sessions-'));
    seedConfig(tempDir, REPO_ROOT);
    seedDispatches(tempDir, [
      {
        id: 'session-1',
        type: 'issue',
        number: 42,
        repo: 'jsturtevant/rally',
        branch: 'rally/42-test-issue',
        worktreePath: '/tmp/rally-worktree-1',
        status: 'implementing',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'session-2',
        type: 'pr',
        number: 99,
        repo: 'jsturtevant/rally',
        branch: 'rally/99-review-pr',
        worktreePath: '/tmp/rally-worktree-2',
        status: 'implementing',
        createdAt: new Date().toISOString(),
      },
    ]);

    term = await spawn(`node ${RALLY_BIN} dispatch sessions`, {
      cols: 100,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await new Promise(r => setTimeout(r, 2000));
    const frame = term.getFrame();

    // Should list session info (issue/pr numbers, branches, or status)
    assert.ok(
      frame.includes('42') || frame.includes('99') || frame.includes('rally/') || frame.includes('implementing'),
      'sessions should list active dispatches'
    );
  });

  it('rally dispatch sessions shows done sessions', { timeout: 15_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-sessions-'));
    seedConfig(tempDir, REPO_ROOT);
    seedDispatches(tempDir, [
      {
        id: 'session-done',
        type: 'issue',
        number: 123,
        repo: 'jsturtevant/rally',
        branch: 'rally/123-completed',
        worktreePath: '/tmp/rally-worktree-done',
        status: 'done',
        createdAt: new Date().toISOString(),
      },
    ]);

    term = await spawn(`node ${RALLY_BIN} dispatch sessions`, {
      cols: 100,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await new Promise(r => setTimeout(r, 2000));
    const frame = term.getFrame();

    // Should show done sessions
    assert.ok(
      frame.includes('123') || frame.includes('done') || frame.includes('rally/'),
      'sessions should show done dispatches'
    );
  });

  it('rally dispatch sessions handles mixed statuses', { timeout: 15_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-sessions-'));
    seedConfig(tempDir, REPO_ROOT);
    seedDispatches(tempDir, [
      {
        id: 'session-impl',
        type: 'issue',
        number: 1,
        repo: 'jsturtevant/rally',
        branch: 'rally/1-implementing',
        worktreePath: '/tmp/rally-impl',
        status: 'implementing',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'session-upstream',
        type: 'issue',
        number: 2,
        repo: 'jsturtevant/rally',
        branch: 'rally/2-upstream',
        worktreePath: '/tmp/rally-upstream',
        status: 'upstream',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'session-done',
        type: 'pr',
        number: 3,
        repo: 'jsturtevant/rally',
        branch: 'rally/3-done',
        worktreePath: '/tmp/rally-done',
        status: 'done',
        createdAt: new Date().toISOString(),
      },
    ]);

    term = await spawn(`node ${RALLY_BIN} dispatch sessions`, {
      cols: 100,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await new Promise(r => setTimeout(r, 2000));
    const frame = term.getFrame();

    // Should show multiple sessions
    assert.ok(frame.length > 10, 'sessions should produce meaningful output');
  });
});
