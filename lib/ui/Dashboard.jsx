import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { existsSync } from 'node:fs';
import { getActiveDispatches } from '../active.js';
import DispatchTable from './components/DispatchTable.jsx';
import { formatAge } from './components/DispatchTable.jsx';

/**
 * Check worktree health by verifying paths exist on disk.
 */
function checkWorktreeHealth(dispatches) {
  return dispatches.map(d => ({
    ...d,
    healthy: d.worktreePath ? existsSync(d.worktreePath) : false,
  }));
}

/**
 * Compute summary counts from dispatches.
 */
export function computeSummary(dispatches) {
  let active = 0;
  let done = 0;
  let blocked = 0;

  for (const d of dispatches) {
    if (d.status === 'done' || d.status === 'cleaned') {
      done++;
    } else if (!d.healthy) {
      blocked++;
    } else {
      active++;
    }
  }

  return { active, done, blocked };
}

/**
 * Load and process dashboard data.
 */
export function getDashboardData({ project } = {}) {
  const raw = getActiveDispatches();
  let dispatches = checkWorktreeHealth(raw);

  if (project) {
    dispatches = dispatches.filter(d => d.repo && d.repo.includes(project));
  }

  const summary = computeSummary(dispatches);
  return { dispatches, summary };
}

/**
 * Summary line component.
 */
function SummaryLine({ summary }) {
  return (
    <Box marginTop={1}>
      <Text>
        <Text bold color="green">{summary.active} active</Text>
        <Text> · </Text>
        <Text bold color="blue">{summary.done} done</Text>
        <Text> · </Text>
        <Text bold color="red">{summary.blocked} blocked</Text>
      </Text>
    </Box>
  );
}

/**
 * Render a plain text dashboard (no ANSI escape codes) for non-TTY environments.
 */
export function renderPlainDashboard({ project } = {}) {
  const { dispatches, summary } = getDashboardData({ project });
  
  const lines = [];
  lines.push('Rally Dashboard');
  lines.push('');
  
  // Table headers
  const colWidths = { project: 20, issueRef: 12, branch: 28, status: 16, age: 6 };
  const header = [
    'Project'.padEnd(colWidths.project),
    'Issue/PR'.padEnd(colWidths.issueRef),
    'Branch'.padEnd(colWidths.branch),
    'Status'.padEnd(colWidths.status),
    'Age'.padEnd(colWidths.age),
  ].join(' ');
  lines.push(header);
  
  if (dispatches.length === 0) {
    lines.push('No active dispatches');
  } else {
    for (const d of dispatches) {
      const issueRef = d.type === 'pr' ? `PR #${d.number}` : `Issue #${d.number}`;
      const age = formatAge(d.created ?? d.created_at);
      const row = [
        (d.repo ?? '').padEnd(colWidths.project),
        issueRef.padEnd(colWidths.issueRef),
        (d.branch ?? '').padEnd(colWidths.branch),
        (d.status ?? '').padEnd(colWidths.status),
        age.padEnd(colWidths.age),
      ].join(' ');
      lines.push(row);
    }
  }
  
  lines.push('');
  lines.push(`${summary.active} active · ${summary.done} done · ${summary.blocked} blocked`);
  
  return lines.join('\n');
}

/**
 * Main Dashboard component — full-screen Ink app.
 * Supports keyboard navigation: ↑/↓ to select, Enter to print path, r to refresh, q to quit.
 * Auto-refreshes at the configured interval (default 5s).
 */
export default function Dashboard({ project, onSelect, refreshInterval = 5000 }) {
  const { exit } = useApp();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  let data;
  let error;

  try {
    data = getDashboardData({ project });
  } catch (err) {
    error = err.message;
  }

  const count = data ? data.dispatches.length : 0;

  // Auto-refresh at the configured interval
  useEffect(() => {
    if (!refreshInterval) return;
    const timer = setInterval(() => {
      setRefreshKey(k => k + 1);
    }, refreshInterval);
    return () => clearInterval(timer);
  }, [refreshInterval]);

  // Clamp selectedIndex when dispatch count changes
  useEffect(() => {
    if (count > 0 && selectedIndex >= count) {
      setSelectedIndex(count - 1);
    }
  }, [count, selectedIndex]);

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex(i => (i > 0 ? i - 1 : 0));
    } else if (key.downArrow) {
      setSelectedIndex(i => (i < count - 1 ? i + 1 : i));
    } else if (key.return && count > 0) {
      const selected = data.dispatches[selectedIndex];
      if (onSelect) {
        onSelect(selected.worktreePath ?? '');
      }
      exit();
    } else if (input === 'r') {
      setRefreshKey(k => k + 1);
    } else if (input === 'q') {
      exit();
    }
  });

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">✗ {error}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>Rally Dashboard</Text>
      </Box>
      <DispatchTable dispatches={data.dispatches} selectedIndex={selectedIndex} />
      <SummaryLine summary={data.summary} />
      <Box marginTop={1}>
        <Text dimColor>↑/↓ navigate · Enter select · r refresh · q quit</Text>
      </Box>
    </Box>
  );
}
