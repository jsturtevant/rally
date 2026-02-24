import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  fetchIssues,
  fetchPrs,
  formatIssueChoice,
  formatPrChoice,
  listOnboardedRepos,
} from '../lib/picker.js';

// =====================================================
// listOnboardedRepos
// =====================================================

describe('listOnboardedRepos', () => {
  test('returns repos from projects.yaml', () => {
    const repos = listOnboardedRepos({
      _readProjects: () => ({
        projects: [
          { name: 'rally', repo: 'jsturtevant/rally', path: '/tmp/rally' },
          { name: 'squad', repo: 'jsturtevant/squad', path: '/tmp/squad' },
        ],
      }),
    });
    assert.deepStrictEqual(repos, [
      { name: 'rally', repo: 'jsturtevant/rally', path: '/tmp/rally' },
      { name: 'squad', repo: 'jsturtevant/squad', path: '/tmp/squad' },
    ]);
  });

  test('returns empty array when no projects', () => {
    const repos = listOnboardedRepos({
      _readProjects: () => ({ projects: [] }),
    });
    assert.deepStrictEqual(repos, []);
  });

  test('handles missing projects key', () => {
    const repos = listOnboardedRepos({
      _readProjects: () => ({}),
    });
    assert.deepStrictEqual(repos, []);
  });

  test('handles null from readProjects', () => {
    const repos = listOnboardedRepos({
      _readProjects: () => null,
    });
    assert.deepStrictEqual(repos, []);
  });
});

// =====================================================
// fetchIssues
// =====================================================

describe('fetchIssues', () => {
  test('parses gh issue list JSON output', () => {
    const mockExec = (cmd, args) => {
      assert.strictEqual(cmd, 'gh');
      assert.ok(args.includes('issue'));
      assert.ok(args.includes('list'));
      assert.ok(args.includes('owner/repo'));
      return JSON.stringify([
        { number: 42, title: 'Fix login bug', labels: [{ name: 'bug' }], state: 'OPEN' },
        { number: 10, title: 'Add docs', labels: [], state: 'OPEN' },
      ]);
    };
    const issues = fetchIssues('owner/repo', mockExec);
    assert.strictEqual(issues.length, 2);
    assert.strictEqual(issues[0].number, 42);
    assert.strictEqual(issues[0].title, 'Fix login bug');
  });

  test('returns empty array when gh returns empty list', () => {
    const mockExec = () => '[]';
    const issues = fetchIssues('owner/repo', mockExec);
    assert.deepStrictEqual(issues, []);
  });

  test('throws on gh CLI failure', () => {
    const mockExec = () => { throw new Error('gh: command not found'); };
    assert.throws(
      () => fetchIssues('owner/repo', mockExec),
      (err) => err.message.includes('Failed to fetch issues'),
    );
  });
});

// =====================================================
// fetchPrs
// =====================================================

describe('fetchPrs', () => {
  test('parses gh pr list JSON output', () => {
    const mockExec = (cmd, args) => {
      assert.strictEqual(cmd, 'gh');
      assert.ok(args.includes('pr'));
      assert.ok(args.includes('list'));
      assert.ok(args.includes('owner/repo'));
      return JSON.stringify([
        { number: 15, title: 'Refactor auth', state: 'OPEN' },
        { number: 8, title: 'Update deps', state: 'OPEN' },
      ]);
    };
    const prs = fetchPrs('owner/repo', mockExec);
    assert.strictEqual(prs.length, 2);
    assert.strictEqual(prs[0].number, 15);
    assert.strictEqual(prs[0].title, 'Refactor auth');
  });

  test('returns empty array when gh returns empty list', () => {
    const mockExec = () => '[]';
    const prs = fetchPrs('owner/repo', mockExec);
    assert.deepStrictEqual(prs, []);
  });

  test('throws on gh CLI failure', () => {
    const mockExec = () => { throw new Error('network error'); };
    assert.throws(
      () => fetchPrs('owner/repo', mockExec),
      (err) => err.message.includes('Failed to fetch PRs'),
    );
  });
});

// =====================================================
// formatIssueChoice
// =====================================================

describe('formatIssueChoice', () => {
  test('formats issue with labels', () => {
    const choice = formatIssueChoice({
      number: 42, title: 'Fix login', labels: [{ name: 'bug' }, { name: 'urgent' }],
    });
    assert.strictEqual(choice.name, '#42 - Fix login [bug, urgent]');
    assert.strictEqual(choice.value, 42);
  });

  test('formats issue without labels', () => {
    const choice = formatIssueChoice({
      number: 10, title: 'Add docs', labels: [],
    });
    assert.strictEqual(choice.name, '#10 - Add docs');
    assert.strictEqual(choice.value, 10);
  });

  test('handles missing labels array', () => {
    const choice = formatIssueChoice({ number: 1, title: 'Test' });
    assert.strictEqual(choice.name, '#1 - Test');
    assert.strictEqual(choice.value, 1);
  });
});

// =====================================================
// formatPrChoice
// =====================================================

describe('formatPrChoice', () => {
  test('formats PR choice', () => {
    const choice = formatPrChoice({ number: 15, title: 'Refactor auth' });
    assert.strictEqual(choice.name, '#15 - Refactor auth');
    assert.strictEqual(choice.value, 15);
  });
});
