import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkWorktreeHealth, enrichWithStats } from '../lib/dispatch-stats.js';

let TEST_DIR;

function setupTestEnv() {
  TEST_DIR = join(tmpdir(), `rally-stats-test-${process.pid}-${Date.now()}`);
  mkdirSync(TEST_DIR, { recursive: true });
}

function teardownTestEnv() {
  if (TEST_DIR) {
    rmSync(TEST_DIR, { recursive: true, force: true });
    TEST_DIR = null;
  }
}

describe('checkWorktreeHealth', () => {
  beforeEach(() => {
    setupTestEnv();
  });

  afterEach(() => {
    teardownTestEnv();
  });

  test('marks dispatch as healthy when worktreePath exists', () => {
    const worktreePath = join(TEST_DIR, 'worktree');
    mkdirSync(worktreePath, { recursive: true });
    
    const dispatches = [{ id: 'd1', worktreePath }];
    const result = checkWorktreeHealth(dispatches);
    
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].healthy, true);
    assert.strictEqual(result[0].id, 'd1');
  });

  test('marks dispatch as unhealthy when worktreePath does not exist', () => {
    const dispatches = [{ id: 'd1', worktreePath: '/nonexistent/path' }];
    const result = checkWorktreeHealth(dispatches);
    
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].healthy, false);
  });

  test('marks dispatch as unhealthy when worktreePath is missing', () => {
    const dispatches = [{ id: 'd1' }];
    const result = checkWorktreeHealth(dispatches);
    
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].healthy, false);
  });

  test('handles multiple dispatches with mixed health status', () => {
    const healthyPath = join(TEST_DIR, 'healthy');
    mkdirSync(healthyPath, { recursive: true });
    
    const dispatches = [
      { id: 'd1', worktreePath: healthyPath },
      { id: 'd2', worktreePath: '/nonexistent' },
      { id: 'd3' },
    ];
    const result = checkWorktreeHealth(dispatches);
    
    assert.strictEqual(result.length, 3);
    assert.strictEqual(result[0].healthy, true);
    assert.strictEqual(result[1].healthy, false);
    assert.strictEqual(result[2].healthy, false);
  });

  test('preserves all original dispatch properties', () => {
    const dispatches = [
      { 
        id: 'd1', 
        repo: 'owner/repo', 
        branch: 'main', 
        status: 'implementing',
        worktreePath: '/some/path' 
      }
    ];
    const result = checkWorktreeHealth(dispatches);
    
    assert.strictEqual(result[0].id, 'd1');
    assert.strictEqual(result[0].repo, 'owner/repo');
    assert.strictEqual(result[0].branch, 'main');
    assert.strictEqual(result[0].status, 'implementing');
  });

  test('returns empty array for empty input', () => {
    const result = checkWorktreeHealth([]);
    assert.strictEqual(result.length, 0);
  });
});

