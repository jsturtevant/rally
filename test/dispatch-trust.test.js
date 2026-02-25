import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  getCurrentUser,
  getItemAuthor,
  checkOrgMembership,
  checkDispatchTrust,
} from '../lib/dispatch-trust.js';

// =====================================================
// getCurrentUser
// =====================================================

describe('getCurrentUser', () => {
  test('returns username from gh api user', () => {
    const exec = () => '  alice\n';
    assert.strictEqual(getCurrentUser(exec), 'alice');
  });

  test('returns null when gh fails', () => {
    const exec = () => { throw new Error('not authenticated'); };
    assert.strictEqual(getCurrentUser(exec), null);
  });

  test('returns null when output is empty', () => {
    const exec = () => '  \n';
    assert.strictEqual(getCurrentUser(exec), null);
  });
});

// =====================================================
// getItemAuthor
// =====================================================

describe('getItemAuthor', () => {
  test('returns author login for an issue', () => {
    const exec = (cmd, args) => {
      assert.strictEqual(args[0], 'issue');
      return 'bob\n';
    };
    assert.strictEqual(getItemAuthor('issue', 42, 'owner/repo', exec), 'bob');
  });

  test('returns author login for a PR', () => {
    const exec = (cmd, args) => {
      assert.strictEqual(args[0], 'pr');
      return 'carol\n';
    };
    assert.strictEqual(getItemAuthor('pr', 10, 'owner/repo', exec), 'carol');
  });

  test('returns null when fetch fails', () => {
    const exec = () => { throw new Error('not found'); };
    assert.strictEqual(getItemAuthor('issue', 999, 'owner/repo', exec), null);
  });
});

// =====================================================
// checkOrgMembership
// =====================================================

describe('checkOrgMembership', () => {
  test('returns true when user is a member of an org', () => {
    const exec = (cmd, args) => {
      if (args[1].startsWith('users/')) return 'Organization';
      return '{}'; // member check succeeds
    };
    assert.strictEqual(checkOrgMembership('myorg/repo', 'alice', exec), true);
  });

  test('returns false when API returns 404 for org member check', () => {
    const exec = (cmd, args) => {
      if (args[1].startsWith('users/')) return 'Organization';
      const err = new Error('HTTP 404');
      err.stderr = 'HTTP 404: Not Found';
      throw err;
    };
    assert.strictEqual(checkOrgMembership('myorg/repo', 'alice', exec), false);
  });

  test('returns null when API returns other error', () => {
    const exec = (cmd, args) => {
      if (args[1].startsWith('users/')) return 'Organization';
      const err = new Error('HTTP 500');
      err.stderr = 'HTTP 500: Internal Server Error';
      throw err;
    };
    assert.strictEqual(checkOrgMembership('myorg/repo', 'alice', exec), null);
  });

  test('returns null when username is empty', () => {
    assert.strictEqual(checkOrgMembership('owner/repo', '', () => {}), null);
  });

  test('returns null for user-owned repo (not an org)', () => {
    const exec = (cmd, args) => {
      if (args[1].startsWith('users/')) return 'User';
      throw new Error('should not reach member check');
    };
    assert.strictEqual(checkOrgMembership('someuser/repo', 'alice', exec), null);
  });
});

// =====================================================
// checkDispatchTrust — trust flag
// =====================================================

