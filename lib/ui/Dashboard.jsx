import React from 'react';
import { Box, Text } from 'ink';
import { existsSync } from 'node:fs';
import { getActiveDispatches } from '../active.js';
import DispatchTable from './components/DispatchTable.jsx';

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
 * Main Dashboard component — full-screen Ink app.
 * Loads data synchronously on render since getActiveDispatches is sync.
 */
export default function Dashboard({ project }) {
  let data;
  let error;

  try {
    data = getDashboardData({ project });
  } catch (err) {
    error = err.message;
  }

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
      <DispatchTable dispatches={data.dispatches} />
      <SummaryLine summary={data.summary} />
    </Box>
  );
}
