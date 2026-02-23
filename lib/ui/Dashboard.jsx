import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { spawn as defaultSpawn } from 'node:child_process';
import DispatchTable from './components/DispatchTable.jsx';
import { computeSummary, getDashboardData, renderPlainDashboard } from './dashboard-data.js';

export { computeSummary, getDashboardData, renderPlainDashboard };

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
        <Text bold color="red">{summary.orphaned} orphaned</Text>
      </Text>
    </Box>
  );
}

/**
 * Main Dashboard component — full-screen Ink app.
 * Supports keyboard navigation: ↑/↓ to select, Enter to select/open, r to refresh, q to quit.
 * Auto-refreshes at the configured interval (default 5s).
 */
export default function Dashboard({ project, onSelect, refreshInterval = 5000, _spawn = defaultSpawn }) {
  const { exit } = useApp();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0); // eslint-disable-line -- state setter triggers re-render to refresh data

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
      const worktreePath = selected.worktreePath ?? '';
      if (onSelect) {
        onSelect(worktreePath);
      } else if (worktreePath) {
        const child = _spawn('code', [worktreePath], { detached: true, stdio: 'ignore' });
        child.unref();
        child.on('error', (err) => {
          console.error(`Failed to launch VS Code: ${err.message}`);
        });
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
