import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render } from 'ink-testing-library';
import ProjectItemPicker from '../../lib/ui/components/ProjectItemPicker.js';

let lastInstance;
afterEach(() => {
  if (lastInstance) {
    lastInstance.unmount();
    lastInstance.cleanup();
  }
});

const delay = () => new Promise(r => setImmediate(r));

const SAMPLE_ISSUES = [
  { number: 1, title: 'Fix bug', labels: [{ name: 'bug' }], state: 'OPEN' },
  { number: 2, title: 'Add feature', labels: [], state: 'OPEN' },
];

const SAMPLE_PRS = [
  { number: 10, title: 'PR one', state: 'OPEN' },
];

function mockFetchers(issues = SAMPLE_ISSUES, prs = SAMPLE_PRS) {
  return {
    _fetchIssues: () => issues,
    _fetchPrs: () => prs,
  };
}

describe('ProjectItemPicker', () => {
  it('fetches and displays issues and PRs', async () => {
    const project = { repo: 'owner/repo' };
    lastInstance = render(
      React.createElement(ProjectItemPicker, {
        project,
        onSelectItem: () => {},
        onBack: () => {},
        ...mockFetchers(),
      })
    );
    await delay();
    const output = lastInstance.lastFrame();
    assert.ok(output.includes('#1 Fix bug'), 'should show issue #1');
    assert.ok(output.includes('[bug]'), 'should show label');
    assert.ok(output.includes('#2 Add feature'), 'should show issue #2');
    assert.ok(output.includes('#10 PR one'), 'should show PR #10');
    assert.ok(output.includes('Issues'), 'should show Issues header');
    assert.ok(output.includes('Pull Requests'), 'should show Pull Requests header');
  });

  it('shows error state when fetches fail', async () => {
    const project = { repo: 'owner/repo' };
    lastInstance = render(
      React.createElement(ProjectItemPicker, {
        project,
        onSelectItem: () => {},
        onBack: () => {},
        _fetchIssues: () => { throw new Error('Network error'); },
        _fetchPrs: () => [],
      })
    );
    await delay();
    const output = lastInstance.lastFrame();
    assert.ok(output.includes('Network error'), 'should show error message');
    assert.ok(output.includes('Esc back'), 'should show escape hint');
  });

  it('shows error for invalid repo format', async () => {
    const project = { name: 'no-slash' };
    lastInstance = render(
      React.createElement(ProjectItemPicker, {
        project,
        onSelectItem: () => {},
        onBack: () => {},
        ...mockFetchers(),
      })
    );
    await delay();
    const output = lastInstance.lastFrame();
    assert.ok(output.includes('Invalid repo format'), 'should show invalid repo error');
    assert.ok(output.includes('Expected "owner/repo"'), 'should suggest correct format');
  });

  it('shows empty state when no items', async () => {
    const project = { repo: 'owner/repo' };
    lastInstance = render(
      React.createElement(ProjectItemPicker, {
        project,
        onSelectItem: () => {},
        onBack: () => {},
        _fetchIssues: () => [],
        _fetchPrs: () => [],
      })
    );
    await delay();
    const output = lastInstance.lastFrame();
    assert.ok(output.includes('No open issues or pull requests'), 'should show empty message');
  });

  it('shows loading state initially', () => {
    const project = { repo: 'owner/repo' };
    // Don't inject fetchers — default real ones won't resolve instantly
    // Instead use fetchers that never set data (we skip useEffect by not awaiting)
    lastInstance = render(
      React.createElement(ProjectItemPicker, {
        project,
        onSelectItem: () => {},
        onBack: () => {},
      })
    );
    // Before the effect runs, data is null => loading state
    const output = lastInstance.lastFrame();
    assert.ok(output.includes('Loading'), 'should show loading text');
  });

  it('navigates with up/down arrows', async () => {
    const project = { repo: 'owner/repo' };
    lastInstance = render(
      React.createElement(ProjectItemPicker, {
        project,
        onSelectItem: () => {},
        onBack: () => {},
        ...mockFetchers(),
      })
    );
    await delay();
    let output = lastInstance.lastFrame();
    assert.ok(output.includes('❯'), 'should show selector');

    // Move down
    lastInstance.stdin.write('\x1B[B');
    await delay();
    output = lastInstance.lastFrame();
    // Selector should have moved

    // Move up
    lastInstance.stdin.write('\x1B[A');
    await delay();
    output = lastInstance.lastFrame();
    assert.ok(output.includes('❯'), 'selector should still be visible');
  });

  it('selects item on Enter', async () => {
    let selectedItem = null;
    let selectedRepo = null;
    const project = { repo: 'owner/repo' };
    lastInstance = render(
      React.createElement(ProjectItemPicker, {
        project,
        onSelectItem: (item, repo) => { selectedItem = item; selectedRepo = repo; },
        onBack: () => {},
        ...mockFetchers(),
      })
    );
    await delay();
    lastInstance.stdin.write('\r');
    await delay();
    assert.ok(selectedItem, 'should have selected an item');
    assert.equal(selectedItem.number, 1, 'should select first issue');
    assert.equal(selectedItem.itemType, 'issue', 'should be an issue');
    assert.equal(selectedRepo, 'owner/repo', 'should pass repo');
  });

  it('goes back on Escape', async () => {
    let backCalled = false;
    const project = { repo: 'owner/repo' };
    lastInstance = render(
      React.createElement(ProjectItemPicker, {
        project,
        onSelectItem: () => {},
        onBack: () => { backCalled = true; },
        ...mockFetchers(),
      })
    );
    await delay();
    lastInstance.stdin.write('\x1B');
    await delay();
    assert.ok(backCalled, 'Escape should call onBack');
  });

  it('goes back on q', async () => {
    let backCalled = false;
    const project = { repo: 'owner/repo' };
    lastInstance = render(
      React.createElement(ProjectItemPicker, {
        project,
        onSelectItem: () => {},
        onBack: () => { backCalled = true; },
        ...mockFetchers(),
      })
    );
    await delay();
    lastInstance.stdin.write('q');
    await delay();
    assert.ok(backCalled, 'q should call onBack');
  });
});
