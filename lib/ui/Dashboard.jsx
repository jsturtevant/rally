import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { spawn as defaultSpawn } from 'node:child_process';
import DispatchTable from './components/DispatchTable.jsx';
import ActionMenu, { ACTIONS } from './components/ActionMenu.jsx';
import { computeSummary, getDashboardData, renderPlainDashboard } from './dashboard-data.js';
import { dispatchLog as defaultDispatchLog } from '../dispatch-log.js';

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
 * Supports keyboard navigation: ↑/↓ to select, Enter to open action menu, r to refresh, q to quit.
 * Auto-refreshes at the configured interval (default 5s).
 */
export default function Dashboard({ project, onSelect, refreshInterval = 5000, _spawn = defaultSpawn, _dispatchLog = defaultDispatchLog }) {
  const { exit } = useApp();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0); // eslint-disable-line -- state setter triggers re-render to refresh data
  const [actionDispatch, setActionDispatch] = useState(null);
  const [actionIndex, setActionIndex] = useState(0);

  let data;
  let error;

  try {
    data = getDashboardData({ project });
  } catch (err) {
    error = err.message;
  }

  const count = data ? data.dispatches.length : 0;

  // Derive the action list once — used for both count and selection
  const actions = actionDispatch
    ? [
        ACTIONS.OPEN_VSCODE,
        ...(actionDispatch.logPath ? [ACTIONS.VIEW_LOGS] : []),
        ACTIONS.BACK,
      ]
    : [];
  const actionCount = actions.length;

  // Auto-refresh at the configured interval (pause during action menu)
  useEffect(() => {
    if (!refreshInterval || actionDispatch) return;
    const timer = setInterval(() => {
      setRefreshKey(k => k + 1);
    }, refreshInterval);
    return () => clearInterval(timer);
  }, [refreshInterval, actionDispatch]);

  // Clamp selectedIndex when dispatch count changes
  useEffect(() => {
    if (count > 0 && selectedIndex >= count) {
      setSelectedIndex(count - 1);
    }
  }, [count, selectedIndex]);

  function openInVSCode(dispatch) {
    const worktreePath = dispatch.worktreePath ?? '';
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
  }

  function viewLogs(dispatch) {
    exit();
    _dispatchLog(dispatch.number, { repo: dispatch.repo }).catch((err) => {
      console.error(`Failed to view logs: ${err.message}`);
    });
  }

  function handleActionSelect(direction) {
    if (direction === 'up') {
      setActionIndex(i => (i > 0 ? i - 1 : 0));
    } else if (direction === 'down') {
      setActionIndex(i => (i < actionCount - 1 ? i + 1 : i));
    } else if (direction === ACTIONS.OPEN_VSCODE) {
      openInVSCode(actionDispatch);
    } else if (direction === ACTIONS.VIEW_LOGS) {
      viewLogs(actionDispatch);
    } else if (direction === 'confirm') {
      const selectedAction = actions[actionIndex];
      if (selectedAction === ACTIONS.OPEN_VSCODE) {
        openInVSCode(actionDispatch);
      } else if (selectedAction === ACTIONS.VIEW_LOGS) {
        viewLogs(actionDispatch);
      } else {
        setActionDispatch(null);
        setActionIndex(0);
      }
    }
  }

  function handleActionBack() {
    setActionDispatch(null);
    setActionIndex(0);
  }

  useInput((input, key) => {
    // When action menu is open, it handles its own input
    if (actionDispatch) return;

    if (key.upArrow) {
      setSelectedIndex(i => (i > 0 ? i - 1 : 0));
    } else if (key.downArrow) {
      setSelectedIndex(i => (i < count - 1 ? i + 1 : i));
    } else if (key.return && count > 0) {
      const selected = data.dispatches[selectedIndex];
      setActionDispatch(selected);
      setActionIndex(0);
    } else if (input === 'v' && count > 0) {
      openInVSCode(data.dispatches[selectedIndex]);
    } else if (input === 'l' && count > 0) {
      const selected = data.dispatches[selectedIndex];
      if (selected.logPath) {
        viewLogs(selected);
      }
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

  if (actionDispatch) {
    return (
      <ActionMenu
        dispatch={actionDispatch}
        selectedAction={actionIndex}
        onSelect={handleActionSelect}
        onBack={handleActionBack}
      />
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
        <Text dimColor>↑/↓ navigate · Enter actions · v open · l logs · r refresh · q quit</Text>
      </Box>
    </Box>
  );
}
