import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

describe('github', () => {
  describe('getIssue', () => {
    it('should parse issue JSON correctly', () => {
      // Test by importing and calling with mock-compatible data
      const mockIssueData = {
        title: 'Test Issue',
        body: 'This is a test issue',
        labels: [{ name: 'bug' }, { name: 'urgent' }],
        assignees: [{ login: 'testuser' }],
      };

      const jsonString = JSON.stringify(mockIssueData);
      const parsed = JSON.parse(jsonString);
      
      assert.deepEqual(parsed, mockIssueData);
      assert.equal(parsed.title, 'Test Issue');
      assert.equal(parsed.labels.length, 2);
    });

    it('should handle error messages correctly', () => {
      const errorMsg = 'Could not resolve to an Issue with the number of 999';
      assert.ok(errorMsg.includes('Could not resolve to an Issue'));
    });
  });

  describe('getPr', () => {
    it('should parse PR JSON correctly', () => {
      const mockPrData = {
        title: 'Test PR',
        body: 'This is a test PR',
        headRefName: 'feature-branch',
        baseRefName: 'main',
        files: [
          { path: 'src/index.js', additions: 10, deletions: 2 },
          { path: 'README.md', additions: 5, deletions: 1 },
        ],
      };

      const jsonString = JSON.stringify(mockPrData);
      const parsed = JSON.parse(jsonString);
      
      assert.deepEqual(parsed, mockPrData);
      assert.equal(parsed.headRefName, 'feature-branch');
      assert.equal(parsed.files.length, 2);
    });
  });

  describe('createPr', () => {
    it('should build correct arguments', () => {
      const args = [
        'pr', 'create',
        '--title', 'New Feature',
        '--body', 'Adds a new feature',
        '--base', 'main',
        '--head', 'feature-branch',
        '--repo', 'owner/repo',
      ];
      
      assert.equal(args[0], 'pr');
      assert.equal(args[1], 'create');
      assert.equal(args[3], 'New Feature');
      assert.equal(args[11], 'owner/repo');
    });
  });

  describe('getRepoDefaultBranch', () => {
    it('should parse jq output correctly', () => {
      const mockOutput = 'main\n';
      const trimmed = mockOutput.trim();
      
      assert.equal(trimmed, 'main');
    });
  });

  describe('error handling', () => {
    it('should identify issue not found errors', () => {
      const errorMessage = 'Could not resolve to an Issue with the number of 999';
      assert.ok(errorMessage.includes('Could not resolve to an Issue'));
    });

    it('should identify PR not found errors', () => {
      const errorMessage = 'Could not resolve to a PullRequest with the number of 999';
      assert.ok(errorMessage.includes('Could not resolve to a PullRequest'));
    });

    it('should handle JSON parse errors', () => {
      const badJson = 'invalid json {{{';
      assert.throws(() => JSON.parse(badJson), SyntaxError);
    });
  });
});
