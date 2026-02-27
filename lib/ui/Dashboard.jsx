import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Box, Text, useInput, useApp, useStdout } from 'ink';
import { spawn as defaultSpawn } from 'node:child_process';
import DispatchTable from './components/DispatchTable.jsx';
import ActionMenu, { ACTIONS } from './components/ActionMenu.jsx';
import LogViewer from './components/LogViewer.jsx';
import DetailView from './components/DetailView.jsx';
import ProjectBrowser from './components/ProjectBrowser.jsx';
import ProjectItemPicker from './components/ProjectItemPicker.jsx';
import TrustConfirm from './components/TrustConfirm.jsx';
import DispatchStatus from './components/DispatchStatus.jsx';
import { computeSummary, getDashboardData, renderPlainDashboard } from './dashboard-data.js';
import { dispatchRemove as defaultDispatchRemove } from '../dispatch-remove.js';
import { updateDispatchStatus as defaultUpdateDispatchStatus } from '../active.js';
import { parseSessionIdFromLog as defaultParseSessionId, UUID_RE } from '../copilot.js';

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
export default function Dashboard({ project, onSelect, onAttachSession, onDispatchItem, onDispatch, getTrustWarnings: getTrustWarningsProp, onAddProject, refreshInterval = 5000, _spawn = defaultSpawn, _dispatchRemove = defaultDispatchRemove, _parseSessionIdFromLog = defaultParseSessionId, _updateDispatchStatus = defaultUpdateDispatchStatus, _listOnboardedRepos, _fetchIssues, _fetchPrs }) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0); // eslint-disable-line -- state setter triggers re-render to refresh data
  const [actionDispatch, setActionDispatch] = useState(null);
  const [actionIndex, setActionIndex] = useState(0);
  const [logViewDispatch, setLogViewDispatch] = useState(null);
  const [detailViewDispatch, setDetailViewDispatch] = useState(null);
  const [browseMode, setBrowseMode] = useState(null); // null | 'projects' | 'items'
  const [browseProject, setBrowseProject] = useState(null);
  const [dispatchPending, setDispatchPending] = useState(null);
  const [trustWarnings, setTrustWarnings] = useState(null);
  const [dispatchStatus, setDispatchStatus] = useState(null); // null|'confirming'|'dispatching'|'done'|'error'
  const [dispatchMessage, setDispatchMessage] = useState('');

  const [data, setData] = useState(() => {
    try { return getDashboardData({ project }); } catch { return null; }
  });
  const [error, setError] = useState(null);

  // Refresh data only when refreshKey changes — compare JSON to avoid unnecessary re-renders
  const prevJsonRef = useRef('');
  useEffect(() => {
    try {
      const fresh = getDashboardData({ project });
      const json = JSON.stringify(fresh);
      if (json !== prevJsonRef.current) {
        prevJsonRef.current = json;
        setData(fresh);
        setError(null);
      }
    } catch (err) {
      setError(err.message);
    }
  }, [refreshKey, project]);

  const count = data ? data.dispatches.length : 0;

  // A session ID is connectable if it looks like a UUID (not a PID or 'pending')
  const hasConnectableSession = actionDispatch?.session_id &&
    UUID_RE.test(actionDispatch.session_id);

  // Derive the action list once — used for both count and selection
  const actions = actionDispatch
    ? [
        ACTIONS.OPEN_VSCODE,
        ACTIONS.OPEN_BROWSER,
        ...(hasConnectableSession ? [ACTIONS.CONNECT_IDE] : []),
        ...(actionDispatch.worktreePath ? [ACTIONS.ATTACH_SESSION] : []),
        ...(actionDispatch.logPath ? [ACTIONS.VIEW_LOGS] : []),
        ACTIONS.BACK,
      ]
    : [];
  const actionCount = actions.length;

  // Auto-refresh at the configured interval (pause during action menu, log view, detail view, browse mode, or dispatch)
  useEffect(() => {
    if (!refreshInterval || actionDispatch || logViewDispatch || detailViewDispatch || browseMode || dispatchStatus) return;
    const timer = setInterval(() => {
      setRefreshKey(k => k + 1);
    }, refreshInterval);
    return () => clearInterval(timer);
  }, [refreshInterval, actionDispatch, logViewDispatch, detailViewDispatch, browseMode, dispatchStatus]);

  // Clamp selectedIndex when dispatch count changes
  useEffect(() => {
    if (count > 0 && selectedIndex >= count) {
      setSelectedIndex(count - 1);
    }
  }, [count, selectedIndex]);

  async function runDispatch(item) {
    setDispatchStatus('dispatching');
    try {
      const result = await onDispatch(item);
      if (result && result.aborted) {
        setDispatchMessage('Dispatch aborted.');
        setDispatchStatus('error');
      } else {
        const title = result?.pr?.title || result?.issue?.title || '';
        setDispatchMessage(`${title} → ${result?.worktreePath || ''}`);
        setDispatchStatus('done');
        setRefreshKey(k => k + 1);
      }
    } catch (err) {
      setDispatchMessage(err.message);
      setDispatchStatus('error');
    }
  }

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
  }

  function openInBrowser(dispatch) {
    const ghCmd = dispatch.type === 'pr' ? 'pr' : 'issue';
    const child = _spawn('gh', [ghCmd, 'view', String(dispatch.number), '--repo', dispatch.repo, '--web'], { detached: true, stdio: 'ignore' });
    child.unref();
    child.on('error', (err) => {
      console.error(`Failed to open in browser: ${err.message}`);
    });
  }

  function connectIDE(dispatch) {
    const worktreePath = dispatch.worktreePath ?? '';
    if (!worktreePath) return;

    // Resolve session ID — parse from log if stored value is a PID
    let sessionId = dispatch.session_id;
    if (!sessionId || sessionId === 'pending' || /^\d+$/.test(sessionId)) {
      const parsed = _parseSessionIdFromLog(dispatch.logPath);
      if (parsed) sessionId = parsed;
    }
    if (!sessionId || sessionId === 'pending') return;

    // Open VS Code at the worktree path
    const codeChild = _spawn('code', [worktreePath], { detached: true, stdio: 'ignore' });
    codeChild.unref();
    codeChild.on('error', (err) => {
      console.error(`Failed to launch VS Code: ${err.message}`);
    });

    // Bridge the session to VS Code via gh copilot --resume + /ide
    const copilotChild = _spawn('gh', [
      'copilot', '--resume', sessionId,
      '-p', '/ide',
      '--allow-all',
    ], {
      cwd: worktreePath,
      detached: true,
      stdio: 'ignore',
    });
    copilotChild.unref();
    copilotChild.on('error', (err) => {
      console.error(`Failed to launch copilot session bridge: ${err.message}`);
    });
  }

  function viewLogs(dispatch) {
    if (dispatch.logPath) {
      setLogViewDispatch(dispatch);
      setActionDispatch(null);
      setActionIndex(0);
    }
  }

  function removeSelectedDispatch(dispatch) {
    _dispatchRemove(dispatch.number, { repo: dispatch.repo })
      .then(() => setRefreshKey(k => k + 1))
      .catch((err) => {
        console.error(`Failed to remove dispatch: ${err.message}`);
      });
  }

  function markAsPushed(dispatch) {
    if (dispatch.status !== 'reviewing') return;
    try {
      _updateDispatchStatus(dispatch.id, 'pushed');
      setRefreshKey(k => k + 1);
    } catch (err) {
      console.error(`Failed to mark dispatch as pushed: ${err.message}`);
    }
  }

  function attachToSession(dispatch) {
    if (!dispatch.worktreePath) return;
    if (onAttachSession) {
      onAttachSession(dispatch);
    }
    exit();
  }

  function handleActionSelect(direction) {
    if (direction === 'up') {
      setActionIndex(i => (i > 0 ? i - 1 : 0));
    } else if (direction === 'down') {
      setActionIndex(i => (i < actionCount - 1 ? i + 1 : i));
    } else if (direction === ACTIONS.OPEN_VSCODE) {
      openInVSCode(actionDispatch);
    } else if (direction === ACTIONS.OPEN_BROWSER) {
      openInBrowser(actionDispatch);
    } else if (direction === ACTIONS.CONNECT_IDE) {
      connectIDE(actionDispatch);
    } else if (direction === ACTIONS.ATTACH_SESSION) {
      attachToSession(actionDispatch);
    } else if (direction === ACTIONS.VIEW_LOGS) {
      viewLogs(actionDispatch);
    } else if (direction === 'confirm') {
      const selectedAction = actions[actionIndex];
      if (selectedAction === ACTIONS.OPEN_VSCODE) {
        openInVSCode(actionDispatch);
      } else if (selectedAction === ACTIONS.OPEN_BROWSER) {
        openInBrowser(actionDispatch);
      } else if (selectedAction === ACTIONS.CONNECT_IDE) {
        connectIDE(actionDispatch);
      } else if (selectedAction === ACTIONS.ATTACH_SESSION) {
        attachToSession(actionDispatch);
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

  // Dispatch done/error — any key returns to dashboard
  useInput(() => {
    setDispatchPending(null);
    setDispatchStatus(null);
    setDispatchMessage('');
  }, { isActive: dispatchStatus === 'done' || dispatchStatus === 'error' });

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex(i => (i > 0 ? i - 1 : 0));
    } else if (key.downArrow) {
      setSelectedIndex(i => (i < count - 1 ? i + 1 : i));
    } else if (key.return && count > 0) {
      const selected = data.dispatches[selectedIndex];
      setActionDispatch(selected);
      setActionIndex(0);
    } else if (input === 'd' && count > 0) {
      setDetailViewDispatch(data.dispatches[selectedIndex]);
    } else if (input === 'v' && count > 0) {
      openInVSCode(data.dispatches[selectedIndex]);
    } else if (input === 'o' && count > 0) {
      openInBrowser(data.dispatches[selectedIndex]);
    } else if (input === 'c' && count > 0) {
      const selected = data.dispatches[selectedIndex];
      if (selected.session_id && UUID_RE.test(selected.session_id)) {
        connectIDE(selected);
      }
    } else if (input === 'a' && count > 0) {
      const selected = data.dispatches[selectedIndex];
      if (selected.worktreePath) {
        attachToSession(selected);
      }
    } else if (input === 'l' && count > 0) {
      viewLogs(data.dispatches[selectedIndex]);
    } else if (input === 'r') {
      setRefreshKey(k => k + 1);
    } else if (input === 'n') {
      setBrowseMode('projects');
    } else if (input === 'x' && count > 0) {
      removeSelectedDispatch(data.dispatches[selectedIndex]);
    } else if (input === 'p' && count > 0) {
      markAsPushed(data.dispatches[selectedIndex]);
    } else if (input === 'q') {
      exit();
    }
  }, { isActive: !logViewDispatch && !actionDispatch && !detailViewDispatch && !browseMode && !dispatchStatus });

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">✗ {error}</Text>
      </Box>
    );
  }

  if (detailViewDispatch) {
    return (
      <Box flexDirection="column" height={stdout.rows}>
        <DetailView
          dispatch={detailViewDispatch}
          onBack={() => setDetailViewDispatch(null)}
          terminalRows={stdout.rows}
        />
      </Box>
    );
  }

  if (logViewDispatch) {
    return (
      <Box flexDirection="column" height={stdout.rows}>
        <LogViewer
          dispatch={logViewDispatch}
          onBack={() => setLogViewDispatch(null)}
          terminalRows={stdout.rows}
        />
      </Box>
    );
  }

  if (actionDispatch) {
    return (
      <Box flexDirection="column" height={stdout.rows}>
        <ActionMenu
          dispatch={actionDispatch}
          selectedAction={actionIndex}
          onSelect={handleActionSelect}
          onBack={handleActionBack}
        />
      </Box>
    );
  }

  if (dispatchStatus === 'confirming' && dispatchPending && trustWarnings) {
    return (
      <Box flexDirection="column" height={stdout.rows}>
        <TrustConfirm
          item={dispatchPending}
          warnings={trustWarnings}
          onConfirm={() => { setTrustWarnings(null); runDispatch(dispatchPending); }}
          onCancel={() => { setDispatchPending(null); setTrustWarnings(null); setDispatchStatus(null); }}
        />
      </Box>
    );
  }

  if (dispatchStatus && dispatchPending) {
    return (
      <Box flexDirection="column" height={stdout.rows}>
        <DispatchStatus item={dispatchPending} status={dispatchStatus} message={dispatchMessage} />
      </Box>
    );
  }

  if (browseMode === 'items' && browseProject) {
    return (
      <Box flexDirection="column" height={stdout.rows}>
        <ProjectItemPicker
        project={browseProject}
        _fetchIssues={_fetchIssues}
        _fetchPrs={_fetchPrs}
        onSelectItem={(item, repo) => {
          const pending = { type: item.itemType, number: item.number, repo };
          if (onDispatch) {
            setDispatchPending(pending);
            setBrowseMode(null);
            setBrowseProject(null);
            if (getTrustWarningsProp) {
              const warnings = getTrustWarningsProp(pending);
              if (warnings.length > 0) {
                setTrustWarnings(warnings);
                setDispatchStatus('confirming');
                return;
              }
            }
            runDispatch(pending);
          } else {
            if (onDispatchItem) {
              onDispatchItem({ type: item.itemType, number: item.number, repo });
            }
            exit();
          }
        }}
        onBack={() => {
          setBrowseMode('projects');
          setBrowseProject(null);
        }}
      />
      </Box>
    );
  }

  if (browseMode === 'projects') {
    return (
      <Box flexDirection="column" height={stdout.rows}>
        <ProjectBrowser
          _listOnboardedRepos={_listOnboardedRepos}
          onSelectProject={(proj) => {
            setBrowseProject(proj);
            setBrowseMode('items');
          }}
          onAddProject={() => {
            if (onAddProject) {
              onAddProject();
            }
            exit();
          }}
          onBack={() => setBrowseMode(null)}
        />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1} height={stdout.rows}>
      <Box marginBottom={1}>
        <Text bold>🚀 Rally Dashboard</Text>
      </Box>
      <DispatchTable dispatches={data.dispatches} selectedIndex={selectedIndex} />
      <SummaryLine summary={data.summary} />
      <Box flexGrow={1}><Text>{' '}</Text></Box>
      <Box flexDirection="column" alignItems="center">
        <Text dimColor>↑/↓ navigate · Enter actions · d details · l logs · v open · o browser · c connect IDE</Text>
        <Text dimColor>n new dispatch · a attach · p pushed · x delete · r refresh · q quit</Text>
      </Box>
    </Box>
  );
}
