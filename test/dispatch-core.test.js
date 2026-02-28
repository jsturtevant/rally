import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, rmSync, mkdirSync, writeFileSync,
  existsSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import yaml from 'js-yaml';
import { setupDispatchWorktree } from '../lib/dispatch-core.js';
import { withTempRallyHome } from './helpers/temp-env.js';

// =====================================================
// Helpers
// =====================================================

let tempDir;
let repoPath;

beforeEach((t) => {
  tempDir = mkdtempSync(join(tmpdir(), 'rally-dispatch-core-'));
  repoPath = join(tempDir, 'repo');
  withTempRallyHome(t);

  // Initialize a real git repo for worktree operations
  mkdirSync(repoPath, { recursive: true });
  execFileSync('git', ['init'], { cwd: repoPath, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: repoPath, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: repoPath, stdio: 'ignore' });
  writeFileSync(join(repoPath, 'README.md'), '# Test');
  execFileSync('git', ['add', '.'], { cwd: repoPath, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'Initial commit'], { cwd: repoPath, stdio: 'ignore' });
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function setupRallyHome() {
  const rallyHome = process.env.RALLY_HOME;
  mkdirSync(rallyHome, { recursive: true });
  writeFileSync(join(rallyHome, 'config.yaml'), yaml.dump({ version: '0.1.0' }), 'utf8');
  writeFileSync(join(rallyHome, 'projects.yaml'), yaml.dump({
    projects: [{ name: 'repo', path: repoPath, team: 'shared', onboarded: new Date().toISOString() }],
  }), 'utf8');
  return rallyHome;
}

/**
 * Creates a mock _exec that responds to gh copilot and docker sandbox checks.
 */
function makeCopilotExec({ copilotAvailable = false, dockerSandboxAvailable = false } = {}) {
  return (cmd, args, opts) => {
    if (cmd === 'gh' && args[0] === 'copilot' && args[1] === '--help') {
      if (!copilotAvailable) throw new Error('unknown command "copilot"');
      return '';
    }
    if (cmd === 'docker' && args[0] === 'sandbox' && args[1] === '--help') {
      if (!dockerSandboxAvailable) throw new Error('unknown command "sandbox"');
      return '';
    }
    return execFileSync(cmd, args, opts);
  };
}

function noopSpawn() {
  return { pid: 12345, unref() {} };
}

function baseOpts(overrides = {}) {
  const worktreePath = join(repoPath, '.worktrees', 'rally-99');
  return {
    resolvedRepoPath: repoPath,
    worktreePath,
    branch: 'rally/99-test',
    teamDir: null,
    dispatchId: 'repo-issue-99',
    repo: 'owner/repo',
    number: 99,
    type: 'issue',
    initialStatus: 'implementing',
    copilotPrompt: 'test prompt',
    preSymlinkFn: null,
    postSymlinkFn: null,
    _spawn: noopSpawn,
    ...overrides,
  };
}

// =====================================================
// setupDispatchWorktree — Copilot/Sandbox launch logic
// =====================================================

describe('setupDispatchWorktree Copilot launch', () => {
  test('throws when --sandbox requested but Docker sandbox unavailable', () => {
    setupRallyHome();
    const exec = makeCopilotExec({ dockerSandboxAvailable: false });

    assert.throws(
      () => setupDispatchWorktree(baseOpts({ sandbox: true, _exec: exec })),
      { message: /Docker sandbox not available/ }
    );
  });

  test('uses docker sandbox spawn when --sandbox and Docker available', () => {
    setupRallyHome();
    let spawnArgs;
    const exec = makeCopilotExec({ dockerSandboxAvailable: true });
    const spawn = (cmd, args, opts) => {
      spawnArgs = { cmd, args, opts };
      return { pid: 12345, unref() {} };
    };

    const result = setupDispatchWorktree(baseOpts({
      sandbox: true,
      _exec: exec,
      _spawn: spawn,
    }));

    assert.strictEqual(spawnArgs.cmd, 'docker');
    assert.strictEqual(spawnArgs.args[0], 'sandbox');
    assert.strictEqual(spawnArgs.args[1], 'run');
    assert.strictEqual(spawnArgs.args[2], 'copilot');
    assert.ok(spawnArgs.args.includes('--'));
    assert.ok(result.sessionId);
  });

  test('uses gh copilot spawn when no --sandbox and Copilot available', () => {
    setupRallyHome();
    let spawnArgs;
    const exec = makeCopilotExec({ copilotAvailable: true });
    const spawn = (cmd, args, opts) => {
      spawnArgs = { cmd, args, opts };
      return { pid: 12345, unref() {} };
    };

    const result = setupDispatchWorktree(baseOpts({
      _exec: exec,
      _spawn: spawn,
    }));

    assert.strictEqual(spawnArgs.cmd, 'gh');
    assert.strictEqual(spawnArgs.args[0], 'copilot');
    assert.ok(result.sessionId);
  });

  test('skips Copilot when no --sandbox and Copilot unavailable', () => {
    setupRallyHome();
    let spawnCalled = false;
    const exec = makeCopilotExec({ copilotAvailable: false });
    const spawn = () => {
      spawnCalled = true;
      return { pid: 12345, unref() {} };
    };

    const result = setupDispatchWorktree(baseOpts({
      _exec: exec,
      _spawn: spawn,
    }));

    assert.strictEqual(spawnCalled, false);
    assert.strictEqual(result.sessionId, null);
  });
});

describe('setupDispatchWorktree cleanup', () => {
  test('deletes branch when setup fails after worktree creation', () => {
    setupRallyHome();
    const opts = baseOpts({
      postSymlinkFn: () => {
        throw new Error('boom');
      },
    });

    assert.throws(
      () => setupDispatchWorktree(opts),
      { message: 'boom' }
    );

    const branchList = execFileSync('git', ['branch', '--list', opts.branch], {
      cwd: repoPath,
      encoding: 'utf8',
    });
    assert.strictEqual(branchList.trim(), '');
    assert.strictEqual(existsSync(opts.worktreePath), false);
  });
});
