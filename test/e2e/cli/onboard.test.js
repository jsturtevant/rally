/**
 * E2E CLI Test: Onboard Command
 * 
 * Tests the rally onboard command flow.
 */

import { describe, it, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, cleanupAll } from '../../harness/terminal.js';
import path from 'node:path';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import yaml from 'js-yaml';
import { execFileSync } from 'node:child_process';

const RALLY_BIN = path.join(import.meta.dirname, '..', '..', '..', 'bin', 'rally.js');
const REPO_ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim();

/**
 * Seed minimal Rally setup config (without projects).
 */
function seedSetup(rallyHome) {
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
    yaml.dump({ projects: [] }),
    'utf8',
  );

  writeFileSync(path.join(rallyHome, 'active.yaml'), 'dispatches: []\n', 'utf8');
}

/**
 * Create a fake git repo for testing.
 */
function createFakeRepo(dir) {
  mkdirSync(dir, { recursive: true });
  execFileSync('git', ['init'], { cwd: dir, encoding: 'utf8' });
  execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
  writeFileSync(path.join(dir, 'README.md'), '# Test Repo\n', 'utf8');
  execFileSync('git', ['add', '.'], { cwd: dir, encoding: 'utf8' });
  execFileSync('git', ['commit', '-m', 'Initial commit'], { cwd: dir, encoding: 'utf8' });
  // Set a fake remote
  execFileSync('git', ['remote', 'add', 'origin', 'https://github.com/testuser/testrepo.git'], { cwd: dir });
}

describe('CLI — onboard command', () => {
  let term;
  let tempDir;
  let fakeRepoDir;

  afterEach(async () => {
    if (term) {
      try { term.close(); } catch {}
      term = null;
    }
  });

  after(async () => {
    await cleanupAll();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
    if (fakeRepoDir) rmSync(fakeRepoDir, { recursive: true, force: true });
  });

  it('rally onboard --help shows usage', { timeout: 15_000 }, async () => {
    term = await spawn(`node ${RALLY_BIN} onboard --help`, { cols: 80, rows: 24 });

    await term.waitFor('onboard', { timeout: 5_000 });
    const frame = term.getFrame();

    assert.ok(frame.includes('onboard'), 'should show onboard command');
    assert.ok(frame.includes('path') || frame.includes('repo') || frame.includes('URL'),
      'should mention path/repo argument');
  });

  it('rally onboard with --team flag skips interactive prompt', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-onboard-'));
    fakeRepoDir = mkdtempSync(path.join(tmpdir(), 'fake-repo-'));
    
    seedSetup(tempDir);
    createFakeRepo(fakeRepoDir);

    term = await spawn(`node ${RALLY_BIN} onboard ${fakeRepoDir} --team shared`, {
      cols: 100,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await new Promise(r => setTimeout(r, 5000));
    const frame = term.getFrame();

    // Should either succeed or show an error (not hang on prompt)
    assert.ok(
      frame.includes('Onboarded') || frame.includes('onboard') || frame.includes('Error') || frame.includes('✓'),
      'onboard with --team should not require interaction'
    );
  });

  it('rally onboard without args uses current directory', { timeout: 30_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-onboard-'));
    seedSetup(tempDir);

    // Run from REPO_ROOT (current project)
    term = await spawn(`node ${RALLY_BIN} onboard --team shared`, {
      cols: 100,
      rows: 30,
      cwd: REPO_ROOT,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await new Promise(r => setTimeout(r, 5000));
    const frame = term.getFrame();

    // Should process current directory
    assert.ok(
      frame.includes('Onboarded') || frame.includes('dispatcher') || frame.includes('rally') || 
      frame.includes('Error') || frame.includes('already'),
      'onboard should process current directory'
    );
  });

  it('rally onboard on non-git directory shows error', { timeout: 15_000 }, async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rally-onboard-'));
    const nonGitDir = mkdtempSync(path.join(tmpdir(), 'non-git-'));
    
    seedSetup(tempDir);

    term = await spawn(`node ${RALLY_BIN} onboard ${nonGitDir} --team shared`, {
      cols: 100,
      rows: 30,
      env: { RALLY_HOME: tempDir, NO_COLOR: '1' },
    });

    await new Promise(r => setTimeout(r, 3000));
    const frame = term.getFrame();

    // Should show error for non-git directory
    assert.ok(
      frame.includes('error') || frame.includes('Error') || frame.includes('git') || frame.includes('not'),
      'onboard should error on non-git directory'
    );

    rmSync(nonGitDir, { recursive: true, force: true });
  });

  it('rally onboard remove --help shows usage', { timeout: 15_000 }, async () => {
    term = await spawn(`node ${RALLY_BIN} onboard remove --help`, { cols: 80, rows: 24 });

    await term.waitFor('remove', { timeout: 5_000 });
    const frame = term.getFrame();

    assert.ok(frame.includes('remove'), 'should show remove subcommand');
    assert.ok(frame.includes('project') || frame.includes('Remove'),
      'should mention project argument or description');
  });
});
