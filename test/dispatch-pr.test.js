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
import { fetchPrOrFail, dispatchPr } from '../lib/dispatch-pr.js';

// =====================================================
// Helpers
// =====================================================

let tempDir;
let repoPath;
let originalEnv;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'rally-dispatch-pr-'));
  repoPath = join(tempDir, 'repo');
  originalEnv = process.env.RALLY_HOME;
  process.env.RALLY_HOME = join(tempDir, 'rally-home');

  // Initialize a real git repo for worktree operations
  mkdirSync(repoPath, { recursive: true });
  execFileSync('git', ['init'], { cwd: repoPath, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: repoPath, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: repoPath, stdio: 'ignore' });
  writeFileSync(join(repoPath, 'README.md'), '# Test');
  execFileSync('git', ['add', '.'], { cwd: repoPath, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'Initial commit'], { cwd: repoPath, stdio: 'ignore' });

  // Create a PR head ref branch with distinct content for checkout verification
  execFileSync('git', ['checkout', '-b', 'fix/login'], { cwd: repoPath, stdio: 'ignore' });
  writeFileSync(join(repoPath, 'pr-change.txt'), 'PR content');
  execFileSync('git', ['add', '.'], { cwd: repoPath, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'PR commit'], { cwd: repoPath, stdio: 'ignore' });
  execFileSync('git', ['checkout', '-'], { cwd: repoPath, stdio: 'ignore' });

  // Add self as remote so worktree can fetch PR head ref
  execFileSync('git', ['remote', 'add', 'origin', repoPath], { cwd: repoPath, stdio: 'ignore' });
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

function makePr(overrides = {}) {
  return {
    title: 'Fix login validation',
    body: 'Fixes the login validation bug.',
    headRefName: 'fix/login',
    baseRefName: 'main',
    state: 'OPEN',
    files: [
      { path: 'src/login.js', additions: 10, deletions: 3 },
      { path: 'test/login.test.js', additions: 25, deletions: 0 },
    ],
    ...overrides,
  };
}

/**
 * Creates a mock _exec that returns PR data for `gh pr view`
 * and delegates git commands to real execFileSync.
 */
function createExecWithPr(prData) {
  return (cmd, args, opts) => {
    if (cmd === 'gh' && args[0] === 'pr' && args[1] === 'view') {
      if (!prData) {
        const err = new Error('Could not resolve to a PullRequest with the number of 999');
        throw err;
      }
      return JSON.stringify(prData);
    }
    // Delegate git commands to real git
    return execFileSync(cmd, args, opts);
  };
}

/** No-op spawn that returns a mock child process */
function noopSpawn() {
  return {
    pid: 12345,
    unref() {},
    on() {},
  };
}

// =====================================================
// fetchPrOrFail
// =====================================================

describe('fetchPrOrFail', () => {
  test('returns PR data when open', () => {
    const pr = makePr();
    const exec = createExecWithPr(pr);
    const result = fetchPrOrFail(42, 'owner/repo', exec);
    assert.strictEqual(result.title, 'Fix login validation');
    assert.strictEqual(result.state, 'OPEN');
  });

  test('throws when PR not found', () => {
    const exec = createExecWithPr(null);
    assert.throws(
      () => fetchPrOrFail(999, 'owner/repo', exec),
      (err) => {
        assert.ok(err.message.includes('not found'));
        return true;
      }
    );
  });

  test('throws when PR is merged', () => {
    const pr = makePr({ state: 'MERGED' });
    const exec = createExecWithPr(pr);
    assert.throws(
      () => fetchPrOrFail(10, 'owner/repo', exec),
      (err) => {
        assert.ok(err.message.includes('already merged'));
        return true;
      }
    );
  });

  test('throws when PR is closed', () => {
    const pr = makePr({ state: 'CLOSED' });
    const exec = createExecWithPr(pr);
    assert.throws(
      () => fetchPrOrFail(10, 'owner/repo', exec),
      (err) => {
        assert.ok(err.message.includes('closed'));
        return true;
      }
    );
  });
});

// =====================================================
// dispatchPr — error paths
// =====================================================

