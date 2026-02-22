import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import yaml from 'js-yaml';
import { renderPlainDashboard } from '../../lib/ui/Dashboard.jsx';

let TEST_DIR;
let WORKTREE_DIR;
let originalRallyHome;

function setupWithDispatches() {
  originalRallyHome = process.env.RALLY_HOME;
  TEST_DIR = join(tmpdir(), `rally-nontty-test-${process.pid}-${Date.now()}`);
  WORKTREE_DIR = join(TEST_DIR, 'worktree-check');
  mkdirSync(WORKTREE_DIR, { recursive: true });
  const dispatches = [
    {
      id: 'd1',
      repo: 'owner/repo-a',
      type: 'issue',
      number: 42,
      branch: 'rally/42-fix-bug',
      status: 'implementing',
      worktreePath: WORKTREE_DIR,
      session_id: 'abc123',
      created: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'd2',
      repo: 'owner/repo-b',
      type: 'pr',
      number: 7,
      branch: 'rally/7-review',
      status: 'done',
      worktreePath: '/nonexistent/path',
      session_id: 'def456',
      created: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
  ];
  writeFileSync(join(TEST_DIR, 'active.yaml'), yaml.dump({ dispatches }), 'utf8');
  process.env.RALLY_HOME = TEST_DIR;
}

function teardownTestEnv() {
  if (originalRallyHome !== undefined) {
    process.env.RALLY_HOME = originalRallyHome;
  } else {
    delete process.env.RALLY_HOME;
  }
  if (TEST_DIR) {
    rmSync(TEST_DIR, { recursive: true, force: true });
    TEST_DIR = null;
    WORKTREE_DIR = null;
  }
}

describe('renderPlainDashboard (non-TTY)', () => {
  beforeEach(() => {
    setupWithDispatches();
  });

  afterEach(() => {
    teardownTestEnv();
  });

  it('outputs plain text with no ANSI escape codes', () => {
    const output = renderPlainDashboard();
    assert.ok(!output.includes('\x1B['), 'should not contain ANSI escape codes');
  });

  it('includes dashboard title', () => {
    const output = renderPlainDashboard();
    assert.ok(output.includes('Rally Dashboard'), 'should include title');
  });

  it('includes table headers', () => {
    const output = renderPlainDashboard();
    assert.ok(output.includes('Project'), 'should include Project header');
    assert.ok(output.includes('Issue/PR'), 'should include Issue/PR header');
    assert.ok(output.includes('Branch'), 'should include Branch header');
    assert.ok(output.includes('Status'), 'should include Status header');
    assert.ok(output.includes('Age'), 'should include Age header');
  });

  it('includes dispatch data', () => {
    const output = renderPlainDashboard();
    assert.ok(output.includes('owner/repo-a'), 'should include repo name');
    assert.ok(output.includes('Issue #42'), 'should include issue ref');
    assert.ok(output.includes('PR #7'), 'should include PR ref');
    assert.ok(output.includes('rally/42-fix-bug'), 'should include branch');
  });

  it('includes summary line with counts', () => {
    const output = renderPlainDashboard();
    assert.ok(output.includes('1 active'), 'should show active count');
    assert.ok(output.includes('1 done'), 'should show done count');
    assert.ok(output.includes('blocked'), 'should show blocked label');
  });

  it('filters by project', () => {
    const output = renderPlainDashboard({ project: 'repo-b' });
    assert.ok(output.includes('owner/repo-b'), 'should include filtered repo');
    assert.ok(!output.includes('owner/repo-a'), 'should exclude other repos');
  });

  it('shows empty state when no dispatches', () => {
    writeFileSync(join(TEST_DIR, 'active.yaml'), yaml.dump({ dispatches: [] }), 'utf8');
    const output = renderPlainDashboard();
    assert.ok(output.includes('No active dispatches'), 'should show empty state');
    assert.ok(output.includes('0 active'), 'should show zero counts');
  });
});
