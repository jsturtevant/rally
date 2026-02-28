import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput, useApp, useStdout } from 'ink';
import { spawn as defaultSpawn } from 'node:child_process';
import DispatchTable from './components/DispatchTable.jsx';
import ActionMenu, { ACTIONS } from './components/ActionMenu.jsx';
import LogViewer from './components/LogViewer.jsx';
import DetailView from './components/DetailView.jsx';
import ProjectBrowser from './components/ProjectBrowser.jsx';
import ProjectItemPicker from './components/ProjectItemPicker.jsx';
import OnboardInput from './components/OnboardInput.jsx';
import BranchDispatchInput from './components/BranchDispatchInput.jsx';
import TrustConfirm from './components/TrustConfirm.jsx';
import DispatchStatus from './components/DispatchStatus.jsx';
import { getDashboardData, renderPlainDashboard, groupByProject } from './dashboard-data.js';
import { dispatchRemove as defaultDispatchRemove } from '../dispatch-remove.js';
import { updateDispatchStatus as defaultUpdateDispatchStatus } from '../active.js';
import { parseSessionIdFromLog as defaultParseSessionId, UUID_RE } from '../copilot.js';

export { getDashboardData, renderPlainDashboard };

/**
 * Main Dashboard component — full-screen Ink app.
 * Supports keyboard navigation: ↑/↓ to select, Enter to open action menu, r to refresh, q to quit.
 * Auto-refreshes at the configured interval (default 5s).
 */
