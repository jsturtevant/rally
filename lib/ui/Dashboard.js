import React, { useState, useEffect, useRef } from "react";
import { Box, Text, useInput, useApp, useStdout } from "ink";
import { spawn as defaultSpawn } from "node:child_process";
import DispatchTable from "./components/DispatchTable.js";
import ActionMenu, { ACTIONS } from "./components/ActionMenu.js";
import LogViewer from "./components/LogViewer.js";
import DetailView from "./components/DetailView.js";
import ProjectBrowser from "./components/ProjectBrowser.js";
import ProjectItemPicker from "./components/ProjectItemPicker.js";
import OnboardInput from "./components/OnboardInput.js";
import BranchDispatchInput from "./components/BranchDispatchInput.js";
import TrustConfirm from "./components/TrustConfirm.js";
import DispatchStatus from "./components/DispatchStatus.js";
import { getDashboardData, renderPlainDashboard, groupByProject } from "./dashboard-data.js";
import { dispatchRemove as defaultDispatchRemove } from "../dispatch-remove.js";
import { updateDispatchStatus as defaultUpdateDispatchStatus } from "../active.js";
import { parseSessionIdFromLog as defaultParseSessionId, UUID_RE } from "../copilot.js";
function Dashboard({ project, onSelect, onAttachSession, onDispatchItem, onDispatch, onDispatchBranch, getTrustWarnings: getTrustWarningsProp, onAddProject, refreshInterval = 5e3, _spawn = defaultSpawn, _dispatchRemove = defaultDispatchRemove, _parseSessionIdFromLog = defaultParseSessionId, _updateDispatchStatus = defaultUpdateDispatchStatus, _listOnboardedRepos, _fetchIssues, _fetchPrs }) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [termRows, setTermRows] = useState(stdout?.rows || 25);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [actionDispatch, setActionDispatch] = useState(null);
  const [actionIndex, setActionIndex] = useState(0);
  const [logViewDispatch, setLogViewDispatch] = useState(null);
  const [detailViewDispatch, setDetailViewDispatch] = useState(null);
  const [browseMode, setBrowseMode] = useState(null);
  const [browseProject, setBrowseProject] = useState(null);
  const [branchRepo, setBranchRepo] = useState(null);
  const [dispatchPending, setDispatchPending] = useState(null);
  const [trustWarnings, setTrustWarnings] = useState(null);
  const [dispatchStatus, setDispatchStatus] = useState(null);
  const [dispatchMessage, setDispatchMessage] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  function showToast(msg) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 15e3);
  }
  const [data, setData] = useState(() => {
    try {
      return getDashboardData({ project });
    } catch {
      return null;
    }
  });
  const [error, setError] = useState(null);
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
  const flatDispatches = React.useMemo(() => {
    if (!data) return [];
    const groups = groupByProject(data.dispatches, data.onboardedProjects);
    return groups.flatMap((g) => g.dispatches);
  }, [data]);
  const count = flatDispatches.length;
  useEffect(() => {
    if (!stdout) return;
    const onResize = () => setTermRows(stdout.rows);
    stdout.on("resize", onResize);
    return () => stdout.off("resize", onResize);
  }, [stdout]);
  const isBranch = actionDispatch?.type === "branch";
  const actions = actionDispatch ? [
    ACTIONS.OPEN_VSCODE,
    ...!isBranch ? [ACTIONS.OPEN_BROWSER] : [],
    ...actionDispatch.worktreePath ? [ACTIONS.ATTACH_SESSION] : [],
    ...actionDispatch.logPath ? [ACTIONS.VIEW_LOGS] : [],
    ACTIONS.BACK
  ] : [];
  const actionCount = actions.length;
  useEffect(() => {
    if (count === 0) {
      setSelectedIndex(0);
    } else if (selectedIndex >= count) {
      setSelectedIndex(count - 1);
    }
  }, [count, selectedIndex]);
  async function runDispatch(item) {
    setDispatchStatus("dispatching");
    try {
      const result = await onDispatch(item);
      if (result && result.aborted) {
        if (result.reason === "no-squad") {
          setDispatchMessage("No personal squad found. Run: rally squad init");
        } else {
          setDispatchMessage("Dispatch aborted.");
        }
        setDispatchStatus("error");
      } else {
        const title = result?.pr?.title || result?.issue?.title || "";
        setDispatchMessage(`${title} \u2192 ${result?.worktreePath || ""}`);
        setDispatchStatus("done");
        reloadData();
      }
    } catch (err) {
      setDispatchMessage(err.message);
      setDispatchStatus("error");
    }
  }
  function openInVSCode(dispatch) {
    const worktreePath = dispatch.worktreePath ?? "";
    if (onSelect) {
      onSelect(worktreePath);
      return;
    }
    if (!worktreePath) return;
    const codeChild = _spawn("code", [worktreePath], { detached: true, stdio: "ignore" });
    codeChild.unref();
    codeChild.on("error", (err) => {
      console.error(`Failed to launch VS Code: ${err.message}`);
    });
    let sessionId = dispatch.session_id;
    if (!sessionId || sessionId === "pending" || /^\d+$/.test(sessionId)) {
      const parsed = _parseSessionIdFromLog(dispatch.logPath);
      if (parsed) sessionId = parsed;
    }
    if (sessionId && sessionId !== "pending" && UUID_RE.test(sessionId)) {
      const copilotChild = _spawn("gh", [
        "copilot",
        "--resume",
        sessionId,
        "-p",
        "/ide",
        "--allow-all"
      ], {
        cwd: worktreePath,
        detached: true,
        stdio: "ignore"
      });
      copilotChild.unref();
      copilotChild.on("error", (err) => {
        console.error(`Failed to launch copilot session bridge: ${err.message}`);
      });
    }
  }
  function openInBrowser(dispatch) {
    const ghCmd = dispatch.type === "pr" ? "pr" : "issue";
    const child = _spawn("gh", [ghCmd, "view", String(dispatch.number), "--repo", dispatch.repo, "--web"], { detached: true, stdio: "ignore" });
    child.unref();
    child.on("error", (err) => {
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
    _dispatchRemove(dispatch.number, { repo: dispatch.repo, silent: true }).then(({ extractionResult }) => {
      reloadData();
      if (extractionResult && extractionResult.error) {
        showToast(`\u26A0 Removed (extraction failed: ${extractionResult.error.slice(0, 40)})`);
      } else if (extractionResult && !extractionResult.blocked) {
        const { extracted = [], decisionsMerged = 0, skillsCreated = 0 } = extractionResult;
        const total = extracted.length + decisionsMerged + skillsCreated;
        if (total > 0) {
          showToast(`\u{1F4DA} ${total} learning${total === 1 ? "" : "s"} merged to personal squad`);
        } else {
          showToast("\u{1F4DA} Removed (no learnings to extract)");
        }
      } else if (extractionResult && extractionResult.blocked) {
        showToast("\u26A0 Removed (extraction blocked by license)");
      } else {
        showToast("\u2713 Removed");
      }
    }).catch((err) => {
      showToast(`\u2717 Failed: ${err.message}`);
    });
  }
  function markAsPushed(dispatch) {
    if (dispatch.status !== "reviewing") return;
    try {
      _updateDispatchStatus(dispatch.id, "upstream");
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
    if (direction === "up") {
      setActionIndex((i) => i > 0 ? i - 1 : 0);
    } else if (direction === "down") {
      setActionIndex((i) => i < actionCount - 1 ? i + 1 : i);
    } else if (direction === "confirm") {
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
  useInput(() => {
    setDispatchPending(null);
    setDispatchStatus(null);
    setDispatchMessage("");
  }, { isActive: dispatchStatus === "done" || dispatchStatus === "error" });
  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex((i) => i > 0 ? i - 1 : 0);
    } else if (key.downArrow) {
      setSelectedIndex((i) => i < count - 1 ? i + 1 : i);
    } else if (key.return && count > 0) {
      const selected = flatDispatches[selectedIndex];
      setActionDispatch(selected);
      setActionIndex(0);
    } else if (input === "d" && count > 0) {
      setDetailViewDispatch(flatDispatches[selectedIndex]);
    } else if (input === "v" && count > 0) {
      openInVSCode(flatDispatches[selectedIndex]);
    } else if (input === "o" && count > 0) {
      const selected = flatDispatches[selectedIndex];
      if (selected.type === "branch") {
        showToast("Branches have no GitHub page to open");
      } else {
        openInBrowser(selected);
      }
    } else if (input === "a" && count > 0) {
      const selected = flatDispatches[selectedIndex];
      if (selected.worktreePath) {
        attachToSession(selected);
      } else {
        showToast("No worktree to attach");
      }
    } else if (input === "l" && count > 0) {
      viewLogs(flatDispatches[selectedIndex]);
    } else if (input === "r") {
      reloadData();
    } else if (input === "n") {
      setBrowseMode("projects");
    } else if (input === "x" && count > 0) {
      removeSelectedDispatch(flatDispatches[selectedIndex]);
    } else if (input === "u" && count > 0) {
      markAsPushed(flatDispatches[selectedIndex]);
    } else if (input === "q") {
      exit();
    }
  }, { isActive: !!data && !logViewDispatch && !actionDispatch && !detailViewDispatch && !browseMode && !dispatchStatus });
  if (error) {
    return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React.createElement(Text, { color: "red" }, "\u2717 ", error));
  }
  if (detailViewDispatch) {
    return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", height: termRows }, /* @__PURE__ */ React.createElement(
      DetailView,
      {
        dispatch: detailViewDispatch,
        onBack: () => setDetailViewDispatch(null),
        terminalRows: termRows
      }
    ));
  }
  if (logViewDispatch) {
    return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", height: termRows }, /* @__PURE__ */ React.createElement(
      LogViewer,
      {
        dispatch: logViewDispatch,
        onBack: () => setLogViewDispatch(null),
        terminalRows: termRows
      }
    ));
  }
  if (actionDispatch) {
    return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", height: termRows }, /* @__PURE__ */ React.createElement(
      ActionMenu,
      {
        dispatch: actionDispatch,
        selectedAction: actionIndex,
        onSelect: handleActionSelect,
        onBack: handleActionBack
      }
    ));
  }
  if (dispatchStatus === "confirming" && dispatchPending && trustWarnings) {
    return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", height: termRows }, /* @__PURE__ */ React.createElement(
      TrustConfirm,
      {
        item: dispatchPending,
        warnings: trustWarnings,
        onConfirm: () => {
          setTrustWarnings(null);
          runDispatch(dispatchPending);
        },
        onCancel: () => {
          setDispatchPending(null);
          setTrustWarnings(null);
          setDispatchStatus(null);
        }
      }
    ));
  }
  if (dispatchStatus && dispatchPending) {
    return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", height: termRows }, /* @__PURE__ */ React.createElement(DispatchStatus, { item: dispatchPending, status: dispatchStatus, message: dispatchMessage }));
  }
  if (browseMode === "items" && browseProject) {
    return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", height: termRows }, /* @__PURE__ */ React.createElement(
      ProjectItemPicker,
      {
        project: browseProject,
        terminalRows: termRows,
        _fetchIssues,
        _fetchPrs,
        onNewBranch: (repo) => {
          setBranchRepo(repo);
          setBrowseMode("new-branch");
        },
        onSelectItem: (item, repo) => {
          const pending = { type: item.itemType, number: item.number, repo };
          if (onDispatch) {
            setDispatchPending(pending);
            setBrowseMode(null);
            setBrowseProject(null);
            if (getTrustWarningsProp) {
              const warnings = getTrustWarningsProp(pending);
              if (warnings.length > 0) {
                setTrustWarnings(warnings);
                setDispatchStatus("confirming");
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
        },
        onBack: () => {
          setBrowseMode("projects");
          setBrowseProject(null);
        }
      }
    ));
  }
  if (browseMode === "new-branch" && branchRepo) {
    return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", height: termRows }, /* @__PURE__ */ React.createElement(
      BranchDispatchInput,
      {
        repo: branchRepo,
        terminalRows: termRows,
        onSubmit: (task) => {
          if (onDispatchBranch) {
            return onDispatchBranch(task, branchRepo);
          }
        },
        onBack: () => {
          setBranchRepo(null);
          setBrowseMode("items");
        }
      }
    ));
  }
  if (browseMode === "onboard") {
    return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", height: termRows }, /* @__PURE__ */ React.createElement(
      OnboardInput,
      {
        terminalRows: termRows,
        onSubmit: (opts) => {
          if (onAddProject) {
            return onAddProject(opts);
          }
        },
        onBack: () => setBrowseMode("projects")
      }
    ));
  }
  if (browseMode === "projects") {
    return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", height: termRows }, /* @__PURE__ */ React.createElement(
      ProjectBrowser,
      {
        _listOnboardedRepos,
        terminalRows: termRows,
        onSelectProject: (proj) => {
          setBrowseProject(proj);
          setBrowseMode("items");
        },
        onAddProject: () => {
          setBrowseMode("onboard");
        },
        onBack: () => setBrowseMode(null)
      }
    ));
  }
  const terminalWidth = stdout?.columns ?? 80;
  const effectiveWidth = terminalWidth - 4;
  if (!data) {
    return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", justifyContent: "space-between", borderStyle: "round", borderColor: "gray", paddingX: 1, height: termRows }, /* @__PURE__ */ React.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React.createElement(Box, { marginBottom: 1 }, /* @__PURE__ */ React.createElement(Text, { bold: true }, "\u{1F680} Rally Dashboard")), /* @__PURE__ */ React.createElement(Text, { dimColor: true }, "Loading...")));
  }
  return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", justifyContent: "space-between", borderStyle: "round", borderColor: "gray", paddingX: 1, height: termRows }, /* @__PURE__ */ React.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React.createElement(Box, { marginBottom: 1 }, /* @__PURE__ */ React.createElement(Text, { bold: true }, "\u{1F680} Rally Dashboard")), /* @__PURE__ */ React.createElement(DispatchTable, { dispatches: data.dispatches, selectedIndex, onboardedProjects: data.onboardedProjects, width: effectiveWidth })), /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", alignItems: "center" }, toastMessage ? /* @__PURE__ */ React.createElement(Text, { color: "yellow" }, toastMessage) : null, /* @__PURE__ */ React.createElement(Text, { dimColor: true }, "\u2191/\u2193 navigate \xB7 Enter actions \xB7 d details \xB7 l logs \xB7 v VSCode \xB7 o browser"), /* @__PURE__ */ React.createElement(Text, { dimColor: true }, "n new dispatch \xB7 a attach \xB7 u upstream \xB7 x delete \xB7 r refresh \xB7 q quit")));
}
export {
  Dashboard as default,
  getDashboardData,
  renderPlainDashboard
};
