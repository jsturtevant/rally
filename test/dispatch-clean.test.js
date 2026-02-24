import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import yaml from 'js-yaml';
import { addDispatch, getActiveDispatches } from '../lib/active.js';
import { createWorktree } from '../lib/worktree.js';
import { dispatchClean } from '../lib/dispatch-clean.js';

function makeRecord(overrides = {}) {
  return {
    id: 'rally-issue-1',
    repo: 'jsturtevant/rally',
    number: 1,
    type: 'issue',
    branch: 'rally/1-test',
    worktreePath: '/tmp/fake-worktree',
    status: 'done',
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
  tempDir = mkdtempSync(join(tmpdir(), 'rally-clean-test-'));
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

test('dispatchClean with no dispatches returns empty result', async () => {
  const result = await dispatchClean({
    _ora: silentOra,
    _chalk: silentChalk,
  });

  assert.deepEqual(result.cleaned, []);
  assert.deepEqual(result.errors, []);
});

test('dispatchClean cleans done dispatches', async () => {
  addDispatch(makeRecord({ id: 'd1', status: 'done' }));
  addDispatch(makeRecord({ id: 'd2', status: 'implementing' }));

  let removedWorktrees = [];
  const result = await dispatchClean({
    _removeWorktree: (repo, wt) => { removedWorktrees.push(wt); },
    _readProjects: () => ({ projects: [{ name: 'rally', path: '/tmp/repo' }] }),
    _exec: () => {},
    _ora: silentOra,
    _chalk: silentChalk,
  });

  assert.strictEqual(result.cleaned.length, 1);
  assert.strictEqual(result.cleaned[0].id, 'd1');

  // d2 should still exist (not done)
  const remaining = getActiveDispatches();
  assert.strictEqual(remaining.length, 1);
  assert.strictEqual(remaining[0].id, 'd2');
});

test('dispatchClean also cleans dispatches with status "cleaned"', async () => {
  addDispatch(makeRecord({ id: 'd1', status: 'cleaned' }));
  addDispatch(makeRecord({ id: 'd2', status: 'implementing' }));

  const result = await dispatchClean({
    _removeWorktree: () => {},
    _readProjects: () => ({ projects: [{ name: 'rally', path: '/tmp/repo' }] }),
    _exec: () => {},
    _ora: silentOra,
    _chalk: silentChalk,
  });

  assert.strictEqual(result.cleaned.length, 1);
  assert.strictEqual(result.cleaned[0].id, 'd1');
});

test('dispatchClean skips non-done dispatches without --all', async () => {
  addDispatch(makeRecord({ id: 'd1', status: 'planning' }));
  addDispatch(makeRecord({ id: 'd2', status: 'implementing' }));

  const result = await dispatchClean({
    _removeWorktree: () => {},
    _readProjects: () => ({ projects: [] }),
    _exec: () => {},
    _ora: silentOra,
    _chalk: silentChalk,
  });

  assert.strictEqual(result.cleaned.length, 0);
  const remaining = getActiveDispatches();
  assert.strictEqual(remaining.length, 2);
});

test('dispatchClean --all cleans all dispatches with --yes', async () => {
  addDispatch(makeRecord({ id: 'd1', status: 'done' }));
  addDispatch(makeRecord({ id: 'd2', status: 'implementing' }));
  addDispatch(makeRecord({ id: 'd3', status: 'planning' }));

  const result = await dispatchClean({
    all: true,
    yes: true,
    _removeWorktree: () => {},
    _readProjects: () => ({ projects: [{ name: 'rally', path: '/tmp/repo' }] }),
    _exec: () => {},
    _ora: silentOra,
    _chalk: silentChalk,
  });

  assert.strictEqual(result.cleaned.length, 3);
  const remaining = getActiveDispatches();
  assert.strictEqual(remaining.length, 0);
});

test('dispatchClean --all prompts for confirmation', async () => {
  addDispatch(makeRecord({ id: 'd1', status: 'done' }));

  let confirmCalled = false;
  const result = await dispatchClean({
    all: true,
    _confirm: async () => { confirmCalled = true; return false; },
    _removeWorktree: () => {},
    _readProjects: () => ({ projects: [] }),
    _exec: () => {},
    _ora: silentOra,
    _chalk: silentChalk,
  });

  assert.ok(confirmCalled);
  assert.strictEqual(result.cleaned.length, 0);
  // Dispatch should still exist since we declined
  const remaining = getActiveDispatches();
  assert.strictEqual(remaining.length, 1);
});

test('dispatchClean --all with confirmation accepted cleans all', async () => {
  addDispatch(makeRecord({ id: 'd1', status: 'done' }));
  addDispatch(makeRecord({ id: 'd2', status: 'implementing' }));

  const result = await dispatchClean({
    all: true,
    _confirm: async () => true,
    _removeWorktree: () => {},
    _readProjects: () => ({ projects: [{ name: 'rally', path: '/tmp/repo' }] }),
    _exec: () => {},
    _ora: silentOra,
    _chalk: silentChalk,
  });

  assert.strictEqual(result.cleaned.length, 2);
});

test('dispatchClean removes worktree via project path lookup', async () => {
  addDispatch(makeRecord({ id: 'd1', status: 'done', worktreePath: '/tmp/wt-1' }));

  let removedArgs = null;
  const result = await dispatchClean({
    _removeWorktree: (repo, wt) => { removedArgs = { repo, wt }; },
    _readProjects: () => ({ projects: [{ name: 'rally', path: '/projects/rally' }] }),
    _exec: () => {},
    _ora: silentOra,
    _chalk: silentChalk,
  });

  assert.strictEqual(result.cleaned.length, 1);
  assert.deepEqual(removedArgs, { repo: '/projects/rally', wt: '/tmp/wt-1' });
});

test('dispatchClean continues when worktree removal fails', async () => {
  addDispatch(makeRecord({ id: 'd1', status: 'done' }));

  const result = await dispatchClean({
    _removeWorktree: () => { throw new Error('worktree gone'); },
    _readProjects: () => ({ projects: [{ name: 'rally', path: '/tmp/repo' }] }),
    _exec: () => {},
    _ora: silentOra,
    _chalk: silentChalk,
  });

  // Should still clean the dispatch even if worktree removal fails
  assert.strictEqual(result.cleaned.length, 1);
  const remaining = getActiveDispatches();
  assert.strictEqual(remaining.length, 0);
});

test('dispatchClean deletes branches', async () => {
  // Set up a real git repo with a worktree
  const repoDir = join(tempDir, 'repo');
  mkdirSync(repoDir);
  execFileSync('git', ['init'], { cwd: repoDir });
  execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: repoDir });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: repoDir });
  writeFileSync(join(repoDir, 'README.md'), 'hello');
  execFileSync('git', ['add', '.'], { cwd: repoDir });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: repoDir });

  const wtPath = join(tempDir, 'wt-branch-test');
  createWorktree(repoDir, wtPath, 'rally/99-test-branch');

  addDispatch(makeRecord({
    id: 'branch-test-1',
    status: 'done',
    worktreePath: wtPath,
    branch: 'rally/99-test-branch',
  }));

  const result = await dispatchClean({
    _readProjects: () => ({ projects: [{ name: 'rally', path: repoDir }] }),
    _ora: silentOra,
    _chalk: silentChalk,
  });

  assert.strictEqual(result.cleaned.length, 1);

  // Branch should be deleted
  const branches = execFileSync('git', ['branch'], { cwd: repoDir, encoding: 'utf8' });
  assert.ok(!branches.includes('rally/99-test-branch'), 'Branch should be deleted after clean');
});

