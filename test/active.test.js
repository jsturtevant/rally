import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  addDispatch,
  updateDispatchStatus,
  removeDispatch,
  getActiveDispatches,
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

let originalEnv;
let tempDir;

beforeEach(() => {
  originalEnv = process.env.RALLY_HOME;
  tempDir = mkdtempSync(join(tmpdir(), 'rally-active-test-'));
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
  assert.deepEqual(VALID_STATUSES, ['planning', 'implementing', 'reviewing', 'done', 'cleaned']);
});
