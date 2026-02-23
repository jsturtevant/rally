import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, rmSync, existsSync, readFileSync,
  mkdirSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import yaml from 'js-yaml';
import { dispatchIssue } from '../lib/dispatch-issue.js';
import { checkTools, assertTools } from '../lib/tools.js';
import { RallyError, EXIT_CONFIG } from '../lib/errors.js';
import { addDispatch } from '../lib/active.js';

// =====================================================
// Helpers
// =====================================================

let tempDir;
let repoPath;
let originalEnv;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'rally-edge-'));
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
  return rallyHome;
}

function makeIssue(overrides = {}) {
  return {
    title: 'Edge case test',
    body: 'Testing edge cases.',
    labels: [],
    assignees: [],
    ...overrides,
  };
}

function createExecWithIssue(issueData, { dirty = false } = {}) {
  return (cmd, args, opts) => {
    if (cmd === 'gh' && args[0] === 'issue' && args[1] === 'view') {
      return JSON.stringify(issueData);
    }
    if (cmd === 'git' && args[0] === 'status' && args[1] === '--porcelain') {
      return dirty ? ' M file.txt\n' : '';
    }
    return execFileSync(cmd, args, opts);
  };
}

function noopSpawn() {
  return { pid: 12345, unref() {}, on() {} };
}

// =====================================================
// Uncommitted changes warning
// =====================================================

describe('uncommitted changes warning', () => {
  test('warns when working directory is dirty', async () => {
    setupRallyHome();
    const issue = makeIssue();
    const warnings = [];
    const origError = console.error;
    console.error = (msg) => warnings.push(msg);

    mkdirSync(join(repoPath, '.squad'), { recursive: true });

    try {
      const exec = createExecWithIssue(issue, { dirty: true });
      await dispatchIssue({
        issueNumber: 1,
        repo: 'owner/repo',
        repoPath,
        _exec: exec,
        _spawn: noopSpawn,
      });

      assert.ok(
        warnings.some((w) => w.includes('uncommitted changes')),
        'should warn about uncommitted changes'
      );
    } finally {
      console.error = origError;
    }
  });

  test('no warning when working directory is clean', async () => {
    setupRallyHome();
    const issue = makeIssue();
    const warnings = [];
    const origError = console.error;
    console.error = (msg) => warnings.push(msg);

    mkdirSync(join(repoPath, '.squad'), { recursive: true });

    try {
      const exec = createExecWithIssue(issue, { dirty: false });
      await dispatchIssue({
        issueNumber: 2,
        repo: 'owner/repo',
        repoPath,
        _exec: exec,
        _spawn: noopSpawn,
      });

      assert.ok(
        !warnings.some((w) => w.includes('uncommitted changes')),
        'should not warn when clean'
      );
    } finally {
      console.error = origError;
    }
  });
});

// =====================================================
// Worktree collision — idempotent
// =====================================================

describe('worktree collision detection', () => {
  test('returns early with existing flag when worktree exists', async () => {
    setupRallyHome();
    const issue = makeIssue();
    const exec = createExecWithIssue(issue);

    mkdirSync(join(repoPath, '.worktrees', 'rally-10'), { recursive: true });

    const result = await dispatchIssue({
      issueNumber: 10,
      repo: 'owner/repo',
      repoPath,
      _exec: exec,
      _spawn: noopSpawn,
    });

    assert.strictEqual(result.existing, true);
    assert.ok(result.worktreePath.includes('rally-10'));
    assert.strictEqual(result.sessionId, null);
  });

  test('does not create duplicate worktree', async () => {
    setupRallyHome();
    const issue = makeIssue();
    const exec = createExecWithIssue(issue);

    const wtPath = join(repoPath, '.worktrees', 'rally-11');
    mkdirSync(wtPath, { recursive: true });
    writeFileSync(join(wtPath, 'marker.txt'), 'existing');

    const result = await dispatchIssue({
      issueNumber: 11,
      repo: 'owner/repo',
      repoPath,
      _exec: exec,
      _spawn: noopSpawn,
    });

    assert.strictEqual(result.existing, true);
    // Original marker file should still be there (nothing was overwritten)
    assert.ok(existsSync(join(wtPath, 'marker.txt')));
  });
});

// =====================================================
// Atomic YAML writes
// =====================================================

describe('atomic yaml writes', () => {
  test('no temp file left after addDispatch', () => {
    const rallyHome = process.env.RALLY_HOME;
    mkdirSync(rallyHome, { recursive: true });

    addDispatch({
      id: 'atomic-test',
      repo: 'owner/repo',
      number: 1,
      type: 'issue',
      branch: 'rally/1-test',
      worktreePath: '/tmp/wt',
      status: 'planning',
      session_id: 'sess-1',
    });

    const tempPath = join(rallyHome, '.active.yaml.tmp');
    assert.ok(!existsSync(tempPath), 'temp file should not remain');
    assert.ok(existsSync(join(rallyHome, 'active.yaml')), 'active.yaml should exist');
  });

  test('active.yaml content is valid after write', () => {
    const rallyHome = process.env.RALLY_HOME;
    mkdirSync(rallyHome, { recursive: true });

    addDispatch({
      id: 'valid-yaml',
      repo: 'owner/repo',
      number: 2,
      type: 'issue',
      branch: 'rally/2-test',
      worktreePath: '/tmp/wt2',
      status: 'planning',
      session_id: 'sess-2',
    });

    const content = readFileSync(join(rallyHome, 'active.yaml'), 'utf8');
    const data = yaml.load(content);
    assert.ok(Array.isArray(data.dispatches));
    assert.strictEqual(data.dispatches[0].id, 'valid-yaml');
  });
});

// =====================================================
// Tool detection
// =====================================================

describe('checkTools', () => {
  test('returns empty array when all tools are present', () => {
    const exec = () => '/usr/bin/tool\n';
    const missing = checkTools({ _exec: exec });
    assert.deepEqual(missing, []);
  });

  test('returns missing tools when tool --version fails', () => {
    const exec = (cmd) => {
      if (cmd === 'gh') throw new Error('not found');
      if (cmd === 'npx') throw new Error('not found');
      return 'git version 2.40.0\n';
    };
    const missing = checkTools({ _exec: exec });
    assert.deepEqual(missing, ['gh', 'npx']);
  });

  test('returns all tools when none are found', () => {
    const exec = () => { throw new Error('not found'); };
    const missing = checkTools({ _exec: exec });
    assert.deepEqual(missing, ['git', 'gh', 'npx']);
  });
});

describe('assertTools', () => {
  test('does not throw when all tools are present', () => {
    const exec = () => '/usr/bin/tool\n';
    assert.doesNotThrow(() => assertTools({ _exec: exec }));
  });

  test('throws RallyError with EXIT_CONFIG when tools are missing', () => {
    const exec = () => { throw new Error('not found'); };
    assert.throws(
      () => assertTools({ _exec: exec }),
      (err) => {
        assert.ok(err instanceof RallyError);
        assert.strictEqual(err.exitCode, EXIT_CONFIG);
        assert.ok(err.message.includes('git'));
        assert.ok(err.message.includes('gh'));
        assert.ok(err.message.includes('npx'));
        return true;
      }
    );
  });

  test('error message lists only missing tools', () => {
    const exec = (cmd) => {
      if (cmd === 'npx') throw new Error('not found');
      return 'tool version 1.0.0\n';
    };
    assert.throws(
      () => assertTools({ _exec: exec }),
      (err) => {
        assert.ok(err.message.includes('npx'));
        assert.ok(!err.message.includes('git,'));
        return true;
      }
    );
  });
});
