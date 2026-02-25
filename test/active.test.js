import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, mkdirSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { withTempRallyHome } from './helpers/temp-env.js';
import {
  addDispatch,
  updateDispatchStatus,
  updateDispatchField,
  removeDispatch,
  getActiveDispatches,
  terminatePid,
  cleanupLock,
  VALID_STATUSES,
} from '../lib/active.js';

function makeRecord(overrides = {}) {
  return {
    id: 'dispatch-1',
    repo: 'jsturtevant/rally',
    number: 19,
    type: 'issue',
    branch: 'rally/19-active-tracking',
    worktreePath: '/tmp/worktrees/rally-19',
    status: 'planning',
    session_id: 'sess-abc123',
    ...overrides,
  };
}

let tempDir;

beforeEach((t) => {
  tempDir = withTempRallyHome(t);
});

test('getActiveDispatches returns empty array when no active.yaml', () => {
  const dispatches = getActiveDispatches();
  assert.deepEqual(dispatches, []);
});

test('addDispatch creates a dispatch record', () => {
  const record = makeRecord();
  const result = addDispatch(record);

  assert.strictEqual(result.id, 'dispatch-1');
  assert.strictEqual(result.repo, 'jsturtevant/rally');
  assert.strictEqual(result.number, 19);
  assert.strictEqual(result.type, 'issue');
  assert.strictEqual(result.status, 'planning');
  assert.ok(result.created);

  const dispatches = getActiveDispatches();
  assert.strictEqual(dispatches.length, 1);
  assert.strictEqual(dispatches[0].id, 'dispatch-1');
});

test('addDispatch persists to active.yaml', () => {
  addDispatch(makeRecord());

  const activePath = join(tempDir, 'active.yaml');
  assert.ok(existsSync(activePath));

  const content = readFileSync(activePath, 'utf8');
  assert.ok(content.includes('dispatch-1'));
  assert.ok(content.includes('jsturtevant/rally'));
});

test('addDispatch writes atomically (no temp file left behind)', () => {
  addDispatch(makeRecord());

  const tempPath = join(tempDir, '.active.yaml.tmp');
  assert.ok(!existsSync(tempPath));
});

test('addDispatch throws on duplicate id', () => {
  addDispatch(makeRecord());

  assert.throws(() => {
    addDispatch(makeRecord());
  }, /already exists/);
});

test('addDispatch throws on missing required field', () => {
  assert.throws(() => {
    addDispatch({ id: 'x' });
  }, /Missing required field/);
});

test('addDispatch throws on invalid type', () => {
  assert.throws(() => {
    addDispatch(makeRecord({ type: 'bug' }));
  }, /Invalid dispatch type/);
});

test('addDispatch throws on invalid status', () => {
  assert.throws(() => {
    addDispatch(makeRecord({ status: 'invalid' }));
  }, /Invalid dispatch status/);
});

test('addDispatch accepts type "pr"', () => {
  const result = addDispatch(makeRecord({ type: 'pr' }));
  assert.strictEqual(result.type, 'pr');
});

test('addDispatch preserves provided created timestamp', () => {
  const ts = '2026-01-01T00:00:00.000Z';
  const result = addDispatch(makeRecord({ created: ts }));
  assert.strictEqual(result.created, ts);
});

test('addDispatch multiple records', () => {
  addDispatch(makeRecord({ id: 'a' }));
  addDispatch(makeRecord({ id: 'b' }));
  addDispatch(makeRecord({ id: 'c' }));

  const dispatches = getActiveDispatches();
  assert.strictEqual(dispatches.length, 3);
});

test('updateDispatchStatus updates status', () => {
  addDispatch(makeRecord());
  const result = updateDispatchStatus('dispatch-1', 'implementing');

  assert.strictEqual(result.status, 'implementing');

  const dispatches = getActiveDispatches();
  assert.strictEqual(dispatches[0].status, 'implementing');
});

test('updateDispatchStatus transitions through all statuses', () => {
  addDispatch(makeRecord());

  for (const status of VALID_STATUSES) {
    const result = updateDispatchStatus('dispatch-1', status);
    assert.strictEqual(result.status, status);
  }
});

