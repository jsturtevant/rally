import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { listDispatchSessions, formatDispatchSessions } from '../lib/dispatch-sessions.js';

describe('listDispatchSessions', () => {
  test('returns all dispatches with session info', () => {
    const dispatches = [
      { id: 'rally-42', session_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', status: 'implementing' },
      { id: 'rally-pr-15', session_id: 'pending', status: 'reviewing' },
    ];

    const result = listDispatchSessions({
      _getActiveDispatches: () => dispatches,
    });

    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].id, 'rally-42');
    assert.strictEqual(result[0].session_id, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    assert.strictEqual(result[0].status, 'implementing');
    assert.strictEqual(result[1].id, 'rally-pr-15');
    assert.strictEqual(result[1].session_id, 'pending');
    assert.strictEqual(result[1].status, 'reviewing');
  });

  test('returns empty array when no dispatches', () => {
    const result = listDispatchSessions({
      _getActiveDispatches: () => [],
    });
    assert.deepStrictEqual(result, []);
  });
});

describe('formatDispatchSessions', () => {
  test('formats dispatches into a table with header', () => {
    const sessions = [
      { id: 'rally-42', session_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', status: 'implementing' },
      { id: 'rally-pr-15', session_id: 'pending', status: 'reviewing' },
    ];

    const output = formatDispatchSessions(sessions);
    const lines = output.split('\n');

    // Header line
    assert.ok(lines[0].includes('Dispatch'));
    assert.ok(lines[0].includes('Session'));
    assert.ok(lines[0].includes('Status'));

    // Data lines
    assert.ok(output.includes('rally-42'));
    assert.ok(output.includes('a1b2c3d4-e5f6-7890-abcd-ef1234567890'));
    assert.ok(output.includes('implementing'));
    assert.ok(output.includes('rally-pr-15'));
    assert.ok(output.includes('(no session)'));
    assert.ok(output.includes('reviewing'));
  });

  test('shows (no session) for PID-only session IDs', () => {
    const sessions = [
      { id: 'rally-99', session_id: '12345', status: 'planning' },
    ];

    const output = formatDispatchSessions(sessions);
    assert.ok(output.includes('(no session)'));
  });

  test('returns "No active dispatches." when empty', () => {
    const output = formatDispatchSessions([]);
    assert.strictEqual(output, 'No active dispatches.');
  });
});