describe('checkDispatchTrust', () => {
  test('returns true immediately when trust=true', async () => {
    const result = await checkDispatchTrust({
      type: 'issue', number: 1, repo: 'o/r', trust: true,
    });
    assert.strictEqual(result, true);
  });

  test('returns true when current user matches author', async () => {
    const exec = (cmd, args) => {
      if (args[0] === 'api' && args[1] === 'user') return 'alice\n';
      if (args[0] === 'issue' && args[1] === 'view') return 'alice\n';
      if (args[0] === 'api' && args[1].startsWith('orgs/')) return '{}';
      return '';
    };
    const result = await checkDispatchTrust({
      type: 'issue', number: 1, repo: 'o/r',
      _exec: exec, _confirm: () => { throw new Error('should not prompt'); },
    });
    assert.strictEqual(result, true);
  });

  test('returns true when current user cannot be determined', async () => {
    const exec = () => { throw new Error('no auth'); };
    const result = await checkDispatchTrust({
      type: 'issue', number: 1, repo: 'o/r', _exec: exec,
    });
    assert.strictEqual(result, true);
  });

  test('returns true when author cannot be determined', async () => {
    let callCount = 0;
    const exec = (cmd, args) => {
      callCount++;
      if (args[0] === 'api' && args[1] === 'user') return 'alice\n';
      throw new Error('not found');
    };
    const result = await checkDispatchTrust({
      type: 'issue', number: 999, repo: 'o/r', _exec: exec,
    });
    assert.strictEqual(result, true);
  });

  test('prompts when author differs from current user', async () => {
    const exec = (cmd, args) => {
      if (args[0] === 'api' && args[1] === 'user') return 'alice\n';
      if (args[0] === 'issue' && args[1] === 'view') return 'bob\n';
      if (args[0] === 'api' && args[1].startsWith('orgs/')) return '{}';
      return '';
    };
    let prompted = false;
    const confirmFn = async () => { prompted = true; return true; };
    const result = await checkDispatchTrust({
      type: 'issue', number: 1, repo: 'o/r',
      _exec: exec, _confirm: confirmFn, _isTTY: true,
    });
    assert.strictEqual(prompted, true);
    assert.strictEqual(result, true);
  });

  test('returns false when user declines prompt', async () => {
    const exec = (cmd, args) => {
      if (args[0] === 'api' && args[1] === 'user') return 'alice\n';
      if (args[0] === 'issue' && args[1] === 'view') return 'bob\n';
      if (args[0] === 'api' && args[1].startsWith('orgs/')) return '{}';
      return '';
    };
    const result = await checkDispatchTrust({
      type: 'issue', number: 1, repo: 'o/r',
      _exec: exec, _confirm: async () => false, _isTTY: true,
    });
    assert.strictEqual(result, false);
  });

  test('prompts when user is not an org member', async () => {
    const exec = (cmd, args) => {
      if (args[0] === 'api' && args[1] === 'user') return 'alice\n';
      if (args[0] === 'issue' && args[1] === 'view') return 'alice\n';
      if (args[0] === 'api' && args[1].startsWith('users/')) return 'Organization';
      if (args[0] === 'api' && args[1].startsWith('orgs/')) {
        const err = new Error('HTTP 404');
        err.stderr = 'HTTP 404: Not Found';
        throw err;
      }
      return '';
    };
    let prompted = false;
    const confirmFn = async () => { prompted = true; return true; };
    const result = await checkDispatchTrust({
      type: 'issue', number: 1, repo: 'o/r',
      _exec: exec, _confirm: confirmFn, _isTTY: true,
    });
    assert.strictEqual(prompted, true);
    assert.strictEqual(result, true);
  });

  test('shows both warnings when author differs AND user not in org', async () => {
    const exec = (cmd, args) => {
      if (args[0] === 'api' && args[1] === 'user') return 'alice\n';
      if (args[0] === 'issue' && args[1] === 'view') return 'mallory\n';
      if (args[0] === 'api' && args[1].startsWith('users/')) return 'Organization';
      if (args[0] === 'api' && args[1].startsWith('orgs/')) {
        const err = new Error('HTTP 404');
        err.stderr = 'HTTP 404: Not Found';
        throw err;
      }
      return '';
    };
    let promptMsg = null;
    const confirmFn = async (opts) => { promptMsg = opts.message; return false; };
    const result = await checkDispatchTrust({
      type: 'issue', number: 1, repo: 'myorg/repo',
      _exec: exec, _confirm: confirmFn, _isTTY: true,
    });
    assert.strictEqual(result, false);
    assert.ok(promptMsg, 'should have been prompted');
  });

  test('works for PR type', async () => {
    const exec = (cmd, args) => {
      if (args[0] === 'api' && args[1] === 'user') return 'alice\n';
      if (args[0] === 'pr' && args[1] === 'view') return 'bob\n';
      if (args[0] === 'api' && args[1].startsWith('orgs/')) return '{}';
      return '';
    };
    let prompted = false;
    const confirmFn = async () => { prompted = true; return true; };
    const result = await checkDispatchTrust({
      type: 'pr', number: 5, repo: 'o/r',
      _exec: exec, _confirm: confirmFn, _isTTY: true,
    });
    assert.strictEqual(prompted, true);
    assert.strictEqual(result, true);
  });

  test('case-insensitive username comparison', async () => {
    const exec = (cmd, args) => {
      if (args[0] === 'api' && args[1] === 'user') return 'Alice\n';
      if (args[0] === 'issue' && args[1] === 'view') return 'alice\n';
      if (args[0] === 'api' && args[1].startsWith('orgs/')) return '{}';
      return '';
    };
    const result = await checkDispatchTrust({
      type: 'issue', number: 1, repo: 'o/r',
      _exec: exec, _confirm: () => { throw new Error('should not prompt'); },
    });
    assert.strictEqual(result, true);
  });

  // =====================================================
  // Non-TTY behavior (issue #236)
  // =====================================================

  test('non-TTY + author mismatch + no --trust → returns false with stderr', async () => {
    const exec = (cmd, args) => {
      if (args[0] === 'api' && args[1] === 'user') return 'alice\n';
      if (args[0] === 'issue' && args[1] === 'view') return 'mallory\n';
      return '';
    };
    const original = console.error;
    const messages = [];
    console.error = (...args) => messages.push(args.join(' '));
    try {
      const result = await checkDispatchTrust({
        type: 'issue', number: 1, repo: 'o/r',
        _exec: exec, _isTTY: false,
        _confirm: () => { throw new Error('should not prompt in non-TTY'); },
      });
      assert.strictEqual(result, false);
      assert.ok(
        messages.some(m => m.includes('issue authored by mallory')),
        `Expected stderr about issue author mismatch, got: ${JSON.stringify(messages)}`
      );
    } finally {
      console.error = original;
    }
  });

  test('non-TTY + author mismatch (type=pr) → returns false with correct message', async () => {
    const exec = (cmd, args) => {
      if (args[0] === 'api' && args[1] === 'user') return 'alice\n';
      if (args[0] === 'pr' && args[1] === 'view') return 'mallory\n';
      return '';
    };
    const original = console.error;
    const messages = [];
    console.error = (...args) => messages.push(args.join(' '));
    try {
      const result = await checkDispatchTrust({
        type: 'pr', number: 5, repo: 'o/r',
        _exec: exec, _isTTY: false,
        _confirm: () => { throw new Error('should not prompt in non-TTY'); },
      });
      assert.strictEqual(result, false);
      assert.ok(
        messages.some(m => m.includes('pr authored by mallory')),
        `Expected stderr about pr author mismatch, got: ${JSON.stringify(messages)}`
      );
    } finally {
      console.error = original;
    }
  });

  test('non-TTY + author matches → returns true', async () => {
    const exec = (cmd, args) => {
      if (args[0] === 'api' && args[1] === 'user') return 'alice\n';
      if (args[0] === 'issue' && args[1] === 'view') return 'alice\n';
      return '';
    };
    const result = await checkDispatchTrust({
      type: 'issue', number: 1, repo: 'o/r',
      _exec: exec, _isTTY: false,
      _confirm: () => { throw new Error('should not prompt in non-TTY'); },
    });
    assert.strictEqual(result, true);
  });

  test('non-TTY + --trust → returns true', async () => {
    const result = await checkDispatchTrust({
      type: 'issue', number: 1, repo: 'o/r',
      trust: true, _isTTY: false,
    });
    assert.strictEqual(result, true);
  });

  test('--trust logs a warning to stderr', async () => {
    const original = console.error;
    const messages = [];
    console.error = (...args) => messages.push(args.join(' '));
    try {
      await checkDispatchTrust({
        type: 'issue', number: 1, repo: 'o/r', trust: true,
      });
      assert.ok(
        messages.some(m => m.includes('--trust flag used')),
        `Expected stderr warning about --trust, got: ${JSON.stringify(messages)}`
      );
    } finally {
      console.error = original;
    }
  });
});
