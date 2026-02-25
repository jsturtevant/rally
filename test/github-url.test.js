import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseGitHubRemoteUrl } from '../lib/github-url.js';

describe('parseGitHubRemoteUrl', () => {
  describe('HTTPS URLs', () => {
    it('parses https://github.com/owner/repo', () => {
      const r = parseGitHubRemoteUrl('https://github.com/owner/repo');
      assert.deepStrictEqual(r, { owner: 'owner', repo: 'repo' });
    });

    it('parses https://github.com/owner/repo.git', () => {
      const r = parseGitHubRemoteUrl('https://github.com/owner/repo.git');
      assert.deepStrictEqual(r, { owner: 'owner', repo: 'repo' });
    });

    it('parses http:// variant', () => {
      const r = parseGitHubRemoteUrl('http://github.com/owner/repo');
      assert.deepStrictEqual(r, { owner: 'owner', repo: 'repo' });
    });

    it('strips trailing slashes', () => {
      const r = parseGitHubRemoteUrl('https://github.com/owner/repo/');
      assert.deepStrictEqual(r, { owner: 'owner', repo: 'repo' });
    });
  });

  describe('SCP-style SSH URLs', () => {
    it('parses git@github.com:owner/repo', () => {
      const r = parseGitHubRemoteUrl('git@github.com:owner/repo');
      assert.deepStrictEqual(r, { owner: 'owner', repo: 'repo' });
    });

    it('parses git@github.com:owner/repo.git', () => {
      const r = parseGitHubRemoteUrl('git@github.com:owner/repo.git');
      assert.deepStrictEqual(r, { owner: 'owner', repo: 'repo' });
    });
  });

  describe('SSH protocol URLs', () => {
    it('parses ssh://git@github.com/owner/repo', () => {
      const r = parseGitHubRemoteUrl('ssh://git@github.com/owner/repo');
      assert.deepStrictEqual(r, { owner: 'owner', repo: 'repo' });
    });

    it('parses ssh://git@github.com/owner/repo.git', () => {
      const r = parseGitHubRemoteUrl('ssh://git@github.com/owner/repo.git');
      assert.deepStrictEqual(r, { owner: 'owner', repo: 'repo' });
    });
  });

  describe('git:// protocol URLs', () => {
    it('parses git://github.com/owner/repo', () => {
      const r = parseGitHubRemoteUrl('git://github.com/owner/repo');
      assert.deepStrictEqual(r, { owner: 'owner', repo: 'repo' });
    });

    it('parses git://github.com/owner/repo.git', () => {
      const r = parseGitHubRemoteUrl('git://github.com/owner/repo.git');
      assert.deepStrictEqual(r, { owner: 'owner', repo: 'repo' });
    });

    it('parses git://git@github.com/owner/repo', () => {
      const r = parseGitHubRemoteUrl('git://git@github.com/owner/repo');
      assert.deepStrictEqual(r, { owner: 'owner', repo: 'repo' });
    });
  });

  describe('owner/repo shorthand', () => {
    it('parses owner/repo', () => {
      const r = parseGitHubRemoteUrl('owner/repo');
      assert.deepStrictEqual(r, { owner: 'owner', repo: 'repo' });
    });

    it('handles dots and hyphens in names', () => {
      const r = parseGitHubRemoteUrl('my-org/my.repo');
      assert.deepStrictEqual(r, { owner: 'my-org', repo: 'my.repo' });
    });

    it('handles underscores', () => {
      const r = parseGitHubRemoteUrl('my_org/my_repo');
      assert.deepStrictEqual(r, { owner: 'my_org', repo: 'my_repo' });
    });
  });

  describe('edge cases', () => {
    it('trims whitespace', () => {
      const r = parseGitHubRemoteUrl('  owner/repo  ');
      assert.deepStrictEqual(r, { owner: 'owner', repo: 'repo' });
    });

    it('returns null for null input', () => {
      assert.strictEqual(parseGitHubRemoteUrl(null), null);
    });

    it('returns null for undefined input', () => {
      assert.strictEqual(parseGitHubRemoteUrl(undefined), null);
    });

    it('returns null for empty string', () => {
      assert.strictEqual(parseGitHubRemoteUrl(''), null);
    });

    it('returns null for whitespace-only string', () => {
      assert.strictEqual(parseGitHubRemoteUrl('   '), null);
    });

    it('returns null for non-string input', () => {
      assert.strictEqual(parseGitHubRemoteUrl(42), null);
    });

    it('returns null for non-GitHub host', () => {
      assert.strictEqual(parseGitHubRemoteUrl('https://gitlab.com/owner/repo'), null);
    });

    it('returns null for local paths', () => {
      assert.strictEqual(parseGitHubRemoteUrl('/home/user/repo'), null);
    });

    it('returns null for relative paths with multiple segments', () => {
      assert.strictEqual(parseGitHubRemoteUrl('a/b/c'), null);
    });
  });

  describe('path traversal rejection', () => {
    it('rejects .. in owner', () => {
      assert.strictEqual(parseGitHubRemoteUrl('../repo'), null);
    });

    it('rejects .. in repo', () => {
      assert.strictEqual(parseGitHubRemoteUrl('owner/..'), null);
    });

    it('rejects . as owner', () => {
      assert.strictEqual(parseGitHubRemoteUrl('./repo'), null);
    });

    it('rejects . as repo', () => {
      assert.strictEqual(parseGitHubRemoteUrl('owner/.'), null);
    });

    it('rejects .. in HTTPS URL owner', () => {
      assert.strictEqual(parseGitHubRemoteUrl('https://github.com/../repo'), null);
    });

    it('rejects .. in HTTPS URL repo', () => {
      assert.strictEqual(parseGitHubRemoteUrl('https://github.com/owner/..'), null);
    });
  });

  describe('real-world URLs', () => {
    it('parses jsturtevant/rally HTTPS', () => {
      const r = parseGitHubRemoteUrl('https://github.com/jsturtevant/rally.git');
      assert.deepStrictEqual(r, { owner: 'jsturtevant', repo: 'rally' });
    });

    it('parses jsturtevant/rally SSH', () => {
      const r = parseGitHubRemoteUrl('git@github.com:jsturtevant/rally.git');
      assert.deepStrictEqual(r, { owner: 'jsturtevant', repo: 'rally' });
    });

    it('parses jsturtevant/rally shorthand', () => {
      const r = parseGitHubRemoteUrl('jsturtevant/rally');
      assert.deepStrictEqual(r, { owner: 'jsturtevant', repo: 'rally' });
    });

    it('parses hyperlight-dev/hyperlight-wasm', () => {
      const r = parseGitHubRemoteUrl('https://github.com/hyperlight-dev/hyperlight-wasm');
      assert.deepStrictEqual(r, { owner: 'hyperlight-dev', repo: 'hyperlight-wasm' });
    });
  });
});
