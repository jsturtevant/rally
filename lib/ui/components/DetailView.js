import React from "react";
import { Box, Text, useInput } from "ink";
import { formatAge } from "../dashboard-data.js";
function DetailView({ dispatch, onBack }) {
  useInput((input, key) => {
    if (key.escape) {
      onBack();
    }
  });
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
  return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React.createElement(Box, { marginBottom: 1 }, /* @__PURE__ */ React.createElement(Text, { bold: true }, "Details for "), /* @__PURE__ */ React.createElement(Text, { bold: true, color: "cyan" }, issueRef), /* @__PURE__ */ React.createElement(Text, { bold: true }, " (", dispatch.repo, ")")), /* @__PURE__ */ React.createElement(Box, { flexDirection: "column" }, fields.map((f) => /* @__PURE__ */ React.createElement(Box, { key: f.label }, /* @__PURE__ */ React.createElement(Box, { width: 14 }, /* @__PURE__ */ React.createElement(Text, { bold: true }, f.label)), /* @__PURE__ */ React.createElement(Text, null, f.value)))), /* @__PURE__ */ React.createElement(Box, { marginTop: 1 }, /* @__PURE__ */ React.createElement(Text, { dimColor: true }, "Esc back")));
}
export {
  DetailView as default
};
