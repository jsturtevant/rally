import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, rmSync, mkdirSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import yaml from 'js-yaml';
import { setupDispatchWorktree } from '../lib/dispatch-core.js';

// =====================================================
// Helpers
// =====================================================

let tempDir;
let repoPath;
let originalEnv;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'rally-dispatch-core-'));
  repoPath = join(tempDir, 'repo');
  originalEnv = process.env.RALLY_HOME;
  process.env.RALLY_HOME = join(tempDir, 'rally-home');

  mkdirSync(repoPath, { recursive: true });
  execFileSync('git', ['init'], { cwd: repoPath, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: repoPath, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: repoPath, stdio: 'ignore' });
  writeFileSync(join(repoPath, 'README.md'), '# Test');
  execFileSync('git', ['add', '.'], { cwd: repoPath, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'Initial commit'], { cwd: repoPath, stdio: 'ignore' });
});

afterEach(() => {
  if (originalEnv !== undefined) {
    process.env.RALLY_HOME = originalEnv;
  } else {
    delete process.env.RALLY_HOME;
  }
  rmSync(tempDir, { recursive: true, force: true });
});

function setupRallyHome() {
  const rallyHome = process.env.RALLY_HOME;
  mkdirSync(rallyHome, { recursive: true });
  writeFileSync(join(rallyHome, 'config.yaml'), yaml.dump({ version: '0.1.0' }), 'utf8');
  writeFileSync(join(rallyHome, 'projects.yaml'), yaml.dump({
    projects: [{ name: 'repo', path: repoPath, team: 'shared', onboarded: new Date().toISOString() }],
  }), 'utf8');
  mkdirSync(join(rallyHome, 'active'), { recursive: true });
  writeFileSync(join(rallyHome, 'active', 'repo.yaml'), yaml.dump({ dispatches: [] }), 'utf8');
  return rallyHome;
}

function makeCopilotExec() {
  return (cmd, args, opts) => {
    if (cmd === 'gh' && args[0] === 'copilot') return '';
    if (cmd === 'docker' && args[0] === 'sandbox') return '';
    return execFileSync(cmd, args, opts);
  };
}

function noopSpawn() {
  return { pid: 12345, unref() {}, on() {} };
}

function baseOpts(overrides = {}) {
  return {
    resolvedRepoPath: repoPath,
    worktreePath: join(repoPath, '.worktrees', 'rally-99'),
    branch: 'rally/99-test-issue',
    dispatchId: 'repo-issue-99',
    repo: 'owner/repo',
    number: 99,
    type: 'issue',
    initialStatus: 'planning',
    copilotPrompt: 'Read .squad/dispatch-context.md and plan/implement a fix for issue #99',
    _exec: makeCopilotExec(),
    _spawn: noopSpawn,
    ...overrides,
  };
}

// =====================================================
// sandbox branching logic
// =====================================================

describe('setupDispatchWorktree sandbox branching', () => {
  test('throws when --sandbox requested but Docker sandbox unavailable', () => {
    setupRallyHome();

    const execNoDocker = (cmd, args, opts) => {
      if (cmd === 'docker' && args[0] === 'sandbox') {
        throw new Error('unknown command "sandbox"');
      }
      if (cmd === 'gh' && args[0] === 'copilot') return '';
      return execFileSync(cmd, args, opts);
    };

    assert.throws(
      () => setupDispatchWorktree(baseOpts({ sandbox: true, _exec: execNoDocker })),
      /Docker sandbox not available/
    );
  });

  test('uses docker sandbox spawn when --sandbox and Docker available', () => {
    setupRallyHome();

    let spawnedCmd = null;
    const mockSpawn = (cmd, args) => {
      spawnedCmd = cmd;
      return { pid: 99, unref() {} };
    };

    const execWithDocker = (cmd, args, opts) => {
      if (cmd === 'docker' && args[0] === 'sandbox') return '';
      if (cmd === 'gh' && args[0] === 'copilot') return '';
      return execFileSync(cmd, args, opts);
    };

    setupDispatchWorktree(baseOpts({ sandbox: true, _exec: execWithDocker, _spawn: mockSpawn }));

    assert.strictEqual(spawnedCmd, 'docker');
  });

  test('uses gh copilot spawn when no --sandbox and Copilot available', () => {
    setupRallyHome();

    let spawnedCmd = null;
    const mockSpawn = (cmd, args) => {
      spawnedCmd = cmd;
      return { pid: 99, unref() {} };
    };

    setupDispatchWorktree(baseOpts({ sandbox: false, _spawn: mockSpawn }));

    assert.strictEqual(spawnedCmd, 'gh');
  });

  test('skips Copilot when no --sandbox and Copilot unavailable', () => {
    setupRallyHome();

    let spawnCalled = false;
    const mockSpawn = () => {
      spawnCalled = true;
      return { pid: 1, unref() {} };
    };

    const execNoCopilot = (cmd, args, opts) => {
      if (cmd === 'gh' && args[0] === 'copilot') throw new Error('gh: command not found');
      return execFileSync(cmd, args, opts);
    };

    setupDispatchWorktree(baseOpts({ sandbox: false, _exec: execNoCopilot, _spawn: mockSpawn }));

    assert.strictEqual(spawnCalled, false);
  });
});
