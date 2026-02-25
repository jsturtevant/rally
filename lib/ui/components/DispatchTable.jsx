import React from 'react';
import { Box, Text, useStdout } from 'ink';
import { formatAge } from '../dashboard-data.js';

const STATUS_ICONS = {
  planning: '🔵',
  implementing: '⏳',
  reviewing: '🟡',
  pushed: '🟣',
  done: '✅',
  cleaned: '⚪',
};

function formatIssueRef(dispatch) {
  const prefix = dispatch.type === 'pr' ? 'PR' : 'Issue';
  return `${prefix} #${dispatch.number}`;
}

const STATUS_LABELS = {
  implementing: 'working',
  reviewing: 'ready for review',
  pushed: 'pushed',
};

function formatStatus(status) {
  const icon = STATUS_ICONS[status] ?? '?';
  const label = STATUS_LABELS[status] ?? status;
  return `${icon} ${label}`;
}

// Minimum widths per column; Project is flexible and gets remaining space
const COLUMN_DEFS = [
  { key: 'project', label: 'Project', minWidth: 18, flex: true },
  { key: 'issueRef', label: 'Issue/PR', minWidth: 12 },
  { key: 'status', label: 'Status', minWidth: 20 },
  { key: 'changes', label: 'Changes', minWidth: 10 },
  { key: 'age', label: 'Age', minWidth: 6 },
];

const SELECTOR_WIDTH = 2;
const DEFAULT_WIDTH = 80;

function computeColumnWidths(terminalWidth) {
  const width =
    Number.isFinite(terminalWidth) && terminalWidth > 0
      ? terminalWidth
      : DEFAULT_WIDTH;
  const fixedTotal = COLUMN_DEFS.reduce(
    (sum, col) => sum + (col.flex ? 0 : col.minWidth),
    0,
  );
  const remaining = Math.max(0, width - SELECTOR_WIDTH - fixedTotal);
  return COLUMN_DEFS.map((col) => ({
    ...col,
    width: col.flex ? Math.max(col.minWidth, remaining) : col.minWidth,
  }));
}

function TableRow({ cells, columns, selected }) {
  return (
    <Box>
      <Box width={SELECTOR_WIDTH}>
        <Text color="cyan">{selected ? '❯' : ' '}</Text>
      </Box>
      {columns.map((col) => (
        <Box key={col.key} width={col.width} paddingRight={1}>
          <Text bold={selected}>
            {cells[col.key] ?? ''}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

export default function DispatchTable({ dispatches = [], selectedIndex = -1 }) {
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns ?? DEFAULT_WIDTH;
  const columns = computeColumnWidths(terminalWidth);

  const rows = dispatches.map((d) => {
    return {
      project: d.repo ?? '',
      issueRef: formatIssueRef(d),
      status: formatStatus(d.status),
      changes: d.changes ?? '',
      age: formatAge(d.created ?? d.created_at),
    };
  });

  return (
    <Box flexDirection="column" width={terminalWidth}>
      {/* Header */}
      <Box>
        <Box width={SELECTOR_WIDTH}><Text> </Text></Box>
        {columns.map((col) => (
          <Box key={col.key} width={col.width} paddingRight={1}>
            <Text bold underline>{col.label}</Text>
          </Box>
        ))}
      </Box>

      {/* Data rows */}
      {rows.length === 0 ? (
        <Box>
          <Text dimColor>No active dispatches</Text>
        </Box>
      ) : (
        rows.map((row, i) => (
          <TableRow key={dispatches[i].id ?? i} cells={row} columns={columns} selected={i === selectedIndex} />
        ))
      )}
    </Box>
  );
}

export { STATUS_ICONS, computeColumnWidths };