test('updateDispatchStatus throws on unknown id', () => {
  assert.throws(() => {
    updateDispatchStatus('nonexistent', 'done');
  }, /not found/);
});

test('updateDispatchStatus throws on invalid status', () => {
  addDispatch(makeRecord());

  assert.throws(() => {
    updateDispatchStatus('dispatch-1', 'bogus');
  }, /Invalid dispatch status/);
});

test('removeDispatch removes a record', () => {
  addDispatch(makeRecord());
  const removed = removeDispatch('dispatch-1');

  assert.strictEqual(removed.id, 'dispatch-1');

  const dispatches = getActiveDispatches();
  assert.strictEqual(dispatches.length, 0);
});

test('removeDispatch throws on unknown id', () => {
  assert.throws(() => {
    removeDispatch('nonexistent');
  }, /not found/);
});

test('removeDispatch removes only the target record', () => {
  addDispatch(makeRecord({ id: 'keep' }));
  addDispatch(makeRecord({ id: 'remove' }));

  removeDispatch('remove');

  const dispatches = getActiveDispatches();
  assert.strictEqual(dispatches.length, 1);
  assert.strictEqual(dispatches[0].id, 'keep');
});

test('VALID_STATUSES contains expected values', () => {
  assert.deepEqual(VALID_STATUSES, ['planning', 'implementing', 'reviewing', 'pushed', 'done', 'cleaned']);
});

test('lock is released even when wrapped function throws', () => {
  const lockDir = join(tempDir, '.active.lock');
  assert.throws(
    () => addDispatch({ id: 'x' }),
    /Missing required field/
  );
  // Lock should be released after error
  assert.ok(!existsSync(lockDir), 'lock dir should be removed after error');
});

test('stale lock by age is removed and addDispatch succeeds', () => {
  const lockDir = join(tempDir, '.active.lock');
  mkdirSync(lockDir);
  const staleInfo = { pid: 999999, timestamp: Date.now() - 6 * 60 * 1000 };
  writeFileSync(join(lockDir, 'info.json'), JSON.stringify(staleInfo), 'utf8');

  const result = addDispatch(makeRecord({ id: 'stale-age' }));
  assert.strictEqual(result.id, 'stale-age');
  assert.ok(!existsSync(lockDir), 'stale lock dir should be removed');
});

test('stale lock by dead pid is removed and addDispatch succeeds', () => {
  const lockDir = join(tempDir, '.active.lock');
  mkdirSync(lockDir);
  const staleInfo = { pid: 999999, timestamp: Date.now() };
  writeFileSync(join(lockDir, 'info.json'), JSON.stringify(staleInfo), 'utf8');

  const result = addDispatch(makeRecord({ id: 'stale-pid' }));
  assert.strictEqual(result.id, 'stale-pid');
  assert.ok(!existsSync(lockDir), 'stale lock dir should be removed');
});

test('lock without info.json (legacy) uses mtime for stale detection', () => {
  const lockDir = join(tempDir, '.active.lock');
  mkdirSync(lockDir);
  // Create lock dir but no info.json — simulate legacy or failed write
  // Touch the dir to set mtime to 6 minutes ago
  const staleTime = Date.now() - 6 * 60 * 1000;
  utimesSync(lockDir, new Date(staleTime), new Date(staleTime));

  const result = addDispatch(makeRecord({ id: 'legacy-lock' }));
  assert.strictEqual(result.id, 'legacy-lock');
  assert.ok(!existsSync(lockDir), 'legacy lock dir should be removed by mtime');
});

test('non-stale lock (alive PID, recent timestamp) is NOT removed', () => {
  const lockDir = join(tempDir, '.active.lock');
  mkdirSync(lockDir);
  const validInfo = { pid: process.pid, timestamp: Date.now() };
  writeFileSync(join(lockDir, 'info.json'), JSON.stringify(validInfo), 'utf8');

  // Attempt to add dispatch should timeout waiting for this valid lock
  const startTime = Date.now();
  assert.throws(
    () => addDispatch(makeRecord({ id: 'should-fail' })),
    /Failed to acquire lock/
  );
  const elapsed = Date.now() - startTime;
  assert.ok(elapsed >= 10000, 'should wait for lock timeout');
  assert.ok(existsSync(lockDir), 'valid lock dir should NOT be removed');
});

