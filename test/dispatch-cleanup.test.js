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
    status: 'upstream',
    pid: 12345,
    created: new Date().toISOString(),
    ...overrides,
  };
}

function noop() {}
async function asyncNoop() {}

function makeOpts(overrides = {}) {
  return {
    _terminatePid: overrides._terminatePid || noop,
    _removeWorktree: overrides._removeWorktree || noop,
    _exec: overrides._exec || noop,
    _extractLearnings: overrides._extractLearnings || asyncNoop,
    ...overrides,
  };
}

describe('STALE_PID_MS', () => {
  test('STALE_PID_MS equals 7 days in milliseconds', () => {
    assert.strictEqual(STALE_PID_MS, 7 * 24 * 60 * 60 * 1000);
  });
});

describe('cleanupDispatch happy path', () => {
  test('terminates PID, removes worktree, and deletes branch', async () => {
    const calls = [];
    const dispatch = makeDispatch();

    await cleanupDispatch(dispatch, '/repo', makeOpts({
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

describe('learning extraction', () => {
  test('calls extractLearnings before cleanup', async () => {
    const calls = [];
    const dispatch = makeDispatch();

    await cleanupDispatch(dispatch, '/repo', makeOpts({
      _extractLearnings: async (opts) => { calls.push({ op: 'extract', projectRoot: opts.projectRoot, clean: opts.clean }); },
      _terminatePid: () => calls.push('terminate'),
    }));

    // Extract should be called first
    assert.strictEqual(calls[0].op, 'extract');
    assert.strictEqual(calls[0].projectRoot, '/tmp/worktrees/repo-42');
    assert.strictEqual(calls[0].clean, true);
  });

  test('continues cleanup when extraction fails', async () => {
    const calls = [];
    const dispatch = makeDispatch();

    await cleanupDispatch(dispatch, '/repo', makeOpts({
      _extractLearnings: async () => { throw new Error('extraction failed'); },
      _terminatePid: () => calls.push('terminate'),
      _removeWorktree: () => calls.push('removeWt'),
      _exec: () => calls.push('exec'),
    }));

    // Should still have all 3 cleanup calls
    assert.deepEqual(calls, ['terminate', 'removeWt', 'exec']);
  });

  test('skips extraction when worktreePath is null', async () => {
    let extracted = false;
    await cleanupDispatch(makeDispatch({ worktreePath: null }), '/repo', makeOpts({
      _extractLearnings: async () => { extracted = true; },
    }));
    assert.strictEqual(extracted, false);
  });
});

describe('PID termination', () => {
  test('skips termination when dispatch has no PID', async () => {
    let terminated = false;
    await cleanupDispatch(makeDispatch({ pid: null }), '/repo', makeOpts({
      _terminatePid: () => { terminated = true; },
    }));
    assert.strictEqual(terminated, false);
  });

  test('skips termination when PID is undefined', async () => {
    let terminated = false;
    const dispatch = makeDispatch();
    delete dispatch.pid;
    await cleanupDispatch(dispatch, '/repo', makeOpts({
      _terminatePid: () => { terminated = true; },
    }));
    assert.strictEqual(terminated, false);
  });

  test('skips termination when PID is zero (falsy)', async () => {
    let terminated = false;
    await cleanupDispatch(makeDispatch({ pid: 0 }), '/repo', makeOpts({
      _terminatePid: () => { terminated = true; },
    }));
    assert.strictEqual(terminated, false);
  });

  test('skips termination for stale dispatch (older than 7 days)', async () => {
    let terminated = false;
    const staleDate = new Date(Date.now() - STALE_PID_MS - 1000).toISOString();
    await cleanupDispatch(makeDispatch({ created: staleDate }), '/repo', makeOpts({
      _terminatePid: () => { terminated = true; },
    }));
    assert.strictEqual(terminated, false);
  });

  test('terminates PID for dispatch exactly at stale boundary', async () => {
    let terminated = false;
    // Age equal to STALE_PID_MS should still terminate (age <= STALE_PID_MS)
    const boundaryDate = new Date(Date.now() - (STALE_PID_MS - 1000)).toISOString();
    await cleanupDispatch(makeDispatch({ created: boundaryDate }), '/repo', makeOpts({
      _terminatePid: () => { terminated = true; },
    }));
    assert.strictEqual(terminated, true);
  });

  test('skips termination when created is missing (age is Infinity)', async () => {
    let terminated = false;
    const dispatch = makeDispatch();
    delete dispatch.created;
    await cleanupDispatch(dispatch, '/repo', makeOpts({
      _terminatePid: () => { terminated = true; },
    }));
    assert.strictEqual(terminated, false);
  });

  test('cleanupDispatch continues cleanup when PID termination throws', async () => {
    const calls = [];
    await cleanupDispatch(makeDispatch(), '/repo', makeOpts({
      _terminatePid: () => { throw new Error('kill failed'); },
      _removeWorktree: () => calls.push('removeWt'),
      _exec: () => calls.push('exec'),
    }));
    assert.deepEqual(calls, ['removeWt', 'exec']);
  });
});

describe('worktree removal', () => {
  test('skips worktree removal when repoPath is null', async () => {
    let removed = false;
    await cleanupDispatch(makeDispatch(), null, makeOpts({
      _removeWorktree: () => { removed = true; },
    }));
    assert.strictEqual(removed, false);
  });

  test('skips worktree removal when repoPath is empty string', async () => {
    let removed = false;
    await cleanupDispatch(makeDispatch(), '', makeOpts({
      _removeWorktree: () => { removed = true; },
    }));
    assert.strictEqual(removed, false);
  });

  test('skips worktree removal when worktreePath is missing', async () => {
    let removed = false;
    const dispatch = makeDispatch({ worktreePath: null });
    await cleanupDispatch(dispatch, '/repo', makeOpts({
      _removeWorktree: () => { removed = true; },
    }));
    assert.strictEqual(removed, false);
  });

  test('skips worktree removal when worktreePath is undefined', async () => {
    let removed = false;
    const dispatch = makeDispatch();
    delete dispatch.worktreePath;
    await cleanupDispatch(dispatch, '/repo', makeOpts({
      _removeWorktree: () => { removed = true; },
    }));
    assert.strictEqual(removed, false);
  });

  test('cleanupDispatch continues cleanup when worktree removal throws', async () => {
    const calls = [];
    await cleanupDispatch(makeDispatch(), '/repo', makeOpts({
      _removeWorktree: () => { throw new Error('worktree already removed'); },
      _exec: () => calls.push('exec'),
    }));
    assert.deepEqual(calls, ['exec']);
  });
});

describe('branch deletion', () => {
  test('skips branch deletion when repoPath is null', async () => {
    let executed = false;
    await cleanupDispatch(makeDispatch(), null, makeOpts({
      _exec: () => { executed = true; },
    }));
    assert.strictEqual(executed, false);
  });

  test('skips branch deletion when branch is missing', async () => {
    let executed = false;
    const dispatch = makeDispatch({ branch: null });
    await cleanupDispatch(dispatch, '/repo', makeOpts({
      _exec: () => { executed = true; },
    }));
    assert.strictEqual(executed, false);
  });

  test('skips branch deletion when branch is undefined', async () => {
    let executed = false;
    const dispatch = makeDispatch();
    delete dispatch.branch;
    await cleanupDispatch(dispatch, '/repo', makeOpts({
      _exec: () => { executed = true; },
    }));
    assert.strictEqual(executed, false);
  });

  test('cleanupDispatch continues without throwing when branch deletion fails', async () => {
    await assert.doesNotReject(async () => {
      await cleanupDispatch(makeDispatch(), '/repo', makeOpts({
        _exec: () => { throw new Error('branch not found'); },
      }));
    });
  });

  test('cleanupDispatch passes correct arguments to exec for branch deletion', async () => {
    let capturedArgs;
    await cleanupDispatch(makeDispatch({ branch: 'rally/99-feature' }), '/my/repo', makeOpts({
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
  test('does not throw when all three operations fail', async () => {
    await assert.doesNotReject(async () => {
      await cleanupDispatch(makeDispatch(), '/repo', makeOpts({
        _terminatePid: () => { throw new Error('kill failed'); },
        _removeWorktree: () => { throw new Error('worktree gone'); },
        _exec: () => { throw new Error('branch gone'); },
      }));
    });
  });
});

describe('minimal dispatch (no optional fields)', () => {
  test('handles dispatch with only required fields', async () => {
    const minimal = { id: 'min-1', status: 'upstream' };
    await assert.doesNotReject(async () => {
      await cleanupDispatch(minimal, '/repo', makeOpts());
    });
  });

  test('handles dispatch with empty object', async () => {
    await assert.doesNotReject(async () => {
      await cleanupDispatch({}, null, makeOpts());
    });
  });
});

describe('default dependencies', () => {
  test('uses default opts when none provided (no crash with empty dispatch)', async () => {
    // With no pid, no worktreePath, no branch, no real deps are called
    await assert.doesNotReject(async () => {
      await cleanupDispatch({ id: 'safe' }, null);
    });
  });
});
