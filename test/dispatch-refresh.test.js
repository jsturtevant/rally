import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { refreshDispatchStatuses, isProcessRunning, isLogComplete } from '../lib/dispatch-refresh.js';

describe('refreshDispatchStatuses — session ID auto-resolution', () => {
  test('resolves PID-style session_id to UUID from log when moving to reviewing', () => {
    const dispatches = [
      { id: 'rally-42', status: 'implementing', session_id: '99999', logPath: '/tmp/copilot.log' },
    ];
    const fieldUpdates = [];
    const statusUpdates = [];

    refreshDispatchStatuses({
      _getActiveDispatches: () => dispatches,
      _updateDispatchStatus: (id, status) => { statusUpdates.push({ id, status }); },
      _updateDispatchField: (id, field, value) => { fieldUpdates.push({ id, field, value }); },
      _isProcessRunning: () => false,
      _isLogComplete: () => true,
      _parseSessionIdFromLog: () => 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    });

    assert.strictEqual(statusUpdates.length, 1);
    assert.strictEqual(statusUpdates[0].status, 'reviewing');
    assert.strictEqual(fieldUpdates.length, 1);
    assert.deepEqual(fieldUpdates[0], {
      id: 'rally-42',
      field: 'session_id',
      value: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    });
  });

  test('does not update session_id when it is already a UUID', () => {
    const dispatches = [
      { id: 'rally-42', status: 'implementing', session_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', logPath: '/tmp/copilot.log' },
    ];
    const fieldUpdates = [];

    // session_id is not all-digits, so refreshDispatchStatuses won't even try to resolve
    // (it skips the dispatch in the PID check)
    refreshDispatchStatuses({
      _getActiveDispatches: () => dispatches,
      _updateDispatchStatus: () => {},
      _updateDispatchField: (id, field, value) => { fieldUpdates.push({ id, field, value }); },
      _isProcessRunning: () => false,
      _isLogComplete: () => true,
      _parseSessionIdFromLog: () => 'should-not-be-called',
    });

    assert.strictEqual(fieldUpdates.length, 0);
  });

  test('skips session_id update when parseSessionIdFromLog returns null', () => {
    const dispatches = [
      { id: 'rally-42', status: 'implementing', session_id: '12345', logPath: '/tmp/copilot.log' },
    ];
    const fieldUpdates = [];
    const statusUpdates = [];

    refreshDispatchStatuses({
      _getActiveDispatches: () => dispatches,
      _updateDispatchStatus: (id, status) => { statusUpdates.push({ id, status }); },
      _updateDispatchField: (id, field, value) => { fieldUpdates.push({ id, field, value }); },
      _isProcessRunning: () => false,
      _isLogComplete: () => true,
      _parseSessionIdFromLog: () => null,
    });

    assert.strictEqual(statusUpdates.length, 1);
    assert.strictEqual(fieldUpdates.length, 0);
  });

  test('refreshDispatchStatuses continues processing when updateDispatchField throws during session resolve', () => {
    const dispatches = [
      { id: 'rally-42', status: 'implementing', session_id: '11111', logPath: '/tmp/a.log' },
      { id: 'rally-43', status: 'implementing', session_id: '22222', logPath: '/tmp/b.log' },
    ];
    const statusUpdates = [];

    refreshDispatchStatuses({
      _getActiveDispatches: () => dispatches,
      _updateDispatchStatus: (id, status) => { statusUpdates.push({ id, status }); },
      _updateDispatchField: () => { throw new Error('disk full'); },
      _isProcessRunning: () => false,
      _isLogComplete: () => true,
      _parseSessionIdFromLog: () => 'uuid-parsed',
    });

    assert.strictEqual(statusUpdates.length, 2);
  });
});

describe('isProcessRunning', () => {
  test('returns true for the current process PID', () => {
    assert.strictEqual(isProcessRunning(process.pid), true);
  });

  test('returns false for a PID that does not exist', () => {
    assert.strictEqual(isProcessRunning(2147483647), false);
  });
});

describe('isLogComplete', () => {
  test('returns true when the log contains the completion marker', () => {
    const result = isLogComplete('/tmp/test.log', {
      _exists: () => true,
      _readFile: () => 'Total usage est: 6 Premium requests\nTotal session time:     1m 15s\n',
    });
    assert.strictEqual(result, true);
  });

  test('returns false when the log does not exist', () => {
    let readAttempted = false;
    const result = isLogComplete('/no/such/file', {
      _exists: () => false,
      _readFile: () => {
        readAttempted = true;
        return 'Total session time:     1m 15s';
      },
    });
    assert.strictEqual(result, false);
    assert.strictEqual(readAttempted, false);
  });

  test('returns false when logPath is null', () => {
    assert.strictEqual(isLogComplete(null), false);
  });

  test('returns false when the log is empty', () => {
    const result = isLogComplete('/tmp/test.log', {
      _exists: () => true,
      _readFile: () => '',
    });
    assert.strictEqual(result, false);
  });

  test('returns false when the completion marker is missing', () => {
    const result = isLogComplete('/tmp/test.log', {
      _exists: () => true,
      _readFile: () => 'Still writing output\n',
    });
    assert.strictEqual(result, false);
  });

  test('returns false when reading the log throws', () => {
    const result = isLogComplete('/tmp/test.log', {
      _exists: () => true,
      _readFile: () => { throw new Error('EACCES'); },
    });
    assert.strictEqual(result, false);
  });
});

describe('refreshDispatchStatuses', () => {
  test('updates status to reviewing when PID is not running and log is complete', () => {
    const dispatches = [
      { id: 'issue-42', status: 'implementing', session_id: '99999', type: 'issue' },
    ];
    const updates = [];

    const result = refreshDispatchStatuses({
      _getActiveDispatches: () => dispatches,
      _updateDispatchStatus: (id, status) => { updates.push({ id, status }); },
      _isProcessRunning: () => false,
      _isLogComplete: () => true,
    });

    assert.strictEqual(updates.length, 1);
    assert.strictEqual(updates[0].id, 'issue-42');
    assert.strictEqual(updates[0].status, 'reviewing');
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'issue-42');
    assert.strictEqual(result[0].status, 'reviewing');
  });

  test('refreshDispatchStatuses leaves status unchanged when PID is dead but log is not complete', () => {
    const dispatches = [
      { id: 'issue-42', status: 'implementing', session_id: '99999', type: 'issue', logPath: '/tmp/test.log' },
    ];
    const updates = [];

    const result = refreshDispatchStatuses({
      _getActiveDispatches: () => dispatches,
      _updateDispatchStatus: (id, status) => { updates.push({ id, status }); },
      _isProcessRunning: () => false,
      _isLogComplete: () => false,
    });

    assert.strictEqual(updates.length, 0);
    assert.strictEqual(result.length, 0);
  });

  test('refreshDispatchStatuses leaves status unchanged when PID is still running', () => {
    const dispatches = [
      { id: 'issue-10', status: 'implementing', session_id: '12345', type: 'issue' },
    ];
    const updates = [];

    const result = refreshDispatchStatuses({
      _getActiveDispatches: () => dispatches,
      _updateDispatchStatus: (id, status) => { updates.push({ id, status }); },
      _isProcessRunning: () => true,
      _isLogComplete: () => true,
    });

    assert.strictEqual(updates.length, 0);
    assert.strictEqual(result.length, 0);
  });

  test('supports the legacy _isLogFileActive test hook as a completion alias', () => {
    const dispatches = [
      { id: 'issue-43', status: 'implementing', session_id: '99998', type: 'issue' },
    ];
    const updates = [];

    const result = refreshDispatchStatuses({
      _getActiveDispatches: () => dispatches,
      _updateDispatchStatus: (id, status) => { updates.push({ id, status }); },
      _isProcessRunning: () => false,
      _isLogFileActive: () => true,
    });

    assert.strictEqual(updates.length, 1);
    assert.strictEqual(result.length, 1);
  });

  test('skips dispatches with non-PID session_id', () => {
    const dispatches = [
      { id: 'issue-5', status: 'implementing', session_id: 'pending', type: 'issue' },
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
      { id: 'd1', status: 'upstream', session_id: '111', type: 'issue' },
      { id: 'd3', status: 'upstream', session_id: '333', type: 'issue' },
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
      { id: 'a', status: 'implementing', session_id: '100', type: 'issue' },
      { id: 'b', status: 'implementing', session_id: '200', type: 'issue' },
      { id: 'c', status: 'upstream', session_id: '300', type: 'pr' },
      { id: 'd', status: 'implementing', session_id: 'pending', type: 'issue' },
      { id: 'e', status: 'implementing', session_id: '400', type: 'issue' },
    ];
    const updates = [];
    const runningPids = new Set([100]);

    const result = refreshDispatchStatuses({
      _getActiveDispatches: () => dispatches,
      _updateDispatchStatus: (id, status) => { updates.push({ id, status }); },
      _isProcessRunning: (pid) => runningPids.has(pid),
      _isLogComplete: () => true,
    });

    assert.strictEqual(updates.length, 2);
    assert.strictEqual(updates[0].id, 'b');
    assert.strictEqual(updates[1].id, 'e');
    assert.strictEqual(result.length, 2);
  });

  test('refreshDispatchStatuses continues when updateDispatchStatus throws', () => {
    const dispatches = [
      { id: 'x', status: 'implementing', session_id: '500', type: 'issue' },
      { id: 'y', status: 'implementing', session_id: '600', type: 'issue' },
    ];
    let callCount = 0;

    const result = refreshDispatchStatuses({
      _getActiveDispatches: () => dispatches,
      _updateDispatchStatus: () => {
        callCount++;
        if (callCount === 1) throw new Error('disk full');
      },
      _isProcessRunning: () => false,
      _isLogComplete: () => true,
    });

    assert.strictEqual(callCount, 2);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'y');
  });
});
