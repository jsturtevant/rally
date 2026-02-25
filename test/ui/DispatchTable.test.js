import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render } from 'ink-testing-library';
import DispatchTable, { STATUS_ICONS, computeColumns } from '../../lib/ui/components/DispatchTable.js';
import { formatAge } from '../../lib/ui/dashboard-data.js';

let lastCleanup;
afterEach(() => { if (lastCleanup) lastCleanup(); });

const SAMPLE_DISPATCHES = [
  {
    repo: 'owner/repo-a',
    type: 'issue',
    number: 42,
    branch: 'rally/42-fix-bug',
    status: 'planning',
    worktreePath: '/home/user/projects/repo-a',
    session_id: 'abc123',
    created: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    repo: 'owner/repo-b',
    type: 'pr',
    number: 7,
    branch: 'rally/7-review',
    status: 'implementing',
    worktreePath: '/home/user/projects/repo-b',
    session_id: 'def456',
    created: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
];

describe('DispatchTable', () => {
  it('renders header columns', () => {
    const { lastFrame, cleanup } = render(
      React.createElement(DispatchTable, { dispatches: SAMPLE_DISPATCHES })
    );
    lastCleanup = cleanup;
    const output = lastFrame();
    assert.ok(output.includes('Issue/PR'), 'should include Issue/PR column');
    assert.ok(!output.includes('Branch'), 'should not include Branch column');
    assert.ok(!output.includes('Folder'), 'should not include Folder column');
    assert.ok(output.includes('Status'), 'should include Status column');
    assert.ok(output.includes('Age'), 'should include Age column');
  });

  it('renders project group headers', () => {
    const { lastFrame, cleanup } = render(
      React.createElement(DispatchTable, { dispatches: SAMPLE_DISPATCHES })
    );
    lastCleanup = cleanup;
    const output = lastFrame();
    assert.ok(output.includes('owner/repo-a'), 'should include first project header');
    assert.ok(output.includes('owner/repo-b'), 'should include second project header');
  });

  it('groups dispatches from same project together', () => {
    const dispatches = [
      { repo: 'owner/repo-a', type: 'issue', number: 1, status: 'planning', created: new Date().toISOString() },
      { repo: 'owner/repo-b', type: 'pr', number: 2, status: 'implementing', created: new Date().toISOString() },
      { repo: 'owner/repo-a', type: 'issue', number: 3, status: 'done', created: new Date().toISOString() },
    ];
    const { lastFrame, cleanup } = render(
      React.createElement(DispatchTable, { dispatches })
    );
    lastCleanup = cleanup;
    const output = lastFrame();
    assert.ok(output.includes('owner/repo-a'), 'should include repo-a group header');
    assert.ok(output.includes('owner/repo-b'), 'should include repo-b group header');
    assert.ok(output.includes('Issue #1'), 'should include first repo-a issue');
    assert.ok(output.includes('Issue #3'), 'should include second repo-a issue');
  });

  it('renders dispatch data rows', () => {
    const { lastFrame, cleanup } = render(
      React.createElement(DispatchTable, { dispatches: SAMPLE_DISPATCHES })
    );
    lastCleanup = cleanup;
    const output = lastFrame();
    assert.ok(output.includes('owner/repo-a'), 'should include repo name');
    assert.ok(output.includes('Issue #42'), 'should include issue ref');
    assert.ok(output.includes('PR #7'), 'should include PR ref');
    assert.ok(!output.includes('rally/42-fix-bug'), 'should not include branch');
    assert.ok(!output.includes('/home/user/projects'), 'should not include folder path');
  });

  it('renders status icons for each status', () => {
    const statuses = ['planning', 'implementing', 'reviewing', 'pushed', 'done', 'cleaned'];
    const dispatches = statuses.map((status, i) => ({
      repo: 'o/r',
      type: 'issue',
      number: i + 1,
      branch: `rally/${i + 1}-test`,
      status,
      session_id: `s${i}`,
      created: new Date().toISOString(),
    }));
    const { lastFrame, cleanup } = render(
      React.createElement(DispatchTable, { dispatches })
    );
    lastCleanup = cleanup;
    const output = lastFrame();
    for (const status of statuses) {
      assert.ok(
        output.includes(STATUS_ICONS[status]),
        `should include ${STATUS_ICONS[status]} icon for ${status}`
      );
    }
  });

  it('shows arrow indicator on selected row', () => {
    const r1 = render(
      React.createElement(DispatchTable, { dispatches: SAMPLE_DISPATCHES, selectedIndex: 0 })
    );
    const selected = r1.lastFrame();
    r1.cleanup();
    assert.ok(selected.includes('❯'), 'selected row should show arrow indicator');
    assert.ok(selected.includes('owner/repo-a'), 'selected row data should render');
  });

  it('does not show arrow when selectedIndex is -1', () => {
    const r1 = render(
      React.createElement(DispatchTable, { dispatches: SAMPLE_DISPATCHES, selectedIndex: -1 })
    );
    const noSelection = r1.lastFrame();
    r1.cleanup();
    assert.ok(!noSelection.includes('❯'), 'no arrow should appear when nothing is selected');
    const r2 = render(
      React.createElement(DispatchTable, { dispatches: SAMPLE_DISPATCHES })
    );
    const defaultRender = r2.lastFrame();
    lastCleanup = r2.cleanup;
    assert.equal(noSelection, defaultRender, 'selectedIndex -1 should match default render');
  });

  it('renders empty state when no dispatches', () => {
    const { lastFrame, cleanup } = render(
      React.createElement(DispatchTable, { dispatches: [] })
    );
    lastCleanup = cleanup;
    const output = lastFrame();
    assert.ok(output.includes('No active dispatches'), 'should show empty message');
  });

  it('renders empty state with default props', () => {
    const { lastFrame, cleanup } = render(
      React.createElement(DispatchTable)
    );
    lastCleanup = cleanup;
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

  it('returns dash for invalid date string', () => {
    assert.equal(formatAge('not-a-date'), '—');
    assert.equal(formatAge(''), '—');
  });

  it('returns 0m for future timestamps', () => {
    const future = new Date(Date.now() + 60000).toISOString();
    assert.equal(formatAge(future), '0m');
  });
});

describe('computeColumns', () => {
  it('returns four columns with computed widths', () => {
    const cols = computeColumns(120);
    const keys = cols.map(c => c.key);
    assert.deepEqual(keys, ['issueRef', 'status', 'changes', 'age']);
  });

  it('gives wider columns on wider terminals', () => {
    const narrow = computeColumns(80);
    const wide = computeColumns(160);
    const narrowIssue = narrow.find(c => c.key === 'issueRef').width;
    const wideIssue = wide.find(c => c.key === 'issueRef').width;
    assert.ok(wideIssue > narrowIssue, 'wider terminal should give more space to Issue/PR');
  });

  it('respects minimum column widths on narrow terminals', () => {
    const cols = computeColumns(20);
    for (const col of cols) {
      assert.ok(col.width >= col.minWidth, `${col.key} should not be narrower than minWidth`);
    }
  });

  it('defaults to 80 columns when no width given', () => {
    const cols = computeColumns();
    const total = cols.reduce((sum, c) => sum + c.width, 0);
    assert.ok(total > 44, 'columns should expand beyond minimums at 80 cols');
  });

  it('distributes extra space proportionally', () => {
    const cols = computeColumns(120);
    const issueRef = cols.find(c => c.key === 'issueRef').width;
    const age = cols.find(c => c.key === 'age').width;
    assert.ok(issueRef > age, 'Issue/PR should get more space than Age');
  });
});

describe('DispatchTable width prop', () => {
  it('accepts width prop and renders correctly', () => {
    const { lastFrame, cleanup } = render(
      React.createElement(DispatchTable, { dispatches: SAMPLE_DISPATCHES, width: 120 })
    );
    lastCleanup = cleanup;
    const output = lastFrame();
    assert.ok(output.includes('Issue/PR'), 'should render column headers');
    assert.ok(output.includes('owner/repo-a'), 'should render project group');
    assert.ok(output.includes('Issue #42'), 'should render dispatch data');
  });

  it('renders without width prop using defaults', () => {
    const { lastFrame, cleanup } = render(
      React.createElement(DispatchTable, { dispatches: SAMPLE_DISPATCHES })
    );
    lastCleanup = cleanup;
    const output = lastFrame();
    assert.ok(output.includes('Issue/PR'), 'should render with default width');
  });
});

describe('Status label formatting', () => {
  it('uses short review label instead of ready for review', () => {
    const dispatches = [{
      repo: 'o/r',
      type: 'issue',
      number: 1,
      branch: 'rally/1-test',
      status: 'reviewing',
      session_id: 's1',
      created: new Date().toISOString(),
    }];
    const { lastFrame, cleanup } = render(
      React.createElement(DispatchTable, { dispatches })
    );
    lastCleanup = cleanup;
    const output = lastFrame();
    assert.ok(output.includes('review'), 'should show review label');
    assert.ok(!output.includes('ready for review'), 'should not show old long label');
  });
});
