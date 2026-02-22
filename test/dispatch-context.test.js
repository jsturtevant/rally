import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, rmSync, existsSync, readFileSync,
  mkdirSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Module under test — will exist when #17 lands
// import { writeIssueContext, writePrContext } from '../lib/dispatch-context.js';

describe('dispatch-context', () => {
  let tempDir;
  let worktreePath;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'rally-dispatch-ctx-test-'));
    worktreePath = join(tempDir, 'worktree');
    mkdirSync(join(worktreePath, '.squad'), { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  // =====================================================
  // ERROR PATHS — tested first per team convention
  // =====================================================

  describe('writeIssueContext — error paths', () => {
    test('error: throws when worktree path does not exist', async () => {
      const { writeIssueContext } = await import('../lib/dispatch-context.js');
      const bogusPath = join(tempDir, 'nonexistent-worktree');

      await assert.rejects(
        () => writeIssueContext({
          worktreePath: bogusPath,
          issue: { number: 1, title: 'Test', labels: [], assignees: [], body: '' },
        }),
        (err) => {
          assert.ok(err.message.length > 0);
          return true;
        }
      );
    });

    test('error: throws when issue data is missing required fields', async () => {
      const { writeIssueContext } = await import('../lib/dispatch-context.js');

      await assert.rejects(
        () => writeIssueContext({
          worktreePath,
          issue: {},
        }),
        (err) => {
          assert.ok(err.message.length > 0);
          return true;
        }
      );
    });

    test('error: throws when issue number is missing', async () => {
      const { writeIssueContext } = await import('../lib/dispatch-context.js');

      await assert.rejects(
        () => writeIssueContext({
          worktreePath,
          issue: { title: 'No number', labels: [], assignees: [], body: 'body' },
        }),
        (err) => {
          assert.ok(err.message.length > 0);
          return true;
        }
      );
    });
  });

  describe('writePrContext — error paths', () => {
    test('error: throws when worktree path does not exist', async () => {
      const { writePrContext } = await import('../lib/dispatch-context.js');
      const bogusPath = join(tempDir, 'nonexistent-worktree');

      await assert.rejects(
        () => writePrContext({
          worktreePath: bogusPath,
          pr: { number: 1, title: 'Test', baseRefName: 'main', headRefName: 'feat', files: [], body: '' },
        }),
        (err) => {
          assert.ok(err.message.length > 0);
          return true;
        }
      );
    });

    test('error: throws when PR data is missing required fields', async () => {
      const { writePrContext } = await import('../lib/dispatch-context.js');

      await assert.rejects(
        () => writePrContext({
          worktreePath,
          pr: {},
        }),
        (err) => {
          assert.ok(err.message.length > 0);
          return true;
        }
      );
    });
  });

  // =====================================================
  // ISSUE TEMPLATE — happy paths
  // =====================================================

  describe('writeIssueContext — happy paths', () => {
    test('writes dispatch-context.md to .squad/ in worktree', async () => {
      const { writeIssueContext } = await import('../lib/dispatch-context.js');

      await writeIssueContext({
        worktreePath,
        issue: {
          number: 42,
          title: 'Add login form',
          labels: [{ name: 'enhancement' }, { name: 'ui' }],
          assignees: [{ login: 'alice' }],
          body: 'We need a login form on the homepage.',
        },
      });

      const contextPath = join(worktreePath, '.squad', 'dispatch-context.md');
      assert.ok(existsSync(contextPath), 'dispatch-context.md should be written');
    });

    test('issue template contains issue number', async () => {
      const { writeIssueContext } = await import('../lib/dispatch-context.js');

      await writeIssueContext({
        worktreePath,
        issue: {
          number: 42,
          title: 'Add login form',
          labels: [],
          assignees: [],
          body: 'Body text.',
        },
      });

      const content = readFileSync(join(worktreePath, '.squad', 'dispatch-context.md'), 'utf8');
      assert.ok(content.includes('42'), 'should contain issue number');
    });

    test('issue template contains title', async () => {
      const { writeIssueContext } = await import('../lib/dispatch-context.js');

      await writeIssueContext({
        worktreePath,
        issue: {
          number: 7,
          title: 'Fix broken navbar',
          labels: [],
          assignees: [],
          body: '',
        },
      });

      const content = readFileSync(join(worktreePath, '.squad', 'dispatch-context.md'), 'utf8');
      assert.ok(content.includes('Fix broken navbar'), 'should contain issue title');
    });

    test('issue template contains labels', async () => {
      const { writeIssueContext } = await import('../lib/dispatch-context.js');

      await writeIssueContext({
        worktreePath,
        issue: {
          number: 10,
          title: 'Labelled issue',
          labels: [{ name: 'bug' }, { name: 'critical' }],
          assignees: [],
          body: '',
        },
      });

      const content = readFileSync(join(worktreePath, '.squad', 'dispatch-context.md'), 'utf8');
      assert.ok(content.includes('bug'), 'should contain label "bug"');
      assert.ok(content.includes('critical'), 'should contain label "critical"');
    });

    test('issue template contains assignees', async () => {
      const { writeIssueContext } = await import('../lib/dispatch-context.js');

      await writeIssueContext({
        worktreePath,
        issue: {
          number: 11,
          title: 'Assigned issue',
          labels: [],
          assignees: [{ login: 'bob' }, { login: 'carol' }],
          body: '',
        },
      });

      const content = readFileSync(join(worktreePath, '.squad', 'dispatch-context.md'), 'utf8');
      assert.ok(content.includes('bob'), 'should contain assignee "bob"');
      assert.ok(content.includes('carol'), 'should contain assignee "carol"');
    });

    test('issue template contains body text', async () => {
      const { writeIssueContext } = await import('../lib/dispatch-context.js');
      const issueBody = 'This is a detailed description\nwith multiple lines.';

      await writeIssueContext({
        worktreePath,
        issue: {
          number: 12,
          title: 'Body test',
          labels: [],
          assignees: [],
          body: issueBody,
        },
      });

      const content = readFileSync(join(worktreePath, '.squad', 'dispatch-context.md'), 'utf8');
      assert.ok(content.includes('detailed description'), 'should contain body text');
    });

    test('issue template handles empty labels and assignees', async () => {
      const { writeIssueContext } = await import('../lib/dispatch-context.js');

      await writeIssueContext({
        worktreePath,
        issue: {
          number: 13,
          title: 'Minimal issue',
          labels: [],
          assignees: [],
          body: '',
        },
      });

      const contextPath = join(worktreePath, '.squad', 'dispatch-context.md');
      assert.ok(existsSync(contextPath), 'should still write file with empty arrays');
      const content = readFileSync(contextPath, 'utf8');
      assert.ok(content.includes('13'), 'should contain issue number');
      assert.ok(content.includes('Minimal issue'), 'should contain title');
    });

    test('issue template handles null body', async () => {
      const { writeIssueContext } = await import('../lib/dispatch-context.js');

      await writeIssueContext({
        worktreePath,
        issue: {
          number: 14,
          title: 'Null body issue',
          labels: [],
          assignees: [],
          body: null,
        },
      });

      const contextPath = join(worktreePath, '.squad', 'dispatch-context.md');
      assert.ok(existsSync(contextPath), 'should still write file with null body');
    });
  });

  // =====================================================
  // PR TEMPLATE — happy paths
  // =====================================================

  describe('writePrContext — happy paths', () => {
    test('writes dispatch-context.md for PR', async () => {
      const { writePrContext } = await import('../lib/dispatch-context.js');

      await writePrContext({
        worktreePath,
        pr: {
          number: 99,
          title: 'Add feature X',
          baseRefName: 'main',
          headRefName: 'feature-x',
          files: [{ path: 'src/index.js', additions: 5, deletions: 2 }],
          body: 'PR description here.',
        },
      });

      const contextPath = join(worktreePath, '.squad', 'dispatch-context.md');
      assert.ok(existsSync(contextPath), 'dispatch-context.md should be written for PR');
    });

    test('PR template contains PR number', async () => {
      const { writePrContext } = await import('../lib/dispatch-context.js');

      await writePrContext({
        worktreePath,
        pr: {
          number: 55,
          title: 'PR number test',
          baseRefName: 'main',
          headRefName: 'fix-it',
          files: [],
          body: '',
        },
      });

      const content = readFileSync(join(worktreePath, '.squad', 'dispatch-context.md'), 'utf8');
      assert.ok(content.includes('55'), 'should contain PR number');
    });

    test('PR template contains base and head branches', async () => {
      const { writePrContext } = await import('../lib/dispatch-context.js');

      await writePrContext({
        worktreePath,
        pr: {
          number: 56,
          title: 'Branch test',
          baseRefName: 'main',
          headRefName: 'feature/new-thing',
          files: [],
          body: '',
        },
      });

      const content = readFileSync(join(worktreePath, '.squad', 'dispatch-context.md'), 'utf8');
      assert.ok(content.includes('main'), 'should contain base branch');
      assert.ok(content.includes('feature/new-thing'), 'should contain head branch');
    });

    test('PR template contains changed files list', async () => {
      const { writePrContext } = await import('../lib/dispatch-context.js');

      await writePrContext({
        worktreePath,
        pr: {
          number: 57,
          title: 'Files test',
          baseRefName: 'main',
          headRefName: 'fix-files',
          files: [
            { path: 'src/app.js', additions: 10, deletions: 3 },
            { path: 'README.md', additions: 1, deletions: 0 },
          ],
          body: '',
        },
      });

      const content = readFileSync(join(worktreePath, '.squad', 'dispatch-context.md'), 'utf8');
      assert.ok(content.includes('src/app.js'), 'should list changed file src/app.js');
      assert.ok(content.includes('README.md'), 'should list changed file README.md');
    });

    test('PR template contains body', async () => {
      const { writePrContext } = await import('../lib/dispatch-context.js');
      const prBody = 'This PR adds feature X with full tests.';

      await writePrContext({
        worktreePath,
        pr: {
          number: 58,
          title: 'Body test',
          baseRefName: 'main',
          headRefName: 'feat-x',
          files: [],
          body: prBody,
        },
      });

      const content = readFileSync(join(worktreePath, '.squad', 'dispatch-context.md'), 'utf8');
      assert.ok(content.includes('adds feature X'), 'should contain PR body text');
    });

    test('PR template handles empty files list', async () => {
      const { writePrContext } = await import('../lib/dispatch-context.js');

      await writePrContext({
        worktreePath,
        pr: {
          number: 59,
          title: 'Empty files',
          baseRefName: 'main',
          headRefName: 'empty',
          files: [],
          body: '',
        },
      });

      const contextPath = join(worktreePath, '.squad', 'dispatch-context.md');
      assert.ok(existsSync(contextPath), 'should write file even with no changed files');
    });
  });

  // =====================================================
  // OUTPUT FORMAT — markdown structure
  // =====================================================

  describe('output format', () => {
    test('issue context is valid markdown (contains heading)', async () => {
      const { writeIssueContext } = await import('../lib/dispatch-context.js');

      await writeIssueContext({
        worktreePath,
        issue: {
          number: 100,
          title: 'Markdown check',
          labels: [{ name: 'test' }],
          assignees: [{ login: 'dev' }],
          body: 'Some body.',
        },
      });

      const content = readFileSync(join(worktreePath, '.squad', 'dispatch-context.md'), 'utf8');
      assert.ok(content.startsWith('#') || content.includes('\n#'), 'should contain markdown heading');
    });

    test('PR context is valid markdown (contains heading)', async () => {
      const { writePrContext } = await import('../lib/dispatch-context.js');

      await writePrContext({
        worktreePath,
        pr: {
          number: 101,
          title: 'PR markdown check',
          baseRefName: 'main',
          headRefName: 'pr-md',
          files: [{ path: 'a.js', additions: 1, deletions: 0 }],
          body: 'PR body.',
        },
      });

      const content = readFileSync(join(worktreePath, '.squad', 'dispatch-context.md'), 'utf8');
      assert.ok(content.startsWith('#') || content.includes('\n#'), 'should contain markdown heading');
    });
  });
});
