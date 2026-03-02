import React from "react";
import { Box, Text, useInput } from "ink";
const ACTIONS = {
  OPEN_VSCODE: "open-vscode",
  OPEN_BROWSER: "open-browser",
  ATTACH_SESSION: "attach-session",
  VIEW_LOGS: "view-logs",
  BACK: "back"
};
function ActionMenu({ dispatch, selectedAction, onSelect, onBack }) {
  const hasLog = Boolean(dispatch.logPath);
  const hasWorktree = Boolean(dispatch.worktreePath);
  const isBranch = dispatch.type === "branch";
  const actions = [
    { id: ACTIONS.OPEN_VSCODE, label: "Open in VSCode" },
    ...!isBranch ? [{ id: ACTIONS.OPEN_BROWSER, label: "Open in browser" }] : [],
    ...hasWorktree ? [{ id: ACTIONS.ATTACH_SESSION, label: "Attach to session" }] : [],
    ...hasLog ? [{ id: ACTIONS.VIEW_LOGS, label: "View logs" }] : [],
    { id: ACTIONS.BACK, label: "Back" }
  ];
  useInput((input, key) => {
    if (key.upArrow) {
      onSelect("up");
    } else if (key.downArrow) {
      onSelect("down");
    } else if (key.return) {
      onSelect("confirm");
    } else if (key.escape || input === "q") {
      onBack();
    }
  }, { isActive: true });
  const typeLabel = dispatch.type === "pr" ? "PR" : dispatch.type === "branch" ? "Branch" : "Issue";
  const refLabel = dispatch.type === "branch" ? dispatch.branch : `#${dispatch.number}`;
  return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", borderStyle: "round", borderColor: "gray", paddingX: 1, paddingY: 0 }, /* @__PURE__ */ React.createElement(Box, { marginBottom: 1 }, /* @__PURE__ */ React.createElement(Text, { bold: true }, "Actions for "), /* @__PURE__ */ React.createElement(Text, { bold: true, color: "cyan" }, typeLabel, " ", refLabel), /* @__PURE__ */ React.createElement(Text, { bold: true }, " (", dispatch.repo, ")")), actions.map((action, i) => /* @__PURE__ */ React.createElement(Box, { key: action.id }, /* @__PURE__ */ React.createElement(Text, { color: "cyan" }, i === selectedAction ? "\u276F " : "  "), /* @__PURE__ */ React.createElement(Text, { bold: i === selectedAction }, action.label))), /* @__PURE__ */ React.createElement(Box, { marginTop: 1 }, /* @__PURE__ */ React.createElement(Text, { dimColor: true }, "\u2191/\u2193 navigate \xB7 Enter select \xB7 Esc back")));
}
export {
  ACTIONS,
  ActionMenu as default
};