export default function Dashboard({ project, onSelect, onAttachSession, onDispatchItem, onDispatch, onDispatchBranch, getTrustWarnings: getTrustWarningsProp, onAddProject, refreshInterval = 5000, _spawn = defaultSpawn, _dispatchRemove = defaultDispatchRemove, _parseSessionIdFromLog = defaultParseSessionId, _updateDispatchStatus = defaultUpdateDispatchStatus, _listOnboardedRepos, _fetchIssues, _fetchPrs }) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [termRows, setTermRows] = useState(stdout?.rows || 25);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [actionDispatch, setActionDispatch] = useState(null);
  const [actionIndex, setActionIndex] = useState(0);
  const [logViewDispatch, setLogViewDispatch] = useState(null);
  const [detailViewDispatch, setDetailViewDispatch] = useState(null);
  const [browseMode, setBrowseMode] = useState(null); // null | 'projects' | 'items' | 'onboard' | 'new-branch'
  const [browseProject, setBrowseProject] = useState(null);
  const [branchRepo, setBranchRepo] = useState(null);
  const [dispatchPending, setDispatchPending] = useState(null);
  const [trustWarnings, setTrustWarnings] = useState(null);
  const [dispatchStatus, setDispatchStatus] = useState(null); // null|'confirming'|'dispatching'|'done'|'error'
  const [dispatchMessage, setDispatchMessage] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Show a toast message that auto-clears after 2 seconds
  function showToast(msg) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2000);
  }

  const [data, setData] = useState(() => {
    try { return getDashboardData({ project }); } catch { return null; }
  });
  const [error, setError] = useState(null);

  // Poll for data changes — only triggers re-render when data actually changes
  const prevJsonRef = useRef(JSON.stringify(data));
  useEffect(() => {
    if (!refreshInterval || actionDispatch || logViewDispatch || detailViewDispatch || browseMode || dispatchStatus) return;
    const timer = setInterval(() => {
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
    }, refreshInterval);
    return () => clearInterval(timer);
  }, [refreshInterval, project, actionDispatch, logViewDispatch, detailViewDispatch, browseMode, dispatchStatus]);

  // Manual refresh — reload data immediately (used after actions like remove, push, dispatch)
  function reloadData() {
    try {
      const fresh = getDashboardData({ project });
      prevJsonRef.current = JSON.stringify(fresh);
      setData(fresh);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  // Compute flattened dispatches in visual order (grouped by project)
  // This ensures selectedIndex matches what the user sees on screen
  const flatDispatches = React.useMemo(() => {
    if (!data) return [];
    const groups = groupByProject(data.dispatches, data.onboardedProjects);
    return groups.flatMap(g => g.dispatches);
  }, [data]);

  const count = flatDispatches.length;

  // Track terminal resize
  useEffect(() => {
    if (!stdout) return;
    const onResize = () => setTermRows(stdout.rows);
    stdout.on('resize', onResize);
    return () => stdout.off('resize', onResize);
  }, [stdout]);

  const isBranch = actionDispatch?.type === 'branch';

  // Derive the action list once — used for both count and selection
  const actions = actionDispatch
    ? [
        ACTIONS.OPEN_VSCODE,
        ...(!isBranch ? [ACTIONS.OPEN_BROWSER] : []),
        ...(actionDispatch.worktreePath ? [ACTIONS.ATTACH_SESSION] : []),
        ...(actionDispatch.logPath ? [ACTIONS.VIEW_LOGS] : []),
        ACTIONS.BACK,
      ]
    : [];
  const actionCount = actions.length;

  // Clamp selectedIndex when dispatch count changes
  useEffect(() => {
    if (count === 0) {
      setSelectedIndex(0);
    } else if (selectedIndex >= count) {
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
        reloadData();
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
      return;
    }
    if (!worktreePath) return;

    // Open VS Code at the worktree path
    const codeChild = _spawn('code', [worktreePath], { detached: true, stdio: 'ignore' });
    codeChild.unref();
    codeChild.on('error', (err) => {
      console.error(`Failed to launch VS Code: ${err.message}`);
    });

    // If there's a session, also bridge it to VS Code
    let sessionId = dispatch.session_id;
    if (!sessionId || sessionId === 'pending' || /^\d+$/.test(sessionId)) {
      const parsed = _parseSessionIdFromLog(dispatch.logPath);
      if (parsed) sessionId = parsed;
    }
    if (sessionId && sessionId !== 'pending' && UUID_RE.test(sessionId)) {
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
  }

  function openInBrowser(dispatch) {
    const ghCmd = dispatch.type === 'pr' ? 'pr' : 'issue';
    const child = _spawn('gh', [ghCmd, 'view', String(dispatch.number), '--repo', dispatch.repo, '--web'], { detached: true, stdio: 'ignore' });
    child.unref();
    child.on('error', (err) => {
      console.error(`Failed to open in browser: ${err.message}`);
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
      .then(() => reloadData())
      .catch((err) => {
        console.error(`Failed to remove dispatch: ${err.message}`);
      });
  }

  function markAsPushed(dispatch) {
    if (dispatch.status !== 'reviewing') return;
    try {
      _updateDispatchStatus(dispatch.id, 'upstream');
      reloadData();
    } catch (err) {
      console.error(`Failed to mark dispatch as waiting: ${err.message}`);
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
    } else if (direction === 'confirm') {
      const selectedAction = actions[actionIndex];
      if (selectedAction === ACTIONS.OPEN_VSCODE) {
        openInVSCode(actionDispatch);
      } else if (selectedAction === ACTIONS.OPEN_BROWSER) {
        openInBrowser(actionDispatch);
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
      const selected = flatDispatches[selectedIndex];
      setActionDispatch(selected);
      setActionIndex(0);
    } else if (input === 'd' && count > 0) {
      setDetailViewDispatch(flatDispatches[selectedIndex]);
    } else if (input === 'v' && count > 0) {
      openInVSCode(flatDispatches[selectedIndex]);
    } else if (input === 'o' && count > 0) {
      const selected = flatDispatches[selectedIndex];
      if (selected.type === 'branch') {
        showToast('Branches have no GitHub page to open');
      } else {
        openInBrowser(selected);
      }
    } else if (input === 'a' && count > 0) {
      const selected = flatDispatches[selectedIndex];
      if (selected.worktreePath) {
        attachToSession(selected);
      } else {
        showToast('No worktree to attach');
      }
    } else if (input === 'l' && count > 0) {
      viewLogs(flatDispatches[selectedIndex]);
    } else if (input === 'r') {
      reloadData();
    } else if (input === 'n') {
      setBrowseMode('projects');
    } else if (input === 'x' && count > 0) {
      removeSelectedDispatch(flatDispatches[selectedIndex]);
    } else if (input === 'p' && count > 0) {
      markAsPushed(flatDispatches[selectedIndex]);
    } else if (input === 'q') {
      exit();
    }
  }, { isActive: !!data && !logViewDispatch && !actionDispatch && !detailViewDispatch && !browseMode && !dispatchStatus });

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">✗ {error}</Text>
      </Box>
    );
  }

  if (detailViewDispatch) {
    return (
      <Box flexDirection="column" height={termRows}>
        <DetailView
          dispatch={detailViewDispatch}
          onBack={() => setDetailViewDispatch(null)}
          terminalRows={termRows}
        />
      </Box>
    );
  }

  if (logViewDispatch) {
    return (
      <Box flexDirection="column" height={termRows}>
        <LogViewer
          dispatch={logViewDispatch}
          onBack={() => setLogViewDispatch(null)}
          terminalRows={termRows}
        />
      </Box>
    );
  }

  if (actionDispatch) {
    return (
      <Box flexDirection="column" height={termRows}>
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
      <Box flexDirection="column" height={termRows}>
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
      <Box flexDirection="column" height={termRows}>
        <DispatchStatus item={dispatchPending} status={dispatchStatus} message={dispatchMessage} />
      </Box>
    );
  }

  if (browseMode === 'items' && browseProject) {
    return (
      <Box flexDirection="column" height={termRows}>
        <ProjectItemPicker
        project={browseProject}
        terminalRows={termRows}
        _fetchIssues={_fetchIssues}
        _fetchPrs={_fetchPrs}
        onNewBranch={(repo) => {
          setBranchRepo(repo);
          setBrowseMode('new-branch');
        }}
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

  if (browseMode === 'new-branch' && branchRepo) {
    return (
      <Box flexDirection="column" height={termRows}>
        <BranchDispatchInput
          repo={branchRepo}
          terminalRows={termRows}
          onSubmit={(task) => {
            if (onDispatchBranch) {
              return onDispatchBranch(task, branchRepo);
            }
          }}
          onBack={() => {
            setBranchRepo(null);
            setBrowseMode('items');
          }}
        />
      </Box>
    );
  }

  if (browseMode === 'onboard') {
    return (
      <Box flexDirection="column" height={termRows}>
        <OnboardInput
          terminalRows={termRows}
          onSubmit={(repoPath, team) => {
            if (onAddProject) {
              return onAddProject(repoPath, team);
            }
          }}
          onBack={() => setBrowseMode('projects')}
        />
      </Box>
    );
  }

  if (browseMode === 'projects') {
    return (
      <Box flexDirection="column" height={termRows}>
        <ProjectBrowser
          _listOnboardedRepos={_listOnboardedRepos}
          terminalRows={termRows}
          onSelectProject={(proj) => {
            setBrowseProject(proj);
            setBrowseMode('items');
          }}
          onAddProject={() => {
            setBrowseMode('onboard');
          }}
          onBack={() => setBrowseMode(null)}
        />
      </Box>
    );
  }

  // Compute effective width inside the bordered box (border: 2 chars, paddingX: 2 chars)
  const terminalWidth = stdout?.columns ?? 80;
  const effectiveWidth = terminalWidth - 4;

  // Guard against null data during reload
  if (!data) {
    return (
      <Box flexDirection="column" justifyContent="space-between" borderStyle="round" borderColor="gray" paddingX={1} height={termRows}>
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text bold>🚀 Rally Dashboard</Text>
          </Box>
          <Text dimColor>Loading...</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" justifyContent="space-between" borderStyle="round" borderColor="gray" paddingX={1} height={termRows}>
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>🚀 Rally Dashboard</Text>
        </Box>
        <DispatchTable dispatches={data.dispatches} selectedIndex={selectedIndex} onboardedProjects={data.onboardedProjects} width={effectiveWidth} />
      </Box>
      <Box flexDirection="column" alignItems="center">
        {toastMessage ? (
          <Text color="yellow">{toastMessage}</Text>
        ) : null}
        <Text dimColor>↑/↓ navigate · Enter actions · d details · l logs · v VSCode · o browser</Text>
        <Text dimColor>n new dispatch · a attach · p upstream · x delete · r refresh · q quit</Text>
      </Box>
    </Box>
  );
}