test('updateDispatchField updates a single field', () => {
  addDispatch(makeRecord({ id: 'field-test' }));
  const updated = updateDispatchField('field-test', 'session_id', 'abc-123');
  assert.strictEqual(updated.session_id, 'abc-123');
  const dispatches = getActiveDispatches();
  assert.strictEqual(dispatches[0].session_id, 'abc-123');
});

test('updateDispatchField throws on unknown id', () => {
  assert.throws(() => {
    updateDispatchField('nonexistent', 'session_id', 'abc');
  }, /not found/);
});

test('updateDispatchField preserves other fields', () => {
  addDispatch(makeRecord({ id: 'preserve-test' }));
  updateDispatchField('preserve-test', 'session_id', 'new-session');
  const dispatches = getActiveDispatches();
  assert.strictEqual(dispatches[0].repo, 'jsturtevant/rally');
  assert.strictEqual(dispatches[0].session_id, 'new-session');
});

test('updateDispatchField rejects disallowed field names', () => {
  addDispatch(makeRecord({ id: 'allowlist-test' }));
  assert.throws(() => {
    updateDispatchField('allowlist-test', '__proto__', {});
  }, /Cannot update field/);
  assert.throws(() => {
    updateDispatchField('allowlist-test', 'constructor', {});
  }, /Cannot update field/);
  assert.throws(() => {
    updateDispatchField('allowlist-test', 'arbitrary_field', 'value');
  }, /Cannot update field/);
});

test('updateDispatchField allows all permitted fields', () => {
  addDispatch(makeRecord({ id: 'all-fields-test' }));
  updateDispatchField('all-fields-test', 'session_id', 'sess-1');
  updateDispatchField('all-fields-test', 'status', 'reviewing');
  updateDispatchField('all-fields-test', 'logPath', '/tmp/log');
  updateDispatchField('all-fields-test', 'pid', 9999);
  const dispatches = getActiveDispatches();
  const d = dispatches.find(r => r.id === 'all-fields-test');
  assert.strictEqual(d.session_id, 'sess-1');
  assert.strictEqual(d.status, 'reviewing');
  assert.strictEqual(d.logPath, '/tmp/log');
  assert.strictEqual(d.pid, 9999);
});

test('updateDispatchField validates status values', () => {
  addDispatch(makeRecord({ id: 'status-validate-test' }));
  assert.throws(() => {
    updateDispatchField('status-validate-test', 'status', 'invalid-status');
  }, /Invalid dispatch status/);
});

test('concurrent addDispatch calls do not lose records', () => {
  // Simulate by calling addDispatch twice in sequence (same-process concurrency test)
  addDispatch(makeRecord({ id: 'concurrent-1' }));
  addDispatch(makeRecord({ id: 'concurrent-2' }));
  const dispatches = getActiveDispatches();
  assert.strictEqual(dispatches.length, 2);
  assert.ok(dispatches.some(d => d.id === 'concurrent-1'));
  assert.ok(dispatches.some(d => d.id === 'concurrent-2'));
});


test('terminatePid returns false when PID is null', () => {
  const result = terminatePid(null);
  assert.strictEqual(result, false);
});

test('terminatePid returns false when PID is not a number', () => {
  const result = terminatePid('not-a-number');
  assert.strictEqual(result, false);
});

test('terminatePid returns false for negative PID', () => {
  const result = terminatePid(-1);
  assert.strictEqual(result, false);
});

test('terminatePid returns false for zero PID', () => {
  const result = terminatePid(0);
  assert.strictEqual(result, false);
});

test('terminatePid returns false for float PID', () => {
  const result = terminatePid(123.45);
  assert.strictEqual(result, false);
});

test('terminatePid calls process.kill with SIGTERM', () => {
  let captured;
  const mockKill = (pid, signal) => {
    captured = { pid, signal };
  };
  const mockRead = () => 'gh\0copilot\0--some-flag';
  const result = terminatePid(12345, mockKill, mockRead);
  assert.strictEqual(result, true);
  assert.deepStrictEqual(captured, { pid: 12345, signal: 'SIGTERM' });
});

