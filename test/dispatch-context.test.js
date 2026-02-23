import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeIssueContext, writePrContext } from '../lib/dispatch-context.js';

describe('dispatch-context', () => {
  let tempDir;
  let worktreePath;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'rally-dispatch-ctx-'));
    worktreePath = join(tempDir, 'worktree');
    mkdirSync(worktreePath, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  // ---- writeIssueContext ----

  describe('writeIssueContext', () => {
    test('throws when worktree path does not exist', () => {
      assert.throws(
        () => writeIssueContext(join(tempDir, 'missing'), { number: 1, title: 'T', labels: [], assignees: [], body: '' }),
        /does not exist/
      );
    });

    test('throws when issue data is missing number', () => {
      assert.throws(
        () => writeIssueContext(worktreePath, { title: 'T', labels: [], assignees: [], body: '' }),
        /number and title/
      );
    });

    test('throws when issue data is missing title', () => {
      assert.throws(
        () => writeIssueContext(worktreePath, { number: 1, labels: [], assignees: [], body: '' }),
        /number and title/
      );
    });

    test('creates .squad dir if missing and writes dispatch-context.md', () => {
      writeIssueContext(worktreePath, {
        number: 42, title: 'Add login', labels: [], assignees: [], body: '',
      });
      const contextPath = join(worktreePath, '.squad', 'dispatch-context.md');
      assert.ok(existsSync(contextPath));
    });

    test('writes to existing .squad dir', () => {
      mkdirSync(join(worktreePath, '.squad'), { recursive: true });
      writeIssueContext(worktreePath, {
        number: 1, title: 'T', labels: [], assignees: [], body: '',
      });
      assert.ok(existsSync(join(worktreePath, '.squad', 'dispatch-context.md')));
    });

    test('template contains issue number and title', () => {
      writeIssueContext(worktreePath, {
        number: 42, title: 'Fix navbar', labels: [], assignees: [], body: '',
      });
      const content = readFileSync(join(worktreePath, '.squad', 'dispatch-context.md'), 'utf8');
      assert.ok(content.includes('# Issue #42: Fix navbar'));
    });

    test('template contains labels', () => {
      writeIssueContext(worktreePath, {
        number: 1, title: 'T', labels: [{ name: 'bug' }, { name: 'critical' }], assignees: [], body: '',
      });
      const content = readFileSync(join(worktreePath, '.squad', 'dispatch-context.md'), 'utf8');
      assert.ok(content.includes('bug'));
      assert.ok(content.includes('critical'));
    });

    test('template contains assignees', () => {
      writeIssueContext(worktreePath, {
        number: 1, title: 'T', labels: [], assignees: [{ login: 'alice' }, { login: 'bob' }], body: '',
      });
      const content = readFileSync(join(worktreePath, '.squad', 'dispatch-context.md'), 'utf8');
      assert.ok(content.includes('alice'));
      assert.ok(content.includes('bob'));
    });

    test('template contains body', () => {
      writeIssueContext(worktreePath, {
        number: 1, title: 'T', labels: [], assignees: [], body: 'Detailed description here.',
      });
      const content = readFileSync(join(worktreePath, '.squad', 'dispatch-context.md'), 'utf8');
      assert.ok(content.includes('Detailed description here.'));
    });

    test('handles empty labels and assignees gracefully', () => {
      writeIssueContext(worktreePath, {
        number: 5, title: 'Minimal', labels: [], assignees: [], body: '',
      });
      const content = readFileSync(join(worktreePath, '.squad', 'dispatch-context.md'), 'utf8');
      assert.ok(content.includes('none'));
    });

    test('handles null body', () => {
      writeIssueContext(worktreePath, {
        number: 6, title: 'Null body', labels: [], assignees: [], body: null,
      });
      const contextPath = join(worktreePath, '.squad', 'dispatch-context.md');
      assert.ok(existsSync(contextPath));
    });
  });

  // ---- writePrContext ----

  describe('writePrContext', () => {
    test('throws when worktree path does not exist', () => {
      assert.throws(
        () => writePrContext(join(tempDir, 'missing'), { number: 1, title: 'T', baseRefName: 'main', headRefName: 'feat', files: [], body: '' }),
        /does not exist/
      );
    });

    test('throws when PR data is missing number', () => {
      assert.throws(
        () => writePrContext(worktreePath, { title: 'T', baseRefName: 'main', headRefName: 'feat', files: [], body: '' }),
        /number and title/
      );
    });

    test('throws when PR data is missing title', () => {
      assert.throws(
        () => writePrContext(worktreePath, { number: 1, baseRefName: 'main', headRefName: 'feat', files: [], body: '' }),
        /number and title/
      );
    });

    test('throws when PR data is missing baseRefName', () => {
      assert.throws(
        () => writePrContext(worktreePath, { number: 1, title: 'T', headRefName: 'feat', files: [], body: '' }),
        /baseRefName and headRefName/
      );
    });

    test('throws when PR data is missing headRefName', () => {
      assert.throws(
        () => writePrContext(worktreePath, { number: 1, title: 'T', baseRefName: 'main', files: [], body: '' }),
        /baseRefName and headRefName/
      );
    });

    test('handles file objects with missing properties', () => {
      writePrContext(worktreePath, {
        number: 1, title: 'T', baseRefName: 'main', headRefName: 'fix',
        files: [{ }, { path: 'a.js' }],
        body: '',
      });
      const content = readFileSync(join(worktreePath, '.squad', 'dispatch-context.md'), 'utf8');
      assert.ok(content.includes('+0 -0'));
      assert.ok(content.includes('a.js'));
    });

    test('creates .squad dir if missing and writes dispatch-context.md', () => {
      writePrContext(worktreePath, {
        number: 99, title: 'Add feature', baseRefName: 'main', headRefName: 'feat', files: [], body: '',
      });
      assert.ok(existsSync(join(worktreePath, '.squad', 'dispatch-context.md')));
    });

    test('template contains PR number and title', () => {
      writePrContext(worktreePath, {
        number: 55, title: 'Cool PR', baseRefName: 'main', headRefName: 'cool', files: [], body: '',
      });
      const content = readFileSync(join(worktreePath, '.squad', 'dispatch-context.md'), 'utf8');
      assert.ok(content.includes('# PR #55: Cool PR'));
    });

    test('template contains base and head branches', () => {
      writePrContext(worktreePath, {
        number: 1, title: 'T', baseRefName: 'main', headRefName: 'feature/new-thing', files: [], body: '',
      });
      const content = readFileSync(join(worktreePath, '.squad', 'dispatch-context.md'), 'utf8');
      assert.ok(content.includes('**Base:** main'));
      assert.ok(content.includes('**Head:** feature/new-thing'));
    });

    test('template lists changed files with stats', () => {
      writePrContext(worktreePath, {
        number: 1, title: 'T', baseRefName: 'main', headRefName: 'fix',
        files: [
          { path: 'src/app.js', additions: 10, deletions: 3 },
          { path: 'README.md', additions: 1, deletions: 0 },
        ],
        body: '',
      });
      const content = readFileSync(join(worktreePath, '.squad', 'dispatch-context.md'), 'utf8');
      assert.ok(content.includes('src/app.js'));
      assert.ok(content.includes('README.md'));
      assert.ok(content.includes('+10'));
      assert.ok(content.includes('-3'));
    });

    test('template shows message for empty files list', () => {
      writePrContext(worktreePath, {
        number: 1, title: 'T', baseRefName: 'main', headRefName: 'fix', files: [], body: '',
      });
      const content = readFileSync(join(worktreePath, '.squad', 'dispatch-context.md'), 'utf8');
      assert.ok(content.includes('No files changed'));
    });

    test('template contains body', () => {
      writePrContext(worktreePath, {
        number: 1, title: 'T', baseRefName: 'main', headRefName: 'fix', files: [],
        body: 'This PR adds feature X.',
      });
      const content = readFileSync(join(worktreePath, '.squad', 'dispatch-context.md'), 'utf8');
      assert.ok(content.includes('This PR adds feature X.'));
    });

    test('handles null body', () => {
      writePrContext(worktreePath, {
        number: 1, title: 'T', baseRefName: 'main', headRefName: 'fix', files: [], body: null,
      });
      assert.ok(existsSync(join(worktreePath, '.squad', 'dispatch-context.md')));
    });
  });

  // ---- output format ----

  describe('output format', () => {
    test('issue context starts with markdown heading', () => {
      writeIssueContext(worktreePath, {
        number: 100, title: 'Heading check', labels: [{ name: 'test' }], assignees: [{ login: 'dev' }], body: 'Some body.',
      });
      const content = readFileSync(join(worktreePath, '.squad', 'dispatch-context.md'), 'utf8');
      assert.ok(content.startsWith('#'));
    });

    test('PR context starts with markdown heading', () => {
      writePrContext(worktreePath, {
        number: 101, title: 'PR heading', baseRefName: 'main', headRefName: 'pr-md',
        files: [{ path: 'a.js', additions: 1, deletions: 0 }], body: 'PR body.',
      });
      const content = readFileSync(join(worktreePath, '.squad', 'dispatch-context.md'), 'utf8');
      assert.ok(content.startsWith('#'));
    });
  });
});