describe('enrichWithStats', () => {
  beforeEach(() => {
    setupTestEnv();
  });

  afterEach(() => {
    teardownTestEnv();
  });

  test('enrichDispatch enriches dispatch with stats from log file for done status', () => {
    const logPath = join(TEST_DIR, 'dispatch.log');
    writeFileSync(logPath, 'Total code changes:     +42 -7\n', 'utf8');
    
    const dispatches = [{ id: 'd1', status: 'done', logPath }];
    const result = enrichWithStats(dispatches);
    
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].changes, '+42 -7');
  });

  test('enrichDispatch enriches dispatch with stats for reviewing status', () => {
    const logPath = join(TEST_DIR, 'dispatch.log');
    writeFileSync(logPath, 'Total code changes:     +100 -50\n', 'utf8');
    
    const dispatches = [{ id: 'd1', status: 'reviewing', logPath }];
    const result = enrichWithStats(dispatches);
    
    assert.strictEqual(result[0].changes, '+100 -50');
  });

  test('enrichDispatch enriches dispatch with stats for cleaned status', () => {
    const logPath = join(TEST_DIR, 'dispatch.log');
    writeFileSync(logPath, 'Total code changes:     +20 -10\n', 'utf8');
    
    const dispatches = [{ id: 'd1', status: 'cleaned', logPath }];
    const result = enrichWithStats(dispatches);
    
    assert.strictEqual(result[0].changes, '+20 -10');
  });

  test('does not enrich dispatch with non-terminal status', () => {
    const logPath = join(TEST_DIR, 'dispatch.log');
    writeFileSync(logPath, 'Total code changes:     +42 -7\n', 'utf8');
    
    const dispatches = [{ id: 'd1', status: 'implementing', logPath }];
    const result = enrichWithStats(dispatches);
    
    assert.strictEqual(result[0].changes, undefined);
  });

  test('does not enrich when logPath is missing', () => {
    const dispatches = [{ id: 'd1', status: 'done' }];
    const result = enrichWithStats(dispatches);
    
    assert.strictEqual(result[0].changes, undefined);
  });

  test('does not enrich when log file does not exist', () => {
    const dispatches = [{ id: 'd1', status: 'done', logPath: '/nonexistent/log.txt' }];
    const result = enrichWithStats(dispatches);
    
    assert.strictEqual(result[0].changes, undefined);
  });

  test('handles log file read errors gracefully', () => {
    const dispatches = [{ id: 'd1', status: 'done', logPath: '/nonexistent/log.txt' }];
    const result = enrichWithStats(dispatches);
    
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].changes, undefined);
  });

  test('handles log files without stats gracefully', () => {
    const logPath = join(TEST_DIR, 'dispatch.log');
    writeFileSync(logPath, 'No stats here\n', 'utf8');
    
    const dispatches = [{ id: 'd1', status: 'done', logPath }];
    const result = enrichWithStats(dispatches);
    
    assert.strictEqual(result[0].changes, null);
  });

  test('accepts injectable readFile function for testing', () => {
    const logPath = join(TEST_DIR, 'injectable.log');
    writeFileSync(logPath, 'placeholder\n', 'utf8');
    const mockReadFile = () => 'Total code changes:     +99 -11\n';
    const dispatches = [{ id: 'd1', status: 'done', logPath }];
    
    const result = enrichWithStats(dispatches, mockReadFile);
    
    assert.strictEqual(result[0].changes, '+99 -11');
  });

  test('preserves all original dispatch properties', () => {
    const logPath = join(TEST_DIR, 'dispatch.log');
    writeFileSync(logPath, 'Total code changes:     +5 -3\n', 'utf8');
    
    const dispatches = [
      { 
        id: 'd1', 
        repo: 'owner/repo', 
        branch: 'main', 
        status: 'done',
        logPath,
        session_id: 'abc123'
      }
    ];
    const result = enrichWithStats(dispatches);
    
    assert.strictEqual(result[0].id, 'd1');
    assert.strictEqual(result[0].repo, 'owner/repo');
    assert.strictEqual(result[0].branch, 'main');
    assert.strictEqual(result[0].status, 'done');
    assert.strictEqual(result[0].session_id, 'abc123');
    assert.strictEqual(result[0].changes, '+5 -3');
  });

  test('handles multiple dispatches correctly', () => {
    const logPath1 = join(TEST_DIR, 'log1.txt');
    const logPath2 = join(TEST_DIR, 'log2.txt');
    writeFileSync(logPath1, 'Total code changes:     +10 -5\n', 'utf8');
    writeFileSync(logPath2, 'Total code changes:     +20 -15\n', 'utf8');
    
    const dispatches = [
      { id: 'd1', status: 'done', logPath: logPath1 },
      { id: 'd2', status: 'implementing', logPath: logPath2 },
      { id: 'd3', status: 'reviewing', logPath: logPath2 },
    ];
    const result = enrichWithStats(dispatches);
    
    assert.strictEqual(result[0].changes, '+10 -5');
    assert.strictEqual(result[1].changes, undefined);
    assert.strictEqual(result[2].changes, '+20 -15');
  });

  test('returns empty array for empty input', () => {
    const result = enrichWithStats([]);
    assert.strictEqual(result.length, 0);
  });
});
