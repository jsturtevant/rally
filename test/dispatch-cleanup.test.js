import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cleanupDispatch, STALE_PID_MS } from '../lib/dispatch-cleanup.js';

function makeDispatch(overrides = {}) {
  return {
    id: 'dispatch-1',
    repo: 'owner/repo',
    number: 42,
    type: 'issue',
    branch: 'rally/42-fix-bug',
    worktreePath: '/tmp/worktrees/repo-42',
    status: 'done',
    pid: 12345,
    created: new Date().toISOString(),
    ...overrides,
  };
}

function noop() {}

function makeOpts(overrides = {}) {
  return {
    _terminatePid: overrides._terminatePid || noop,
    _removeWorktree: overrides._removeWorktree || noop,
    _exec: overrides._exec || noop,
    ...overrides,
  };
}

describe('STALE_PID_MS', () => {
  test('STALE_PID_MS equals 7 days in milliseconds', () => {
    assert.strictEqual(STALE_PID_MS, 7 * 24 * 60 * 60 * 1000);
  });
});

describe('cleanupDispatch happy path', () => {
  test('terminates PID, removes worktree, and deletes branch', () => {
    const calls = [];
    const dispatch = makeDispatch();

    cleanupDispatch(dispatch, '/repo', makeOpts({
      _terminatePid: (pid) => calls.push({ op: 'terminate', pid }),
      _removeWorktree: (repo, wt) => calls.push({ op: 'removeWt', repo, wt }),
      _exec: (cmd, args, opts) => calls.push({ op: 'exec', cmd, args, cwd: opts.cwd }),
    }));

    assert.strictEqual(calls.length, 3);
    assert.deepEqual(calls[0], { op: 'terminate', pid: 12345 });
    assert.deepEqual(calls[1], { op: 'removeWt', repo: '/repo', wt: '/tmp/worktrees/repo-42' });
    assert.deepEqual(calls[2], {
      op: 'exec',
      cmd: 'git',
      args: ['branch', '-D', 'rally/42-fix-bug'],
      cwd: '/repo',
    });
  });
});

describe('PID termination', () => {
  test('skips termination when dispatch has no PID', () => {
    let terminated = false;
    cleanupDispatch(makeDispatch({ pid: null }), '/repo', makeOpts({
      _terminatePid: () => { terminated = true; },
    }));
    assert.strictEqual(terminated, false);
  });

  test('skips termination when PID is undefined', () => {
    let terminated = false;
    const dispatch = makeDispatch();
    delete dispatch.pid;
    cleanupDispatch(dispatch, '/repo', makeOpts({
      _terminatePid: () => { terminated = true; },
    }));
    assert.strictEqual(terminated, false);
  });

  test('skips termination when PID is zero (falsy)', () => {
    let terminated = false;
    cleanupDispatch(makeDispatch({ pid: 0 }), '/repo', makeOpts({
      _terminatePid: () => { terminated = true; },
    }));
    assert.strictEqual(terminated, false);
  });

  test('skips termination for stale dispatch (older than 7 days)', () => {
    let terminated = false;
    const staleDate = new Date(Date.now() - STALE_PID_MS - 1000).toISOString();
    cleanupDispatch(makeDispatch({ created: staleDate }), '/repo', makeOpts({
      _terminatePid: () => { terminated = true; },
    }));
    assert.strictEqual(terminated, false);
  });

  test('terminates PID for dispatch exactly at stale boundary', () => {
    let terminated = false;
    // Age equal to STALE_PID_MS should still terminate (age <= STALE_PID_MS)
    const boundaryDate = new Date(Date.now() - (STALE_PID_MS - 1000)).toISOString();
    cleanupDispatch(makeDispatch({ created: boundaryDate }), '/repo', makeOpts({
      _terminatePid: () => { terminated = true; },
    }));
    assert.strictEqual(terminated, true);
  });

  test('skips termination when created is missing (age is Infinity)', () => {
    let terminated = false;
    const dispatch = makeDispatch();
    delete dispatch.created;
    cleanupDispatch(dispatch, '/repo', makeOpts({
      _terminatePid: () => { terminated = true; },
    }));
    assert.strictEqual(terminated, false);
  });

  test('cleanupDispatch continues cleanup when PID termination throws', () => {
    const calls = [];
    cleanupDispatch(makeDispatch(), '/repo', makeOpts({
      _terminatePid: () => { throw new Error('kill failed'); },
      _removeWorktree: () => calls.push('removeWt'),
      _exec: () => calls.push('exec'),
    }));
    assert.deepEqual(calls, ['removeWt', 'exec']);
  });
});

