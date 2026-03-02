import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { addDispatch, getActiveDispatches } from '../lib/active.js';
import { dispatchRemove } from '../lib/dispatch-remove.js';
import { withTempRallyHome } from './helpers/temp-env.js';

function makeRecord(overrides = {}) {
  return {
    id: 'rally-issue-42',
    repo: 'jsturtevant/rally',
    number: 42,
    type: 'issue',
    branch: 'rally/42-fix-bug',
    worktreePath: '/tmp/fake-worktree',
    status: 'implementing',
    session_id: 'sess-abc',
    ...overrides,
  };
}

// Stubs that silence output
function silentOra() {
  return { start() { return { succeed() {}, fail() {} }; } };
}
const silentChalk = {
  green: (s) => s,
  red: (s) => s,
  yellow: (s) => s,
  dim: (s) => s,
};

let tempDir;

beforeEach((t) => {
  tempDir = withTempRallyHome(t);
});

test('dispatchRemove removes dispatch by number', async () => {
  addDispatch(makeRecord());

  let removedId = null;
  let branchDeleted = null;
  const result = await dispatchRemove(42, {
    _removeDispatch: (id) => { removedId = id; },
    _removeWorktree: () => {},
    _readProjects: () => ({ projects: [{ name: 'rally', path: '/tmp/repo' }] }),
    _exec: (_cmd, args) => { if (args[0] === 'branch') branchDeleted = args[2]; },
    _chalk: silentChalk,
  });

  assert.strictEqual(result.dispatch.number, 42);
  assert.strictEqual(removedId, 'rally-issue-42');
  assert.strictEqual(branchDeleted, 'rally/42-fix-bug');
});

test('dispatchRemove throws on unknown number', async () => {
  addDispatch(makeRecord());

  await assert.rejects(
    () => dispatchRemove(999, {
      _chalk: silentChalk,
    }),
    { message: 'No active dispatch found for #999' }
  );
});

test('dispatchRemove disambiguates with --repo when multiple matches', async () => {
  addDispatch(makeRecord({ id: 'rally-issue-42-a', repo: 'owner/repo-a' }));
  addDispatch(makeRecord({ id: 'rally-issue-42-b', repo: 'owner/repo-b' }));

  let removedId = null;
  const result = await dispatchRemove(42, {
    repo: 'owner/repo-b',
    _removeDispatch: (id) => { removedId = id; },
    _removeWorktree: () => {},
    _readProjects: () => ({ projects: [{ name: 'repo-b', path: '/tmp/repo-b' }] }),
    _chalk: silentChalk,
  });

  assert.strictEqual(result.dispatch.id, 'rally-issue-42-b');
  assert.strictEqual(removedId, 'rally-issue-42-b');
});

test('dispatchRemove throws on ambiguous number without --repo', async () => {
  addDispatch(makeRecord({ id: 'rally-issue-42-a', repo: 'owner/repo-a' }));
  addDispatch(makeRecord({ id: 'rally-issue-42-b', repo: 'owner/repo-b' }));

  await assert.rejects(
    () => dispatchRemove(42, {
      _chalk: silentChalk,
    }),
    { message: /Multiple dispatches found for #42.*Use --repo to disambiguate/ }
  );
});

test('dispatchRemove handles missing worktree gracefully', async () => {
  addDispatch(makeRecord());

  let removedId = null;
  let branchDeleted = null;
  const result = await dispatchRemove(42, {
    _removeDispatch: (id) => { removedId = id; },
    _removeWorktree: () => { throw new Error('worktree gone'); },
    _readProjects: () => ({ projects: [{ name: 'rally', path: '/tmp/repo' }] }),
    _exec: (_cmd, args) => { if (args[0] === 'branch') branchDeleted = args[2]; },
    _chalk: silentChalk,
  });

  assert.strictEqual(result.dispatch.number, 42);
  assert.strictEqual(removedId, 'rally-issue-42');
  assert.strictEqual(branchDeleted, 'rally/42-fix-bug');
});

test('dispatchRemove handles missing project path gracefully', async () => {
  addDispatch(makeRecord());

  let worktreeRemoveCalled = false;
  let removedId = null;
  let execCalled = false;
  const result = await dispatchRemove(42, {
    _removeDispatch: (id) => { removedId = id; },
    _removeWorktree: () => { worktreeRemoveCalled = true; },
    _readProjects: () => ({ projects: [] }),
    _exec: () => { execCalled = true; },
    _chalk: silentChalk,
  });

  assert.strictEqual(result.dispatch.number, 42);
  assert.strictEqual(removedId, 'rally-issue-42');
  assert.strictEqual(worktreeRemoveCalled, false);
  assert.strictEqual(execCalled, false, 'should not try to delete branch without project path');
});

test('dispatchRemove handles branch deletion failure gracefully', async () => {
  addDispatch(makeRecord());

  let removedId = null;
  const result = await dispatchRemove(42, {
    _removeDispatch: (id) => { removedId = id; },
    _removeWorktree: () => {},
    _readProjects: () => ({ projects: [{ name: 'rally', path: '/tmp/repo' }] }),
    _exec: () => { throw new Error('branch not found'); },
    _chalk: silentChalk,
  });

  assert.strictEqual(result.dispatch.number, 42);
  assert.strictEqual(removedId, 'rally-issue-42');
});

test('dispatchRemove terminates tracked PID before cleanup', async () => {
  addDispatch(makeRecord({ pid: 67890 }));
  
  let terminatedPids = [];
  const result = await dispatchRemove(42, {
    _terminatePid: (pid) => { terminatedPids.push(pid); },
    _removeWorktree: () => {},
    _readProjects: () => ({ projects: [{ name: 'rally', path: '/tmp/repo' }] }),
    _exec: () => {},
    _chalk: silentChalk,
  });
  
  assert.strictEqual(result.dispatch.number, 42);
  assert.deepStrictEqual(terminatedPids, [67890]);
});

test('dispatchRemove skips PID termination when PID is null', async () => {
  addDispatch(makeRecord({ pid: null }));
  
  let terminateCalled = false;
  const result = await dispatchRemove(42, {
    _terminatePid: () => { terminateCalled = true; },
    _removeWorktree: () => {},
    _readProjects: () => ({ projects: [{ name: 'rally', path: '/tmp/repo' }] }),
    _exec: () => {},
    _chalk: silentChalk,
  });
  
  assert.strictEqual(result.dispatch.number, 42);
  assert.strictEqual(terminateCalled, false);
});