describe('dispatchPr error paths', () => {
  test('throws when PR number is missing', async () => {
    setupRallyHome();
    await assert.rejects(
      () => dispatchPr({ repo: 'owner/repo', repoPath }),
      (err) => {
        assert.ok(err.message.includes('PR number is required'));
        return true;
      }
    );
  });

  test('throws when repo is missing', async () => {
    setupRallyHome();
    await assert.rejects(
      () => dispatchPr({ prNumber: 1, repoPath }),
      (err) => {
        assert.ok(err.message.includes('Repository'));
        return true;
      }
    );
  });

  test('throws when repoPath is missing', async () => {
    setupRallyHome();
    await assert.rejects(
      () => dispatchPr({ prNumber: 1, repo: 'o/r' }),
      (err) => {
        assert.ok(err.message.includes('path'));
        return true;
      }
    );
  });

  test('throws when repo is not onboarded', async () => {
    const rallyHome = process.env.RALLY_HOME;
    mkdirSync(rallyHome, { recursive: true });
    writeFileSync(join(rallyHome, 'config.yaml'), yaml.dump({ version: '0.1.0' }), 'utf8');

    const exec = createExecWithPr(makePr());
    await assert.rejects(
      () => dispatchPr({ prNumber: 1, repo: 'owner/repo', repoPath, _exec: exec, _spawn: noopSpawn }),
      (err) => {
        assert.ok(err.message.includes('not onboarded'));
        return true;
      }
    );
  });

  test('throws when PR not found', async () => {
    setupRallyHome();
    const exec = createExecWithPr(null);
    await assert.rejects(
      () => dispatchPr({ prNumber: 999, repo: 'owner/repo', repoPath, _exec: exec, _spawn: noopSpawn }),
      (err) => {
        assert.ok(err.message.includes('not found') || err.message.includes('999'));
        return true;
      }
    );
  });

  test('throws when PR is already merged', async () => {
    setupRallyHome();
    const exec = createExecWithPr(makePr({ state: 'MERGED' }));
    await assert.rejects(
      () => dispatchPr({ prNumber: 5, repo: 'owner/repo', repoPath, _exec: exec, _spawn: noopSpawn }),
      (err) => {
        assert.ok(err.message.includes('already merged'));
        return true;
      }
    );
  });

  test('throws when PR is closed', async () => {
    setupRallyHome();
    const exec = createExecWithPr(makePr({ state: 'CLOSED' }));
    await assert.rejects(
      () => dispatchPr({ prNumber: 5, repo: 'owner/repo', repoPath, _exec: exec, _spawn: noopSpawn }),
      (err) => {
        assert.ok(err.message.includes('closed'));
        return true;
      }
    );
  });

  test('returns early with existing flag when worktree already exists', async () => {
    setupRallyHome();
    const pr = makePr();
    const exec = createExecWithPr(pr);

    // Create an actual git worktree so worktreeExists() returns true
    const wtPath = join(repoPath, '.worktrees', 'rally-pr-42');
    execFileSync('git', ['worktree', 'add', wtPath, '-b', 'rally/pr-42-existing'], { cwd: repoPath, stdio: 'ignore' });

    const result = await dispatchPr({ prNumber: 42, repo: 'owner/repo', repoPath, _exec: exec, _spawn: noopSpawn });
    assert.strictEqual(result.existing, true);
  });
});

// =====================================================
// dispatchPr — happy path (real git worktrees)
// =====================================================