test('dispatchClean continues when branch deletion fails', async () => {
  addDispatch(makeRecord({ id: 'd1', status: 'done', branch: 'rally/nonexistent' }));

  let execCalls = [];
  const result = await dispatchClean({
    _removeWorktree: () => {},
    _readProjects: () => ({ projects: [{ name: 'rally', path: '/tmp/repo' }] }),
    _exec: () => { throw new Error('branch not found'); },
    _ora: silentOra,
    _chalk: silentChalk,
  });

  // Should still clean the dispatch even if branch deletion fails
  assert.strictEqual(result.cleaned.length, 1);
});

test('dispatchClean handles missing project gracefully', async () => {
  addDispatch(makeRecord({ id: 'd1', status: 'done' }));

  let worktreeRemoveCalled = false;
  const result = await dispatchClean({
    _removeWorktree: () => { worktreeRemoveCalled = true; },
    _readProjects: () => ({ projects: [] }),
    _exec: () => {},
    _ora: silentOra,
    _chalk: silentChalk,
  });

  // Should still remove dispatch even without project path
  assert.strictEqual(result.cleaned.length, 1);
  assert.strictEqual(worktreeRemoveCalled, false);
});

test('dispatchClean terminates tracked PIDs before cleanup', async () => {
  addDispatch(makeRecord({ id: 'd1', status: 'done', pid: 12345 }));
  
  let terminatedPids = [];
  const result = await dispatchClean({
    _terminatePid: (pid) => { terminatedPids.push(pid); },
    _removeWorktree: () => {},
    _readProjects: () => ({ projects: [{ name: 'rally', path: '/tmp/repo' }] }),
    _exec: () => {},
    _ora: silentOra,
    _chalk: silentChalk,
  });
  
  assert.strictEqual(result.cleaned.length, 1);
  assert.deepStrictEqual(terminatedPids, [12345]);
});

test('dispatchClean skips PID termination when PID is null', async () => {
  addDispatch(makeRecord({ id: 'd1', status: 'done', pid: null }));
  
  let terminateCalled = false;
  const result = await dispatchClean({
    _terminatePid: () => { terminateCalled = true; },
    _removeWorktree: () => {},
    _readProjects: () => ({ projects: [{ name: 'rally', path: '/tmp/repo' }] }),
    _exec: () => {},
    _ora: silentOra,
    _chalk: silentChalk,
  });
  
  assert.strictEqual(result.cleaned.length, 1);
  assert.strictEqual(terminateCalled, false);
});

test('dispatchClean continues when PID termination fails', async () => {
  addDispatch(makeRecord({ id: 'd1', status: 'done', pid: 99999 }));
  
  const result = await dispatchClean({
    _terminatePid: () => { throw new Error('Process termination failed'); },
    _removeWorktree: () => {},
    _readProjects: () => ({ projects: [{ name: 'rally', path: '/tmp/repo' }] }),
    _exec: () => {},
    _ora: silentOra,
    _chalk: silentChalk,
  });
  
  // Should still clean despite termination error
  assert.strictEqual(result.cleaned.length, 1);
});
