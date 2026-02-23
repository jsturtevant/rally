import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { addDispatch, getActiveDispatches } from '../lib/active.js';
import { dispatchRemove } from '../lib/dispatch-remove.js';

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

let originalEnv;
let tempDir;

beforeEach(() => {
  originalEnv = process.env.RALLY_HOME;
  tempDir = mkdtempSync(join(tmpdir(), 'rally-remove-test-'));
  process.env.RALLY_HOME = tempDir;
});

afterEach(() => {
  if (originalEnv) {
    process.env.RALLY_HOME = originalEnv;
  } else {
    delete process.env.RALLY_HOME;
  }
  rmSync(tempDir, { recursive: true, force: true });
});

test('dispatchRemove removes dispatch by number', async () => {
  addDispatch(makeRecord());

  let removedId = null;
  const result = await dispatchRemove(42, {
    _removeDispatch: (id) => { removedId = id; },
    _removeWorktree: () => {},
    _readProjects: () => ({ projects: [{ name: 'rally', path: '/tmp/repo' }] }),
    _ora: silentOra,
    _chalk: silentChalk,
  });

  assert.strictEqual(result.number, 42);
  assert.strictEqual(removedId, 'rally-issue-42');
});

test('dispatchRemove throws on unknown number', async () => {
  addDispatch(makeRecord());

  await assert.rejects(
    () => dispatchRemove(999, {
      _ora: silentOra,
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
    _ora: silentOra,
    _chalk: silentChalk,
  });

  assert.strictEqual(result.id, 'rally-issue-42-b');
  assert.strictEqual(removedId, 'rally-issue-42-b');
});

test('dispatchRemove throws on ambiguous number without --repo', async () => {
  addDispatch(makeRecord({ id: 'rally-issue-42-a', repo: 'owner/repo-a' }));
  addDispatch(makeRecord({ id: 'rally-issue-42-b', repo: 'owner/repo-b' }));

  await assert.rejects(
    () => dispatchRemove(42, {
      _ora: silentOra,
      _chalk: silentChalk,
    }),
    { message: /Multiple dispatches found for #42.*Use --repo to disambiguate/ }
  );
});

test('dispatchRemove handles missing worktree gracefully', async () => {
  addDispatch(makeRecord());

  let removedId = null;
  const result = await dispatchRemove(42, {
    _removeDispatch: (id) => { removedId = id; },
    _removeWorktree: () => { throw new Error('worktree gone'); },
    _readProjects: () => ({ projects: [{ name: 'rally', path: '/tmp/repo' }] }),
    _ora: silentOra,
    _chalk: silentChalk,
  });

  assert.strictEqual(result.number, 42);
  assert.strictEqual(removedId, 'rally-issue-42');
});

test('dispatchRemove handles missing project path gracefully', async () => {
  addDispatch(makeRecord());

  let worktreeRemoveCalled = false;
  let removedId = null;
  const result = await dispatchRemove(42, {
    _removeDispatch: (id) => { removedId = id; },
    _removeWorktree: () => { worktreeRemoveCalled = true; },
    _readProjects: () => ({ projects: [] }),
    _ora: silentOra,
    _chalk: silentChalk,
  });

  assert.strictEqual(result.number, 42);
  assert.strictEqual(removedId, 'rally-issue-42');
  assert.strictEqual(worktreeRemoveCalled, false);
});