describe('dispatchPr happy path', () => {
  test('full workflow: fetch → branch → worktree → context → active.yaml', async () => {
    const rallyHome = setupRallyHome();
    const pr = makePr({ title: 'Fix login validation' });
    const exec = createExecWithPr(pr);

    mkdirSync(join(repoPath, '.squad'), { recursive: true });
    writeFileSync(join(repoPath, '.squad', 'test.txt'), 'squad content');

    const result = await dispatchPr({
      prNumber: 42,
      repo: 'owner/repo',
      repoPath,
      _exec: exec,
      _spawn: noopSpawn,
    });

    // Verify return value
    assert.strictEqual(result.branch, 'rally/pr-42-fix-login-validation');
    assert.ok(result.worktreePath.includes('rally-pr-42'));
    assert.strictEqual(result.dispatchId, 'repo-pr-42');
    assert.strictEqual(result.pr.number, 42);
    assert.strictEqual(result.pr.title, 'Fix login validation');

    // Verify worktree was created
    assert.ok(existsSync(result.worktreePath), 'worktree directory should exist');

    // Verify worktree is checked out at PR's head ref
    assert.ok(existsSync(join(result.worktreePath, 'pr-change.txt')),
      'worktree should contain PR head ref content');

    // Verify dispatch-context.md was written with PR details
    const contextPath = join(result.worktreePath, '.squad', 'dispatch-context.md');
    assert.ok(existsSync(contextPath), 'dispatch-context.md should exist');
    const contextContent = readFileSync(contextPath, 'utf8');
    assert.ok(contextContent.includes('PR #42'));
    assert.ok(contextContent.includes('Fix login validation'));
    assert.ok(contextContent.includes('src/login.js'));
    assert.ok(contextContent.includes('+10'));

    // Verify active.yaml was updated
    const activePath = join(rallyHome, 'active.yaml');
    assert.ok(existsSync(activePath), 'active.yaml should exist');
    const active = yaml.load(readFileSync(activePath, 'utf8'));
    assert.ok(active.dispatches.length === 1);
    const dispatch = active.dispatches[0];
    assert.strictEqual(dispatch.id, 'repo-pr-42');
    assert.strictEqual(dispatch.repo, 'owner/repo');
    assert.strictEqual(dispatch.number, 42);
    assert.strictEqual(dispatch.type, 'pr');
    assert.strictEqual(dispatch.branch, 'rally/pr-42-fix-login-validation');
    assert.strictEqual(dispatch.status, 'reviewing');
  });

  test('creates branch with correct naming pattern', async () => {
    setupRallyHome();
    const pr = makePr({ title: 'Add Dark Mode Support' });
    const exec = createExecWithPr(pr);

    mkdirSync(join(repoPath, '.squad'), { recursive: true });

    const result = await dispatchPr({
      prNumber: 7,
      repo: 'owner/repo',
      repoPath,
      _exec: exec,
      _spawn: noopSpawn,
    });

    assert.strictEqual(result.branch, 'rally/pr-7-add-dark-mode-support');

    // Verify git branch actually exists
    const branches = execFileSync('git', ['branch', '--list'], {
      cwd: repoPath, encoding: 'utf8',
    });
    assert.ok(branches.includes('rally/pr-7-add-dark-mode-support'));
  });

  test('worktree created at .worktrees/rally-pr-{number}/', async () => {
    setupRallyHome();
    const pr = makePr();
    const exec = createExecWithPr(pr);

    mkdirSync(join(repoPath, '.squad'), { recursive: true });

    const result = await dispatchPr({
      prNumber: 99,
      repo: 'owner/repo',
      repoPath,
      _exec: exec,
      _spawn: noopSpawn,
    });

    const expected = join(repoPath, '.worktrees', 'rally-pr-99');
    assert.strictEqual(result.worktreePath, expected);
    assert.ok(existsSync(expected));
  });

  test('symlinks squad into worktree when teamDir provided', async () => {
    setupRallyHome();
    const pr = makePr();
    const exec = createExecWithPr(pr);

    const teamDir = join(tempDir, 'team-squad');
    mkdirSync(teamDir, { recursive: true });
    writeFileSync(join(teamDir, 'agents.yaml'), 'agents: []');

    const result = await dispatchPr({
      prNumber: 10,
      repo: 'owner/repo',
      repoPath,
      teamDir,
      _exec: exec,
      _spawn: noopSpawn,
    });

    const squadInWorktree = join(result.worktreePath, '.squad');
    assert.ok(existsSync(squadInWorktree), '.squad should exist in worktree');
  });

  test('sessionId is captured from spawn', async () => {
    setupRallyHome();
    const pr = makePr();
    const exec = createExecWithPr(pr);

    mkdirSync(join(repoPath, '.squad'), { recursive: true });

    const result = await dispatchPr({
      prNumber: 55,
      repo: 'owner/repo',
      repoPath,
      _exec: exec,
      _spawn: () => ({ pid: 98765, unref() {} }),
    });

    assert.strictEqual(result.sessionId, '98765');

    const activePath = join(process.env.RALLY_HOME, 'active.yaml');
    const active = yaml.load(readFileSync(activePath, 'utf8'));
    assert.strictEqual(active.dispatches[0].session_id, '98765');
  });

  test('gracefully handles Copilot CLI not available', async () => {
    setupRallyHome();
    const pr = makePr();
    const exec = createExecWithPr(pr);

    mkdirSync(join(repoPath, '.squad'), { recursive: true });

    const result = await dispatchPr({
      prNumber: 77,
      repo: 'owner/repo',
      repoPath,
      _exec: exec,
      _spawn: () => { throw Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' }); },
    });

    assert.strictEqual(result.sessionId, null);
    assert.strictEqual(result.branch, 'rally/pr-77-fix-login-validation');
    assert.ok(existsSync(result.worktreePath));
  });
});
