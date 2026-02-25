import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, rmSync, existsSync, readFileSync,
  mkdirSync, writeFileSync, readdirSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import yaml from 'js-yaml';
import { dispatchIssue } from '../lib/dispatch-issue.js';
import { slugify } from '../lib/utils.js';

// =====================================================
// Helpers
// =====================================================

let tempDir;
let repoPath;
let originalEnv;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'rally-dispatch-issue-'));
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
  // Register test repo as onboarded
  writeFileSync(join(rallyHome, 'projects.yaml'), yaml.dump({
    projects: [{ name: 'repo', path: repoPath, team: 'shared', onboarded: new Date().toISOString() }],
  }), 'utf8');
  return rallyHome;
}

function makeIssue(overrides = {}) {
  return {
    title: 'Add login form',
    body: 'Implement a login form with email and password.',
    labels: [{ name: 'enhancement' }],
    assignees: [{ login: 'alice' }],
    ...overrides,
  };
}

/**
 * Creates a mock _exec that returns issue data for `gh issue view`
 * and delegates git commands to real execFileSync.
 */
function createExecWithIssue(issueData) {
  return (cmd, args, opts) => {
    if (cmd === 'gh' && args[0] === '--version') {
      return 'gh version 2.0.0'; // Mock gh version check
    }
    if (cmd === 'gh' && args[0] === 'issue' && args[1] === 'view') {
      if (!issueData) {
        const err = new Error('Could not resolve to an Issue with the number of 999');
        throw err;
      }
      return JSON.stringify(issueData);
    }
    if (cmd === 'gh' && args[0] === 'copilot') {
      return ''; // Copilot is "available" in tests
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
// slugify
// =====================================================

describe('slugify', () => {
  test('converts title to lowercase hyphenated slug', () => {
    assert.strictEqual(slugify('Add Login Form'), 'add-login-form');
  });

  test('strips special characters', () => {
    assert.strictEqual(slugify('Fix: broken navbar [urgent]'), 'fix-broken-navbar-urgent');
  });

  test('trims leading/trailing hyphens', () => {
    assert.strictEqual(slugify('---hello---'), 'hello');
  });

  test('caps at 50 characters', () => {
    const long = 'a'.repeat(100);
    assert.ok(slugify(long).length <= 50);
  });

  test('returns untitled for non-Latin titles', () => {
    assert.strictEqual(slugify('你好世界'), 'untitled');
    assert.strictEqual(slugify('!!!'), 'untitled');
    assert.strictEqual(slugify('🚀🔥'), 'untitled');
  });

  test('returns untitled for empty string', () => {
    assert.strictEqual(slugify(''), 'untitled');
  });
});

// =====================================================
// dispatchIssue — error paths
// =====================================================

describe('dispatchIssue error paths', () => {
  test('throws RallyError when gh CLI is missing', async () => {
    setupRallyHome();
    const execMissingGh = () => {
      throw new Error('gh: command not found');
    };
    await assert.rejects(
      () => dispatchIssue({ issueNumber: 42, repo: 'owner/repo', repoPath, _exec: execMissingGh }),
      (err) => {
        assert.ok(err.message.includes('gh'));
        assert.ok(err.message.includes('Missing required tools'));
        return true;
      }
    );
  });

  test('throws when issue number is missing', async () => {
    setupRallyHome();
    await assert.rejects(
      () => dispatchIssue({ repo: 'owner/repo', repoPath }),
      (err) => {
        assert.ok(err.message.includes('Issue number is required'));
        return true;
      }
    );
  });

  test('throws when repo is missing', async () => {
    setupRallyHome();
    await assert.rejects(
      () => dispatchIssue({ issueNumber: 1, repoPath }),
      (err) => {
        assert.ok(err.message.includes('Repository'));
        return true;
      }
    );
  });

  test('throws when repoPath is missing', async () => {
    setupRallyHome();
    await assert.rejects(
      () => dispatchIssue({ issueNumber: 1, repo: 'o/r' }),
      (err) => {
        assert.ok(err.message.includes('path'));
        return true;
      }
    );
  });

  test('throws when issue not found', async () => {
    setupRallyHome();
    const exec = createExecWithIssue(null);
    await assert.rejects(
      () => dispatchIssue({ issueNumber: 999, repo: 'owner/repo', repoPath, _exec: exec, _spawn: noopSpawn }),
      (err) => {
        assert.ok(err.message.includes('not found') || err.message.includes('999'));
        return true;
      }
    );
  });

  test('returns early when worktree directory already exists', async () => {
    setupRallyHome();
    const issue = makeIssue();
    const exec = createExecWithIssue(issue);

    // Create an actual git worktree so worktreeExists() returns true
    const wtPath = join(repoPath, '.worktrees', 'rally-42');
    execFileSync('git', ['worktree', 'add', wtPath, '-b', 'rally/42-existing'], { cwd: repoPath, stdio: 'ignore' });

    const result = await dispatchIssue({ issueNumber: 42, repo: 'owner/repo', repoPath, _exec: exec, _spawn: noopSpawn, trust: true });
    assert.strictEqual(result.existing, true);
    assert.ok(result.worktreePath.includes('rally-42'));
  });

  test('throws when repo is not onboarded', async () => {
    const rallyHome = process.env.RALLY_HOME;
    mkdirSync(rallyHome, { recursive: true });
    writeFileSync(join(rallyHome, 'config.yaml'), yaml.dump({ version: '0.1.0' }), 'utf8');
    // No projects.yaml — repo is not onboarded

    const exec = createExecWithIssue(makeIssue());
    await assert.rejects(
      () => dispatchIssue({ issueNumber: 1, repo: 'owner/repo', repoPath, _exec: exec, _spawn: noopSpawn }),
      (err) => {
        assert.ok(err.message.includes('not onboarded'));
        return true;
      }
    );
  });

  test('throws when issue number is zero', async () => {
    setupRallyHome();
    const exec = createExecWithIssue(makeIssue());
    await assert.rejects(
      () => dispatchIssue({ issueNumber: 0, repo: 'owner/repo', repoPath, _exec: exec, _spawn: noopSpawn }),
      (err) => {
        assert.ok(err.message.includes('Issue number is required') || err.message.includes('positive integer'));
        return true;
      }
    );
  });

  test('throws when issue number is a non-numeric string', async () => {
    setupRallyHome();
    const exec = createExecWithIssue(makeIssue());
    await assert.rejects(
      () => dispatchIssue({ issueNumber: 'abc', repo: 'owner/repo', repoPath, _exec: exec, _spawn: noopSpawn }),
      (err) => {
        assert.ok(err.message.includes('positive integer'));
        return true;
      }
    );
  });
});

// =====================================================
// dispatchIssue — happy path (real git worktrees)
// =====================================================

describe('dispatchIssue happy path', () => {
  test('full workflow: fetch → branch → worktree → context → active.yaml', async () => {
    const rallyHome = setupRallyHome();
    const issue = makeIssue({ title: 'Add login form' });
    const exec = createExecWithIssue(issue);

    // Create .squad source for symlink
    const squadSource = join(repoPath, '.squad');
    mkdirSync(squadSource, { recursive: true });
    writeFileSync(join(squadSource, 'test.txt'), 'squad content');

    const result = await dispatchIssue({
      issueNumber: 42,
      repo: 'owner/repo',
      repoPath,
      _exec: exec,
      _spawn: noopSpawn,
      trust: true,
    });

    // Verify return value
    assert.strictEqual(result.branch, 'rally/42-add-login-form');
    assert.ok(result.worktreePath.includes('rally-42'));
    assert.strictEqual(result.dispatchId, 'repo-issue-42');
    assert.strictEqual(result.issue.number, 42);
    assert.strictEqual(result.issue.title, 'Add login form');

    // Verify worktree was created
    assert.ok(existsSync(result.worktreePath), 'worktree directory should exist');

    // Verify dispatch-context.md was written
    const contextPath = join(result.worktreePath, '.squad', 'dispatch-context.md');
    assert.ok(existsSync(contextPath), 'dispatch-context.md should exist');
    const contextContent = readFileSync(contextPath, 'utf8');
    assert.ok(contextContent.includes('#42'));
    assert.ok(contextContent.includes('Add login form'));

    // Verify active.yaml was updated
    const activePath = join(rallyHome, 'active.yaml');
    assert.ok(existsSync(activePath), 'active.yaml should exist');
    const active = yaml.load(readFileSync(activePath, 'utf8'), { schema: yaml.CORE_SCHEMA });
    assert.ok(active.dispatches.length === 1);
    const dispatch = active.dispatches[0];
    assert.strictEqual(dispatch.id, 'repo-issue-42');
    assert.strictEqual(dispatch.repo, 'owner/repo');
    assert.strictEqual(dispatch.number, 42);
    assert.strictEqual(dispatch.type, 'issue');
    assert.strictEqual(dispatch.branch, 'rally/42-add-login-form');
    assert.strictEqual(dispatch.status, 'planning');
  });

  test('creates branch with correct naming pattern', async () => {
    setupRallyHome();
    const issue = makeIssue({ title: 'Fix Broken Navbar Component' });
    const exec = createExecWithIssue(issue);

    mkdirSync(join(repoPath, '.squad'), { recursive: true });

    const result = await dispatchIssue({
      issueNumber: 7,
      repo: 'owner/repo',
      repoPath,
      _exec: exec,
      _spawn: noopSpawn,
      trust: true,
    });

    assert.strictEqual(result.branch, 'rally/7-fix-broken-navbar-component');

    // Verify git branch actually exists
    const branches = execFileSync('git', ['branch', '--list'], {
      cwd: repoPath, encoding: 'utf8',
    });
    assert.ok(branches.includes('rally/7-fix-broken-navbar-component'));
  });

  test('worktree created at .worktrees/rally-{number}/', async () => {
    setupRallyHome();
    const issue = makeIssue();
    const exec = createExecWithIssue(issue);

    mkdirSync(join(repoPath, '.squad'), { recursive: true });

    const result = await dispatchIssue({
      issueNumber: 99,
      repo: 'owner/repo',
      repoPath,
      _exec: exec,
      _spawn: noopSpawn,
      trust: true,
    });

    const expected = join(repoPath, '.worktrees', 'rally-99');
    assert.strictEqual(result.worktreePath, expected);
    assert.ok(existsSync(expected));
  });

  test('symlinks squad into worktree when teamDir provided', async () => {
    const rallyHome = setupRallyHome();
    const issue = makeIssue();
    const exec = createExecWithIssue(issue);

    // Create a separate team directory
    const teamDir = join(tempDir, 'team-squad');
    mkdirSync(teamDir, { recursive: true });
    writeFileSync(join(teamDir, 'agents.yaml'), 'agents: []');

    const result = await dispatchIssue({
      issueNumber: 10,
      repo: 'owner/repo',
      repoPath,
      teamDir,
      _exec: exec,
      _spawn: noopSpawn,
      trust: true,
    });

    // Verify .squad exists in worktree (either as symlink or directory)
    const squadInWorktree = join(result.worktreePath, '.squad');
    assert.ok(existsSync(squadInWorktree), '.squad should exist in worktree');
  });

  test('sessionId is captured from spawn', async () => {
    setupRallyHome();
    const issue = makeIssue();
    const exec = createExecWithIssue(issue);

    mkdirSync(join(repoPath, '.squad'), { recursive: true });

    const result = await dispatchIssue({
      issueNumber: 55,
      repo: 'owner/repo',
      repoPath,
      _exec: exec,
      _spawn: () => ({ pid: 98765, unref() {} }),
      trust: true,
    });

    assert.strictEqual(result.sessionId, '98765');

    // Verify session_id is persisted to active.yaml
    const activePath = join(process.env.RALLY_HOME, 'active.yaml');
    const active = yaml.load(readFileSync(activePath, 'utf8'), { schema: yaml.CORE_SCHEMA });
    assert.strictEqual(active.dispatches[0].session_id, '98765');
  });

  test('gracefully handles Copilot CLI not available', async () => {
    setupRallyHome();
    const issue = makeIssue();
    const exec = createExecWithIssue(issue);

    mkdirSync(join(repoPath, '.squad'), { recursive: true });

    const result = await dispatchIssue({
      issueNumber: 77,
      repo: 'owner/repo',
      repoPath,
      _exec: exec,
      _spawn: () => { throw Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' }); },
      trust: true,
    });

    // Should complete without throwing, sessionId null
    assert.strictEqual(result.sessionId, null);
    assert.strictEqual(result.branch, 'rally/77-add-login-form');
    // Worktree and active.yaml should still be set up
    assert.ok(existsSync(result.worktreePath));
  });

  test('skips Copilot launch when checkCopilotAvailable returns false', async () => {
    setupRallyHome();
    const issue = makeIssue();
    let spawnCalled = false;

    // _exec that fails for copilot check (not installed)
    const exec = (cmd, args, opts) => {
      if (cmd === 'gh' && args[0] === '--version') {
        return 'gh version 2.0.0';
      }
      if (cmd === 'gh' && args[0] === 'issue' && args[1] === 'view') {
        return JSON.stringify(issue);
      }
      if (cmd === 'gh' && args[0] === 'copilot') {
        throw new Error('gh copilot not installed');
      }
      return execFileSync(cmd, args, opts);
    };

    mkdirSync(join(repoPath, '.squad'), { recursive: true });

    const result = await dispatchIssue({
      issueNumber: 66,
      repo: 'owner/repo',
      repoPath,
      _exec: exec,
      _spawn: () => { spawnCalled = true; return { pid: 1, unref() {} }; },
      trust: true,
    });

    assert.strictEqual(result.sessionId, null);
    assert.strictEqual(spawnCalled, false, 'spawn should not be called when copilot is unavailable');
  });

  test('cleans up worktree when post-creation step fails', async () => {
    setupRallyHome();
    const issue = makeIssue();

    // _exec that succeeds for gh + git but makes addDispatch fail
    const exec = (cmd, args, opts) => {
      if (cmd === 'gh' && args[0] === '--version') {
        return 'gh version 2.0.0';
      }
      if (cmd === 'gh' && args[0] === 'issue' && args[1] === 'view') {
        return JSON.stringify(issue);
      }
      return execFileSync(cmd, args, opts);
    };

    mkdirSync(join(repoPath, '.squad'), { recursive: true });

    // Make active.yaml a directory so addDispatch throws
    const activePath = join(process.env.RALLY_HOME, 'active.yaml');
    mkdirSync(activePath, { recursive: true });
    writeFileSync(join(activePath, 'blocker'), 'x');

    const worktreePath = join(repoPath, '.worktrees', 'rally-88');

    await assert.rejects(
      () => dispatchIssue({
        issueNumber: 88,
        repo: 'owner/repo',
        repoPath,
        _exec: exec,
        _spawn: noopSpawn,
        trust: true,
      }),
    );

    // Worktree directory should be cleaned up
    assert.ok(!existsSync(worktreePath), 'worktree should be removed after failure');
  });
});
