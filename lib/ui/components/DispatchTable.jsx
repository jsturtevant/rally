import React from "react";
import { Box, Text } from "ink";
import { formatAge } from "../dashboard-data.js";

const STATUS_ICONS = {
  planning: "🔵",
  implementing: "⏳",
  reviewing: "🟡",
  pushed: "🟣",
  done: "✅",
  cleaned: "⚪",
};

function formatIssueRef(dispatch) {
  const prefix = dispatch.type === "pr" ? "PR" : "Issue";
  return `${prefix} #${dispatch.number}`;
}

const STATUS_LABELS = {
  implementing: "working",
  reviewing: "review",
  pushed: "pushed",
};

function formatStatus(status) {
  const icon = STATUS_ICONS[status] ?? "?";
  const label = STATUS_LABELS[status] ?? status;
  return `${icon} ${label}`;
}

const SELECTOR_WIDTH = 2;

const FIXED_COLUMNS = [
  { key: "issueRef", label: "Issue/PR", minWidth: 12 },
  { key: "status", label: "Status", minWidth: 16 },
  { key: "changes", label: "Changes", minWidth: 10 },
  { key: "age", label: "Age", minWidth: 6 },
];

const FIXED_TOTAL = SELECTOR_WIDTH + FIXED_COLUMNS.reduce((sum, c) => sum + c.minWidth, 0);
const MIN_PROJECT_WIDTH = 18;

function computeColumns(terminalWidth = 80) {
  const available = Math.max(terminalWidth, FIXED_TOTAL + MIN_PROJECT_WIDTH);
  const projectWidth = available - FIXED_TOTAL;
  return [
    { key: "project", label: "Project", width: projectWidth },
    ...FIXED_COLUMNS.map(c => ({ ...c, width: c.minWidth })),
  ];
}

function TableRow({ cells, columns, selected, width }) {
  return (
    <Box width={width}>
      <Box width={SELECTOR_WIDTH}>
        <Text color="cyan">{selected ? "❯" : " "}</Text>
      </Box>
      {columns.map((col) => (
        <Box key={col.key} width={col.width} paddingRight={1}>
          <Text bold={selected}>
            {cells[col.key] ?? ""}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

export default function DispatchTable({ dispatches = [], selectedIndex = -1, width }) {
  const columns = computeColumns(width);
  const rows = dispatches.map((d) => ({
    project: d.repo ?? "",
    issueRef: formatIssueRef(d),
    status: formatStatus(d.status),
    changes: d.changes ?? "",
    age: formatAge(d.created ?? d.created_at),
  }));

  return (
    <Box flexDirection="column" width={width}>
      <Box width={width}>
        <Box width={SELECTOR_WIDTH}><Text> </Text></Box>
        {columns.map((col) => (
          <Box key={col.key} width={col.width} paddingRight={1}>
            <Text bold underline>{col.label}</Text>
          </Box>
        ))}
      </Box>
      {rows.length === 0 ? (
        <Box><Text dimColor>No active dispatches</Text></Box>
      ) : (
        rows.map((row, i) => (
          <TableRow key={dispatches[i].id ?? i} cells={row} columns={columns} selected={i === selectedIndex} width={width} />
        ))
      )}
    </Box>
  );
}

export { STATUS_ICONS, computeColumns };
