import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { renderPlainDashboard } from '../lib/ui/dashboard-data.js';
import { withTempRallyHome } from './helpers/temp-env.js';

let TEST_DIR;
let WORKTREE_DIR;

function setupWithDispatches(t) {
  TEST_DIR = withTempRallyHome(t);
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
}

describe('renderPlainDashboard (non-TTY)', () => {
  beforeEach((t) => {
    setupWithDispatches(t);
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
    assert.ok(output.includes('owner/repo-a'), 'should include project as group header');
    assert.ok(output.includes('Issue/PR'), 'should include Issue/PR header');
    assert.ok(output.includes('Branch'), 'should include Branch header');
    assert.ok(output.includes('Folder'), 'should include Folder header');
    assert.ok(output.includes('Status'), 'should include Status header');
    assert.ok(output.includes('Age'), 'should include Age header');
  });

  it('includes dispatch data', () => {
    const output = renderPlainDashboard();
    assert.ok(output.includes('owner/repo-a'), 'should include repo name');
    assert.ok(output.includes('#42'), 'should include issue ref');
    assert.ok(output.includes('#7'), 'should include PR ref');
    assert.ok(output.includes('rally/42-fix-bug'), 'should include branch');
    assert.ok(output.includes('worktree-check'), 'should include worktree path (possibly truncated)');
  });

  it('includes formatted columns', () => {
    const output = renderPlainDashboard();
    assert.ok(output.includes('Issue/PR'), 'should show column headers');
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
  });
});
