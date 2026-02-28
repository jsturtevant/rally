import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render } from 'ink-testing-library';
import DetailView from '../../lib/ui/components/DetailView.js';

let lastInstance;
afterEach(() => {
  if (lastInstance) {
    lastInstance.unmount();
    lastInstance.cleanup();
  }
});

const SAMPLE_DISPATCH = {
  repo: 'owner/repo-a',
  type: 'issue',
  number: 42,
  branch: 'rally/42-fix-bug',
  status: 'implementing',
  worktreePath: '/home/user/projects/repo-a',
  session_id: 'abc123',
  changes: '3 files',
  created: new Date(Date.now() - 3600000).toISOString(),
  logPath: '/tmp/test.log',
};

const delay = () => new Promise(r => setImmediate(r));

describe('DetailView', () => {
  it('renders detail header with issue ref', () => {
    lastInstance = render(
      React.createElement(DetailView, { dispatch: SAMPLE_DISPATCH, onBack: () => {} })
    );
    const output = lastInstance.lastFrame();
    assert.ok(output.includes('Details for'), 'should show detail title');
    assert.ok(output.includes('Issue #42'), 'should show issue ref');
    assert.ok(output.includes('owner/repo-a'), 'should show repo name');
  });

  it('renders PR ref for PR type', () => {
    const prDispatch = { ...SAMPLE_DISPATCH, type: 'pr', number: 7 };
    lastInstance = render(
      React.createElement(DetailView, { dispatch: prDispatch, onBack: () => {} })
    );
    assert.ok(lastInstance.lastFrame().includes('PR #7'), 'should show PR ref');
  });

  it('displays branch, worktree, and session_id fields', () => {
    lastInstance = render(
      React.createElement(DetailView, { dispatch: SAMPLE_DISPATCH, onBack: () => {} })
    );
    const output = lastInstance.lastFrame();
    assert.ok(output.includes('rally/42-fix-bug'), 'should show branch');
    assert.ok(output.includes('/home/user/projects/repo-a'), 'should show worktree path');
    assert.ok(output.includes('abc123'), 'should show session ID');
  });

  it('displays status and changes fields', () => {
    lastInstance = render(
      React.createElement(DetailView, { dispatch: SAMPLE_DISPATCH, onBack: () => {} })
    );
    const output = lastInstance.lastFrame();
    assert.ok(output.includes('implementing'), 'should show status');
    assert.ok(output.includes('3 files'), 'should show changes');
  });

  it('shows escape hint', () => {
    lastInstance = render(
      React.createElement(DetailView, { dispatch: SAMPLE_DISPATCH, onBack: () => {} })
    );
    assert.ok(lastInstance.lastFrame().includes('Esc back'), 'should show escape hint');
  });

  it('calls onBack when Escape is pressed', async () => {
    let backCalled = false;
    lastInstance = render(
      React.createElement(DetailView, { dispatch: SAMPLE_DISPATCH, onBack: () => { backCalled = true; } })
    );
    await delay();
    lastInstance.stdin.write('\x1B');
    await delay();
    assert.ok(backCalled, 'should call onBack on Escape');
  });

  it('shows dash for missing optional fields', () => {
    const minimalDispatch = {
      repo: 'owner/repo',
      type: 'issue',
      number: 1,
      status: 'implementing',
    };
    lastInstance = render(
      React.createElement(DetailView, { dispatch: minimalDispatch, onBack: () => {} })
    );
    const output = lastInstance.lastFrame();
    assert.ok(output.includes('—'), 'should show dash for missing fields');
  });
});
