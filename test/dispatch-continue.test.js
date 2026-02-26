import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatchContinue } from '../lib/dispatch-continue.js';

function makeRecord(overrides = {}) {
  return {
    id: 'rally-issue-42',
    repo: 'jsturtevant/rally',
    number: 42,
    type: 'issue',
    branch: 'rally/42-fix-bug',
    worktreePath: '/tmp/fake-worktree',
    status: 'reviewing',
    session_id: 'sess-abc',
    logPath: '/tmp/fake-log',
    ...overrides,
  };
}

const silentChalk = {
  cyan: (s) => s,
  dim: (s) => s,
};

// Suppress console.log during tests via t.mock.method — see individual tests

test('throws when no dispatch found for the given number', async () => {
  await assert.rejects(
    () => dispatchContinue(999, {
      _getActiveDispatches: () => [],
      _chalk: silentChalk,
    }),
    { message: 'No active dispatch found for #999' }
  );
});

test('throws when multiple dispatches match (needs --repo)', async () => {
  await assert.rejects(
    () => dispatchContinue(42, {
      _getActiveDispatches: () => [
        makeRecord({ id: 'd1', repo: 'owner/repo-a' }),
        makeRecord({ id: 'd2', repo: 'owner/repo-b' }),
      ],
      _chalk: silentChalk,
    }),
    { message: /Multiple dispatches found for #42.*Use --repo to disambiguate/ }
  );
});

test('throws when worktree does not exist', async () => {
  await assert.rejects(
    () => dispatchContinue(42, {
      _getActiveDispatches: () => [makeRecord()],
      _existsSync: () => false,
      _chalk: silentChalk,
    }),
    { message: /Worktree not found/ }
  );
});

test('throws when no session ID available (pending, no log parse)', async () => {
  await assert.rejects(
    () => dispatchContinue(42, {
      _getActiveDispatches: () => [makeRecord({ session_id: 'pending' })],
      _existsSync: () => true,
      _parseSessionIdFromLog: () => null,
      _chalk: silentChalk,
    }),
    { message: /No session ID available for #42/ }
  );
});

test('resolves session ID from log when stored value is a PID', async (t) => {
  t.mock.method(console, 'log', () => {});
  let resumedSessionId = null;

  await dispatchContinue(42, {
    _getActiveDispatches: () => [makeRecord({ session_id: '12345' })],
    _existsSync: () => true,
    _parseSessionIdFromLog: () => 'ses_resolved-from-log',
    _updateDispatchField: () => {},
    _updateDispatchStatus: () => {},
    _resumeCopilot: (_wt, sid) => { resumedSessionId = sid; return { status: 0 }; },
    _chalk: silentChalk,
  });

  assert.strictEqual(resumedSessionId, 'ses_resolved-from-log');
});

test('persists resolved session ID back via updateDispatchField', async (t) => {
  t.mock.method(console, 'log', () => {});
  let fieldUpdates = [];

  await dispatchContinue(42, {
    _getActiveDispatches: () => [makeRecord({ session_id: '12345' })],
    _existsSync: () => true,
    _parseSessionIdFromLog: () => 'ses_new-id',
    _updateDispatchField: (id, field, value) => { fieldUpdates.push({ id, field, value }); },
    _updateDispatchStatus: () => {},
    _resumeCopilot: () => ({ status: 0 }),
    _chalk: silentChalk,
  });

  assert.strictEqual(fieldUpdates.length, 1);
  assert.deepEqual(fieldUpdates[0], {
    id: 'rally-issue-42',
    field: 'session_id',
    value: 'ses_new-id',
  });
});

test('sets status to implementing before resume, restores to reviewing after', async (t) => {
  t.mock.method(console, 'log', () => {});
  let statusUpdates = [];

  await dispatchContinue(42, {
    _getActiveDispatches: () => [makeRecord({ status: 'reviewing' })],
    _existsSync: () => true,
    _parseSessionIdFromLog: () => null,
    _updateDispatchField: () => {},
    _updateDispatchStatus: (id, status) => { statusUpdates.push(status); },
    _resumeCopilot: () => ({ status: 0 }),
    _chalk: silentChalk,
  });

  assert.deepEqual(statusUpdates, ['implementing', 'reviewing']);
});

test('continueDispatch passes message option through to resumeCopilot', async (t) => {
  t.mock.method(console, 'log', () => {});
  let capturedOpts = null;

  await dispatchContinue(42, {
    message: 'focus on tests',
    _getActiveDispatches: () => [makeRecord()],
    _existsSync: () => true,
    _parseSessionIdFromLog: () => null,
    _updateDispatchField: () => {},
    _updateDispatchStatus: () => {},
    _resumeCopilot: (_wt, _sid, opts) => { capturedOpts = opts; return { status: 0 }; },
    _chalk: silentChalk,
  });

  assert.strictEqual(capturedOpts.message, 'focus on tests');
});

test('continueDispatch includes dispatch id context in resume message', async (t) => {
  const mockLog = t.mock.method(console, 'log', () => {});

  await dispatchContinue(42, {
    _getActiveDispatches: () => [makeRecord({ id: 'rally-42' })],
    _existsSync: () => true,
    _parseSessionIdFromLog: () => null,
    _updateDispatchField: () => {},
    _updateDispatchStatus: () => {},
    _resumeCopilot: () => ({ status: 0 }),
    _chalk: silentChalk,
  });

  const msg = mockLog.mock.calls.map((call) => call.arguments.join(' ')).join('\n');
  assert.ok(msg.includes('rally-42'), `Expected dispatch id in message, got: ${msg}`);
});

test('continueDispatch works with --repo filter for disambiguation', async (t) => {
  t.mock.method(console, 'log', () => {});
  let resumedId = null;

  await dispatchContinue(42, {
    repo: 'owner/repo-b',
    _getActiveDispatches: () => [
      makeRecord({ id: 'd1', repo: 'owner/repo-a' }),
      makeRecord({ id: 'd2', repo: 'owner/repo-b' }),
    ],
    _existsSync: () => true,
    _parseSessionIdFromLog: () => null,
    _updateDispatchField: () => {},
    _updateDispatchStatus: () => {},
    _resumeCopilot: (wt, sid) => { resumedId = sid; return { status: 0 }; },
    _chalk: silentChalk,
  });

  assert.strictEqual(resumedId, 'sess-abc');
});

test('handles resume failure gracefully (status still restored)', async (t) => {
  t.mock.method(console, 'log', () => {});
  let statusUpdates = [];

  await assert.rejects(
    () => dispatchContinue(42, {
      _getActiveDispatches: () => [makeRecord({ status: 'reviewing' })],
      _existsSync: () => true,
      _parseSessionIdFromLog: () => null,
      _updateDispatchField: () => {},
      _updateDispatchStatus: (id, status) => { statusUpdates.push(status); },
      _resumeCopilot: () => { throw new Error('resume failed'); },
      _chalk: silentChalk,
    }),
    { message: 'resume failed' }
  );

  // Status should still be restored to 'reviewing' via finally block
  assert.deepEqual(statusUpdates, ['implementing', 'reviewing']);
});
