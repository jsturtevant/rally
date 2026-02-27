import React from "react";
import { Box, Text, useInput } from "ink";
import { formatAge } from "../dashboard-data.js";
function DetailView({ dispatch, onBack, terminalRows }) {
  useInput((input, key) => {
    if (key.escape) {
      onBack();
    }
  }, { isActive: true });
  const issueRef = dispatch.type === "pr" ? `PR #${dispatch.number}` : `Issue #${dispatch.number}`;
  const fields = [
    { label: "Repository", value: dispatch.repo ?? "\u2014" },
    { label: "Type", value: dispatch.type === "pr" ? "Pull Request" : "Issue" },
    { label: "Number", value: `#${dispatch.number}` },
    { label: "Status", value: dispatch.status ?? "\u2014" },
    { label: "Branch", value: dispatch.branch ?? "\u2014" },
    { label: "Worktree", value: dispatch.worktreePath ?? "\u2014" },
    { label: "Session ID", value: dispatch.session_id ?? "\u2014" },
    { label: "Changes", value: dispatch.changes ?? "\u2014" },
    { label: "Age", value: formatAge(dispatch.created ?? dispatch.created_at) },
    { label: "Log Path", value: dispatch.logPath ?? "\u2014" }
  ];
  const contentLines = terminalRows ? Math.max(5, terminalRows - 6) : 20;
  const padCount = Math.max(0, contentLines - fields.length);
  return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", borderStyle: "round", borderColor: "gray", paddingX: 1 }, /* @__PURE__ */ React.createElement(Box, { marginBottom: 1 }, /* @__PURE__ */ React.createElement(Text, { bold: true }, "\u{1F4CB} Details for "), /* @__PURE__ */ React.createElement(Text, { bold: true, color: "cyan" }, issueRef), /* @__PURE__ */ React.createElement(Text, { bold: true }, " (", dispatch.repo, ")")), /* @__PURE__ */ React.createElement(Box, { flexDirection: "column" }, fields.map((f) => /* @__PURE__ */ React.createElement(Box, { key: f.label }, /* @__PURE__ */ React.createElement(Box, { width: 14 }, /* @__PURE__ */ React.createElement(Text, { bold: true }, f.label)), /* @__PURE__ */ React.createElement(Text, null, f.value))), Array.from({ length: padCount }, (_, i) => /* @__PURE__ */ React.createElement(Text, { key: `pad-${i}` }, " "))), /* @__PURE__ */ React.createElement(Box, { marginTop: 1 }, /* @__PURE__ */ React.createElement(Text, { dimColor: true }, "Esc back")));
}
export {
  DetailView as default
};
