import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render } from 'ink-testing-library';
import { DispatchTable, STATUS_ICONS, formatAge } from '../../lib/ui/index.js';

const SAMPLE_DISPATCHES = [
  {
    repo: 'owner/repo-a',
    type: 'issue',
    number: 42,
    branch: 'rally/42-fix-bug',
    status: 'planning',
    session_id: 'abc123',
    created: new Date(Date.now() - 3600000).toISOString(), // 1h ago
  },
  {
    repo: 'owner/repo-b',
    type: 'pr',
    number: 7,
    branch: 'rally/7-review',
    status: 'implementing',
    session_id: 'def456',
    created: new Date(Date.now() - 86400000 * 2).toISOString(), // 2d ago
  },
];

describe('DispatchTable', () => {
  it('renders header columns', () => {
    const { lastFrame } = render(
      React.createElement(DispatchTable, { dispatches: SAMPLE_DISPATCHES })
    );
    const output = lastFrame();
    assert.ok(output.includes('Project'), 'should include Project column');
    assert.ok(output.includes('Issue/PR'), 'should include Issue/PR column');
    assert.ok(output.includes('Branch'), 'should include Branch column');
    assert.ok(output.includes('Status'), 'should include Status column');
    assert.ok(output.includes('Age'), 'should include Age column');
  });

  it('renders dispatch data rows', () => {
    const { lastFrame } = render(
      React.createElement(DispatchTable, { dispatches: SAMPLE_DISPATCHES })
    );
    const output = lastFrame();
    assert.ok(output.includes('owner/repo-a'), 'should include repo name');
    assert.ok(output.includes('Issue #42'), 'should include issue ref');
    assert.ok(output.includes('PR #7'), 'should include PR ref');
    assert.ok(output.includes('rally/42-fix-bug'), 'should include branch');
    assert.ok(output.includes('rally/7-review'), 'should include branch');
  });

  it('renders status icons for each status', () => {
    const statuses = ['planning', 'implementing', 'reviewing', 'done', 'cleaned'];
    const dispatches = statuses.map((status, i) => ({
      repo: 'o/r',
      type: 'issue',
      number: i + 1,
      branch: `rally/${i + 1}-test`,
      status,
      session_id: `s${i}`,
      created: new Date().toISOString(),
    }));
    const { lastFrame } = render(
      React.createElement(DispatchTable, { dispatches })
    );
    const output = lastFrame();
    for (const status of statuses) {
      assert.ok(
        output.includes(STATUS_ICONS[status]),
        `should include ${STATUS_ICONS[status]} icon for ${status}`
      );
    }
  });

  it('highlights selected row with inverse styling', () => {
    const { lastFrame } = render(
      React.createElement(DispatchTable, { dispatches: SAMPLE_DISPATCHES, selectedIndex: 0 })
    );
    const output = lastFrame();
    // Ink inverse styling produces ANSI escape codes — selected row text should be present
    assert.ok(output.includes('owner/repo-a'), 'selected row data should render');
    // The selected row should have inverse ANSI codes (ESC[7m)
    assert.ok(output.includes('\x1B[7m'), 'selected row should have inverse ANSI escape');
  });

  it('does not highlight when selectedIndex is -1', () => {
    const { lastFrame } = render(
      React.createElement(DispatchTable, { dispatches: SAMPLE_DISPATCHES, selectedIndex: -1 })
    );
    const output = lastFrame();
    assert.ok(!output.includes('\x1B[7m'), 'no row should be inverse-styled');
  });

  it('renders empty state when no dispatches', () => {
    const { lastFrame } = render(
      React.createElement(DispatchTable, { dispatches: [] })
    );
    const output = lastFrame();
    assert.ok(output.includes('No active dispatches'), 'should show empty message');
  });

  it('renders empty state with default props', () => {
    const { lastFrame } = render(
      React.createElement(DispatchTable)
    );
    const output = lastFrame();
    assert.ok(output.includes('No active dispatches'), 'should show empty message');
  });
});

describe('formatAge', () => {
  it('returns minutes for recent timestamps', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
    assert.equal(formatAge(fiveMinAgo), '5m');
  });

  it('returns hours for older timestamps', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString();
    assert.equal(formatAge(twoHoursAgo), '2h');
  });

  it('returns days for very old timestamps', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
    assert.equal(formatAge(threeDaysAgo), '3d');
  });

  it('returns dash for missing timestamp', () => {
    assert.equal(formatAge(null), '—');
    assert.equal(formatAge(undefined), '—');
  });

  it('returns 0m for future timestamps', () => {
    const future = new Date(Date.now() + 60000).toISOString();
    assert.equal(formatAge(future), '0m');
  });
});
