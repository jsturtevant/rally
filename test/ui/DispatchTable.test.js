import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render } from 'ink-testing-library';
import DispatchTable, { STATUS_ICONS } from '../../lib/ui/components/DispatchTable.js';
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
    created: new Date(Date.now() - 3600000).toISOString(), // 1h ago
  },
  {
    repo: 'owner/repo-b',
    type: 'pr',
    number: 7,
    branch: 'rally/7-review',
    status: 'implementing',
    worktreePath: '/home/user/projects/repo-b',
    session_id: 'def456',
    created: new Date(Date.now() - 86400000 * 2).toISOString(), // 2d ago
  },
];

describe('DispatchTable', () => {
  it('renders header columns', () => {
    const { lastFrame, cleanup } = render(
      React.createElement(DispatchTable, { dispatches: SAMPLE_DISPATCHES })
    );
    lastCleanup = cleanup;
    const output = lastFrame();
    assert.ok(output.includes('Project'), 'should include Project column');
    assert.ok(output.includes('Issue/PR'), 'should include Issue/PR column');
    assert.ok(!output.includes('Branch'), 'should not include Branch column');
    assert.ok(!output.includes('Folder'), 'should not include Folder column');
    assert.ok(output.includes('Status'), 'should include Status column');
    assert.ok(output.includes('Age'), 'should include Age column');
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

import { computeColumns } from "../../lib/ui/components/DispatchTable.js";

describe("computeColumns", () => {
  it("returns all five columns", () => {
    const cols = computeColumns(120);
    assert.deepEqual(cols.map(c => c.key), ["project", "issueRef", "status", "changes", "age"]);
  });
  it("gives Project more space on wider terminals", () => {
    const n = computeColumns(80).find(c => c.key === "project").width;
    const w = computeColumns(160).find(c => c.key === "project").width;
    assert.ok(w > n);
  });
  it("enforces minimum Project width", () => {
    assert.ok(computeColumns(20).find(c => c.key === "project").width >= 18);
  });
  it("defaults to 80 columns", () => {
    assert.equal(computeColumns().find(c => c.key === "project").width, 34);
  });
  it("Project gets the most space", () => {
    const cols = computeColumns(100);
    const p = cols.find(c => c.key === "project").width;
    cols.filter(c => c.key !== "project").forEach(c => assert.ok(p > c.width));
  });
});

describe("DispatchTable width prop", () => {
  it("accepts width prop", () => {
    const { lastFrame, cleanup } = render(
      React.createElement(DispatchTable, { dispatches: SAMPLE_DISPATCHES, width: 120 })
    );
    lastCleanup = cleanup;
    assert.ok(lastFrame().includes("Project"));
    assert.ok(lastFrame().includes("owner/repo-a"));
  });
  it("renders with defaults", () => {
    const { lastFrame, cleanup } = render(
      React.createElement(DispatchTable, { dispatches: SAMPLE_DISPATCHES })
    );
    lastCleanup = cleanup;
    assert.ok(lastFrame().includes("Project"));
  });
});

describe("Status label", () => {
  it("uses review not ready for review", () => {
    const d = [{ repo: "o/r", type: "issue", number: 1, status: "reviewing", created: new Date().toISOString() }];
    const { lastFrame, cleanup } = render(React.createElement(DispatchTable, { dispatches: d }));
    lastCleanup = cleanup;
    assert.ok(lastFrame().includes("review"));
    assert.ok(!lastFrame().includes("ready for review"));
  });
});