describe('worktree removal', () => {
  test('skips worktree removal when repoPath is null', () => {
    let removed = false;
    cleanupDispatch(makeDispatch(), null, makeOpts({
      _removeWorktree: () => { removed = true; },
    }));
    assert.strictEqual(removed, false);
  });

  test('skips worktree removal when repoPath is empty string', () => {
    let removed = false;
    cleanupDispatch(makeDispatch(), '', makeOpts({
      _removeWorktree: () => { removed = true; },
    }));
    assert.strictEqual(removed, false);
  });

  test('skips worktree removal when worktreePath is missing', () => {
    let removed = false;
    const dispatch = makeDispatch({ worktreePath: null });
    cleanupDispatch(dispatch, '/repo', makeOpts({
      _removeWorktree: () => { removed = true; },
    }));
    assert.strictEqual(removed, false);
  });

  test('skips worktree removal when worktreePath is undefined', () => {
    let removed = false;
    const dispatch = makeDispatch();
    delete dispatch.worktreePath;
    cleanupDispatch(dispatch, '/repo', makeOpts({
      _removeWorktree: () => { removed = true; },
    }));
    assert.strictEqual(removed, false);
  });

  test('cleanupDispatch continues cleanup when worktree removal throws', () => {
    const calls = [];
    cleanupDispatch(makeDispatch(), '/repo', makeOpts({
      _removeWorktree: () => { throw new Error('worktree already removed'); },
      _exec: () => calls.push('exec'),
    }));
    assert.deepEqual(calls, ['exec']);
  });
});

describe('branch deletion', () => {
  test('skips branch deletion when repoPath is null', () => {
    let executed = false;
    cleanupDispatch(makeDispatch(), null, makeOpts({
      _exec: () => { executed = true; },
    }));
    assert.strictEqual(executed, false);
  });

  test('skips branch deletion when branch is missing', () => {
    let executed = false;
    const dispatch = makeDispatch({ branch: null });
    cleanupDispatch(dispatch, '/repo', makeOpts({
      _exec: () => { executed = true; },
    }));
    assert.strictEqual(executed, false);
  });

  test('skips branch deletion when branch is undefined', () => {
    let executed = false;
    const dispatch = makeDispatch();
    delete dispatch.branch;
    cleanupDispatch(dispatch, '/repo', makeOpts({
      _exec: () => { executed = true; },
    }));
    assert.strictEqual(executed, false);
  });

  test('cleanupDispatch continues without throwing when branch deletion fails', () => {
    assert.doesNotThrow(() => {
      cleanupDispatch(makeDispatch(), '/repo', makeOpts({
        _exec: () => { throw new Error('branch not found'); },
      }));
    });
  });

  test('cleanupDispatch passes correct arguments to exec for branch deletion', () => {
    let capturedArgs;
    cleanupDispatch(makeDispatch({ branch: 'rally/99-feature' }), '/my/repo', makeOpts({
      _exec: (cmd, args, opts) => { capturedArgs = { cmd, args, encoding: opts.encoding, cwd: opts.cwd }; },
    }));
    assert.deepEqual(capturedArgs, {
      cmd: 'git',
      args: ['branch', '-D', 'rally/99-feature'],
      encoding: 'utf8',
      cwd: '/my/repo',
    });
  });
});

describe('all operations fail gracefully', () => {
  test('does not throw when all three operations fail', () => {
    assert.doesNotThrow(() => {
      cleanupDispatch(makeDispatch(), '/repo', makeOpts({
        _terminatePid: () => { throw new Error('kill failed'); },
        _removeWorktree: () => { throw new Error('worktree gone'); },
        _exec: () => { throw new Error('branch gone'); },
      }));
    });
  });
});

describe('minimal dispatch (no optional fields)', () => {
  test('handles dispatch with only required fields', () => {
    const minimal = { id: 'min-1', status: 'done' };
    assert.doesNotThrow(() => {
      cleanupDispatch(minimal, '/repo', makeOpts());
    });
  });

  test('handles dispatch with empty object', () => {
    assert.doesNotThrow(() => {
      cleanupDispatch({}, null, makeOpts());
    });
  });
});

describe('default dependencies', () => {
  test('uses default opts when none provided (no crash with empty dispatch)', () => {
    // With no pid, no worktreePath, no branch, no real deps are called
    assert.doesNotThrow(() => {
      cleanupDispatch({ id: 'safe' }, null);
    });
  });
});