test('terminatePid returns false when kill throws (best-effort)', () => {
  const mockKill = () => {
    throw new Error('No such process');
  };
  const mockRead = () => 'gh\0copilot\0--some-flag';
  const result = terminatePid(99999, mockKill, mockRead);
  assert.strictEqual(result, false);
});

test('terminatePid returns false when PID is not a gh copilot process', () => {
  let killed = false;
  const mockKill = () => { killed = true; };
  const mockRead = () => '/usr/bin/node\0server.js';
  const result = terminatePid(12345, mockKill, mockRead);
  assert.strictEqual(result, false);
  assert.strictEqual(killed, false, 'should not kill non-copilot processes');
});

test('terminatePid rejects false positive with copilot in path', () => {
  let killed = false;
  const mockKill = () => { killed = true; };
  const mockRead = () => '/home/user/copilot-backup/script.sh\0arg1';
  const result = terminatePid(12345, mockKill, mockRead);
  assert.strictEqual(result, false);
  assert.strictEqual(killed, false, 'should not kill process with copilot only in path');
});

test('terminatePid accepts gh with full path', () => {
  let captured;
  const mockKill = (pid, signal) => { captured = { pid, signal }; };
  const mockRead = () => '/usr/bin/gh\0copilot\0--resume\0abc';
  const result = terminatePid(12345, mockKill, mockRead);
  assert.strictEqual(result, true);
  assert.deepStrictEqual(captured, { pid: 12345, signal: 'SIGTERM' });
});

test('terminatePid proceeds when /proc is unavailable', () => {
  let captured;
  const mockKill = (pid, signal) => { captured = { pid, signal }; };
  const mockRead = () => { throw new Error('ENOENT'); };
  const result = terminatePid(12345, mockKill, mockRead);
  assert.strictEqual(result, true);
  assert.deepStrictEqual(captured, { pid: 12345, signal: 'SIGTERM' });
});

test('addDispatch stores PID field', () => {
  const record = makeRecord({ pid: 54321 });
  const result = addDispatch(record);
  assert.strictEqual(result.pid, 54321);
  
  const dispatches = getActiveDispatches();
  assert.strictEqual(dispatches[0].pid, 54321);
});

test('addDispatch allows null PID field', () => {
  const record = makeRecord({ pid: null });
  const result = addDispatch(record);
  assert.strictEqual(result.pid, null);
});

test('cleanupLock does not throw when no lock exists', () => {
  assert.doesNotThrow(() => cleanupLock());
});

test('cleanupLock removes lock owned by current process', () => {
  const configDir = join(tempDir, 'cleanup-own');
  mkdirSync(configDir, { recursive: true });
  const lockDir = join(configDir, '.active.lock');
  mkdirSync(lockDir);
  writeFileSync(join(lockDir, 'info.json'), JSON.stringify({ pid: process.pid, timestamp: Date.now() }));
  const origEnv = process.env.RALLY_HOME;
  process.env.RALLY_HOME = configDir;
  try {
    cleanupLock();
    assert.ok(!existsSync(lockDir), 'lock should be removed');
  } finally {
    if (origEnv !== undefined) process.env.RALLY_HOME = origEnv;
    else delete process.env.RALLY_HOME;
  }
});

test('cleanupLock does not remove lock owned by another process', () => {
  const configDir = join(tempDir, 'cleanup-other');
  mkdirSync(configDir, { recursive: true });
  const lockDir = join(configDir, '.active.lock');
  mkdirSync(lockDir);
  writeFileSync(join(lockDir, 'info.json'), JSON.stringify({ pid: 999999, timestamp: Date.now() }));
  const origEnv = process.env.RALLY_HOME;
  process.env.RALLY_HOME = configDir;
  try {
    cleanupLock();
    assert.ok(existsSync(lockDir), 'lock should remain');
  } finally {
    if (origEnv !== undefined) process.env.RALLY_HOME = origEnv;
    else delete process.env.RALLY_HOME;
  }
});
