import React from "react";
import { Box, Text, useStdout } from "ink";
import { formatAge, groupByProject } from "../dashboard-data.js";
const STATUS_ICONS = {
  planning: "\u{1F535}",
  implementing: "\u23F3",
  reviewing: "\u{1F7E1}",
  pushed: "\u{1F7E3}",
  done: "\u2705",
  cleaned: "\u26AA"
};
const PR_INDENT = "";
function truncate(str, maxLen) {
  if (!str || str.length <= maxLen) return str || "";
  return str.slice(0, maxLen - 1) + "\u2026";
}
function formatIssueRef(dispatch, maxWidth) {
  const ref = `#${dispatch.number}`;
  if (!dispatch.title) return ref;
  const titleSpace = maxWidth - ref.length - 2;
  if (titleSpace <= 3) return ref;
  return `${ref}  ${truncate(dispatch.title, titleSpace)}`;
}
const STATUS_LABELS = {
  implementing: "copilot working",
  reviewing: "ready for review",
  pushed: "pushed"
};
function formatStatus(status) {
  const icon = STATUS_ICONS[status] ?? "?";
  const label = STATUS_LABELS[status] ?? status;
  return `${icon} ${label}`;
}
const COLUMN_DEFS = [
  { key: "type", label: "Type", minWidth: 7 },
  { key: "issueRef", label: "Issue/PR", minWidth: 12, flex: true },
  { key: "status", label: "Status", minWidth: 20 },
  { key: "changes", label: "Changes", minWidth: 10 },
  { key: "age", label: "Age", minWidth: 6 }
];
const SELECTOR_WIDTH = 2;
const ROW_INDENT = 2;
const DEFAULT_WIDTH = 80;
function computeColumnWidths(terminalWidth) {
  const width = Number.isFinite(terminalWidth) && terminalWidth > 0 ? terminalWidth : DEFAULT_WIDTH;
  const fixedTotal = COLUMN_DEFS.reduce(
    (sum, col) => sum + (col.flex ? 0 : col.minWidth),
    0
  );
  const remaining = Math.max(0, width - SELECTOR_WIDTH - ROW_INDENT - fixedTotal);
  return COLUMN_DEFS.map((col) => ({
    ...col,
    width: col.flex ? Math.max(col.minWidth, remaining) : col.minWidth
  }));
}
function TableRow({ cells, columns, selected }) {
  return /* @__PURE__ */ React.createElement(Box, null, /* @__PURE__ */ React.createElement(Box, { width: ROW_INDENT }, /* @__PURE__ */ React.createElement(Text, null, " ")), /* @__PURE__ */ React.createElement(Box, { width: SELECTOR_WIDTH }, /* @__PURE__ */ React.createElement(Text, { color: "cyan" }, selected ? "\u276F" : " ")), columns.map((col) => /* @__PURE__ */ React.createElement(Box, { key: col.key, width: col.width, paddingRight: 1 }, /* @__PURE__ */ React.createElement(Text, { bold: selected, wrap: "truncate" }, cells[col.key] ?? ""))));
}
function ProjectHeader({ project }) {
  return /* @__PURE__ */ React.createElement(Box, null, /* @__PURE__ */ React.createElement(Box, { width: SELECTOR_WIDTH }, /* @__PURE__ */ React.createElement(Text, null, " ")), /* @__PURE__ */ React.createElement(Text, { bold: true, color: "yellow" }, project));
}
function DispatchTable({ dispatches = [], selectedIndex = -1, onboardedProjects }) {
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns ?? DEFAULT_WIDTH;
  const columns = computeColumnWidths(terminalWidth);
  const groups = groupByProject(dispatches, onboardedProjects);
  return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", width: terminalWidth }, /* @__PURE__ */ React.createElement(Box, null, /* @__PURE__ */ React.createElement(Box, { width: ROW_INDENT }, /* @__PURE__ */ React.createElement(Text, null, " ")), /* @__PURE__ */ React.createElement(Box, { width: SELECTOR_WIDTH }, /* @__PURE__ */ React.createElement(Text, null, " ")), columns.map((col) => /* @__PURE__ */ React.createElement(Box, { key: col.key, width: col.width, paddingRight: 1 }, /* @__PURE__ */ React.createElement(Text, { bold: true, underline: true }, col.label)))), groups.length === 0 ? /* @__PURE__ */ React.createElement(Box, null, /* @__PURE__ */ React.createElement(Text, { dimColor: true }, "No active dispatches")) : (() => {
    let flatIndex = 0;
    return groups.map((group) => /* @__PURE__ */ React.createElement(Box, { key: group.project, flexDirection: "column" }, /* @__PURE__ */ React.createElement(ProjectHeader, { project: group.project }), group.dispatches.length === 0 ? /* @__PURE__ */ React.createElement(Box, null, /* @__PURE__ */ React.createElement(Box, { width: ROW_INDENT }, /* @__PURE__ */ React.createElement(Text, null, " ")), /* @__PURE__ */ React.createElement(Box, { width: SELECTOR_WIDTH }, /* @__PURE__ */ React.createElement(Text, null, " ")), /* @__PURE__ */ React.createElement(Text, { dimColor: true }, "No active dispatches")) : group.dispatches.map((d) => {
      const idx = flatIndex++;
      const issueRefCol = columns.find((c) => c.key === "issueRef");
      const row = {
        type: d.type === "pr" ? "PR" : "Issue",
        issueRef: formatIssueRef(d, issueRefCol?.width ?? 40),
        status: formatStatus(d.status),
        changes: d.changes ?? "",
        age: formatAge(d.created ?? d.created_at)
      };
      return /* @__PURE__ */ React.createElement(TableRow, { key: d.id ?? idx, cells: row, columns, selected: idx === selectedIndex });
    })));
  })());
}
export {
  STATUS_ICONS,
  computeColumnWidths,
  DispatchTable as default
};
