import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { refreshDispatchStatuses, isProcessRunning, isLogFileActive } from '../lib/dispatch-refresh.js';

describe('isProcessRunning', () => {
  test('returns true for the current process PID', () => {
    assert.strictEqual(isProcessRunning(process.pid), true);
  });

  test('returns false for a PID that does not exist', () => {
    // PID 2147483647 is almost certainly not running
    assert.strictEqual(isProcessRunning(2147483647), false);
  });
});

describe('isLogFileActive', () => {
  test('returns true when log file was modified recently', () => {
    const now = 1000000;
    const result = isLogFileActive('/tmp/test.log', {
      _statSync: () => ({ mtimeMs: now - 5000 }),
      _now: () => now,
    });
    assert.strictEqual(result, true);
  });

  test('returns false when log file is stale', () => {
    const now = 1000000;
    const result = isLogFileActive('/tmp/test.log', {
      _statSync: () => ({ mtimeMs: now - 60000 }),
      _now: () => now,
    });
    assert.strictEqual(result, false);
  });

  test('returns false when logPath is null', () => {
    assert.strictEqual(isLogFileActive(null), false);
  });

  test('returns false when stat throws (file missing)', () => {
    const result = isLogFileActive('/no/such/file', {
      _statSync: () => { throw new Error('ENOENT'); },
    });
    assert.strictEqual(result, false);
  });

  test('respects custom thresholdMs', () => {
    const now = 1000000;
    const result = isLogFileActive('/tmp/test.log', {
      thresholdMs: 5000,
      _statSync: () => ({ mtimeMs: now - 10000 }),
      _now: () => now,
    });
    assert.strictEqual(result, false);
  });
});

describe('refreshDispatchStatuses', () => {
  test('updates status to reviewing when PID is not running and log is stale', () => {
    const dispatches = [
      { id: 'issue-42', status: 'planning', session_id: '99999', type: 'issue' },
    ];
    const updates = [];

    const result = refreshDispatchStatuses({
      _getActiveDispatches: () => dispatches,
      _updateDispatchStatus: (id, status) => { updates.push({ id, status }); },
      _isProcessRunning: () => false,
      _isLogFileActive: () => false,
    });

    assert.strictEqual(updates.length, 1);
    assert.strictEqual(updates[0].id, 'issue-42');
    assert.strictEqual(updates[0].status, 'reviewing');
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'issue-42');
    assert.strictEqual(result[0].status, 'reviewing');
  });

  test('leaves status unchanged when PID is dead but log is still active', () => {
    const dispatches = [
      { id: 'issue-42', status: 'implementing', session_id: '99999', type: 'issue', logPath: '/tmp/test.log' },
    ];
    const updates = [];

    const result = refreshDispatchStatuses({
      _getActiveDispatches: () => dispatches,
      _updateDispatchStatus: (id, status) => { updates.push({ id, status }); },
      _isProcessRunning: () => false,
      _isLogFileActive: () => true,
    });

    assert.strictEqual(updates.length, 0);
    assert.strictEqual(result.length, 0);
  });

  test('leaves status unchanged when PID is still running', () => {
    const dispatches = [
      { id: 'issue-10', status: 'planning', session_id: '12345', type: 'issue' },
    ];
    const updates = [];

    const result = refreshDispatchStatuses({
      _getActiveDispatches: () => dispatches,
      _updateDispatchStatus: (id, status) => { updates.push({ id, status }); },
      _isProcessRunning: () => true,
      _isLogFileActive: () => false,
    });

    assert.strictEqual(updates.length, 0);
    assert.strictEqual(result.length, 0);
  });

  test('skips dispatches with non-PID session_id', () => {
    const dispatches = [
      { id: 'issue-5', status: 'planning', session_id: 'pending', type: 'issue' },
      { id: 'issue-6', status: 'implementing', session_id: 'sess-abc', type: 'issue' },
    ];
    const updates = [];

    const result = refreshDispatchStatuses({
      _getActiveDispatches: () => dispatches,
      _updateDispatchStatus: (id, status) => { updates.push({ id, status }); },
      _isProcessRunning: () => false,
    });

    assert.strictEqual(updates.length, 0);
    assert.strictEqual(result.length, 0);
  });

  test('skips dispatches with done/cleaned status', () => {
    const dispatches = [
      { id: 'd1', status: 'done', session_id: '111', type: 'issue' },
      { id: 'd3', status: 'cleaned', session_id: '333', type: 'issue' },
    ];
    const updates = [];

    const result = refreshDispatchStatuses({
      _getActiveDispatches: () => dispatches,
      _updateDispatchStatus: (id, status) => { updates.push({ id, status }); },
      _isProcessRunning: () => false,
    });

    assert.strictEqual(updates.length, 0);
    assert.strictEqual(result.length, 0);
  });

  test('skips reviewing dispatches (already at terminal auto-status)', () => {
    const dispatches = [
      { id: 'd2', status: 'reviewing', session_id: '222', type: 'pr' },
    ];
    const updates = [];

    const result = refreshDispatchStatuses({
      _getActiveDispatches: () => dispatches,
      _updateDispatchStatus: (id, status) => { updates.push({ id, status }); },
      _isProcessRunning: () => false,
    });

    assert.strictEqual(updates.length, 0);
    assert.strictEqual(result.length, 0);
  });

  test('handles no active dispatches', () => {
    const result = refreshDispatchStatuses({
      _getActiveDispatches: () => [],
      _updateDispatchStatus: () => { throw new Error('should not be called'); },
      _isProcessRunning: () => false,
    });

    assert.deepStrictEqual(result, []);
  });

  test('handles multiple dispatches with mixed states', () => {
    const dispatches = [
      { id: 'a', status: 'planning', session_id: '100', type: 'issue' },
      { id: 'b', status: 'implementing', session_id: '200', type: 'issue' },
      { id: 'c', status: 'done', session_id: '300', type: 'pr' },
      { id: 'd', status: 'planning', session_id: 'pending', type: 'issue' },
      { id: 'e', status: 'planning', session_id: '400', type: 'issue' },
    ];
    const updates = [];
    const runningPids = new Set([100]); // only PID 100 is alive

    const result = refreshDispatchStatuses({
      _getActiveDispatches: () => dispatches,
      _updateDispatchStatus: (id, status) => { updates.push({ id, status }); },
      _isProcessRunning: (pid) => runningPids.has(pid),
      _isLogFileActive: () => false,
    });

    // 'a' (PID 100) still running — no update
    // 'b' (PID 200) dead, log stale — updated
    // 'c' done — skipped
    // 'd' non-PID — skipped
    // 'e' (PID 400) dead, log stale — updated
    assert.strictEqual(updates.length, 2);
    assert.strictEqual(updates[0].id, 'b');
    assert.strictEqual(updates[1].id, 'e');
    assert.strictEqual(result.length, 2);
  });

  test('continues when updateDispatchStatus throws', () => {
    const dispatches = [
      { id: 'x', status: 'planning', session_id: '500', type: 'issue' },
      { id: 'y', status: 'planning', session_id: '600', type: 'issue' },
    ];
    let callCount = 0;

    const result = refreshDispatchStatuses({
      _getActiveDispatches: () => dispatches,
      _updateDispatchStatus: () => {
        callCount++;
        if (callCount === 1) throw new Error('disk full');
      },
      _isProcessRunning: () => false,
      _isLogFileActive: () => false,
    });
    assert.strictEqual(callCount, 2);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'y');
  });
});
