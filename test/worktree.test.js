import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  createWorktree,
  removeWorktree,
  listWorktrees,
  worktreeExists,
} from '../lib/worktree.js';

describe('worktree', () => {
  let testDir;
  let repoPath;

  beforeEach(() => {
    // Create a temporary directory for each test
    testDir = mkdtempSync(join(tmpdir(), 'worktree-test-'));
    repoPath = join(testDir, 'repo');

    // Initialize a git repository with an initial commit
    execFileSync('mkdir', ['-p', repoPath]);
    execFileSync('git', ['init'], { cwd: repoPath });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repoPath });
    execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: repoPath });
    execFileSync('touch', ['README.md'], { cwd: repoPath });
    execFileSync('git', ['add', 'README.md'], { cwd: repoPath });
    execFileSync('git', ['commit', '-m', 'Initial commit'], { cwd: repoPath });
  });

  afterEach(() => {
    // Clean up temporary directory
    if (testDir) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should create a worktree in a real temp git repo', () => {
    const worktreePath = join(testDir, 'worktree-1');
    const branchName = 'feature-branch';

    const result = createWorktree(repoPath, worktreePath, branchName);

    assert.equal(result, worktreePath);
    const worktrees = listWorktrees(repoPath);
    assert.ok(worktrees.some((wt) => wt.path === worktreePath));
    assert.ok(worktrees.some((wt) => wt.branch && wt.branch.includes(branchName)));
  });

  it('should remove a worktree', () => {
    const worktreePath = join(testDir, 'worktree-2');
    const branchName = 'temp-branch';

    createWorktree(repoPath, worktreePath, branchName);
    assert.ok(worktreeExists(repoPath, worktreePath));

    removeWorktree(repoPath, worktreePath);
    assert.equal(worktreeExists(repoPath, worktreePath), false);
  });

  it('should list worktrees including main and created', () => {
    const worktreePath1 = join(testDir, 'worktree-3');
    const worktreePath2 = join(testDir, 'worktree-4');

    createWorktree(repoPath, worktreePath1, 'branch-1');
    createWorktree(repoPath, worktreePath2, 'branch-2');

    const worktrees = listWorktrees(repoPath);

    // Should include main repo and two worktrees
    assert.ok(worktrees.length >= 3);
    assert.ok(worktrees.some((wt) => wt.path === repoPath));
    assert.ok(worktrees.some((wt) => wt.path === worktreePath1));
    assert.ok(worktrees.some((wt) => wt.path === worktreePath2));
  });

  it('should return true when worktree exists', () => {
    const worktreePath = join(testDir, 'worktree-5');
    const branchName = 'exists-branch';

    createWorktree(repoPath, worktreePath, branchName);
    assert.equal(worktreeExists(repoPath, worktreePath), true);
  });

  it('should return false when worktree does not exist', () => {
    const worktreePath = join(testDir, 'nonexistent-worktree');
    assert.equal(worktreeExists(repoPath, worktreePath), false);
  });

  it('should throw when creating worktree with existing branch', () => {
    const worktreePath1 = join(testDir, 'worktree-6');
    const worktreePath2 = join(testDir, 'worktree-7');
    const branchName = 'duplicate-branch';

    createWorktree(repoPath, worktreePath1, branchName);

    assert.throws(
      () => createWorktree(repoPath, worktreePath2, branchName),
      (error) => {
        assert.ok(error.message.includes('Failed to create worktree'));
        return true;
      }
    );
  });

  it('should handle non-git-repo gracefully', () => {
    const nonGitDir = join(testDir, 'not-a-repo');
    execFileSync('mkdir', ['-p', nonGitDir]);

    const worktreePath = join(testDir, 'worktree-8');

    assert.throws(
      () => createWorktree(nonGitDir, worktreePath, 'test-branch'),
      (error) => {
        assert.ok(error.message.includes('Failed to create worktree'));
        return true;
      }
    );
  });

  it('should resolve relative paths to absolute paths', () => {
    const relativePath = join(testDir, 'worktree-relative');
    const branchName = 'relative-branch';

    const result = createWorktree(repoPath, relativePath, branchName);

    // Result should be an absolute path
    assert.ok(result.startsWith('/') || result.match(/^[A-Z]:\\/));
    assert.ok(worktreeExists(repoPath, relativePath));
  });
});
