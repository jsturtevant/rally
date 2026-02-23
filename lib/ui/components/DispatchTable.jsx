import React from 'react';
import { Box, Text } from 'ink';
import { formatAge } from '../dashboard-data.js';

const STATUS_ICONS = {
  planning: '🔵',
  implementing: '🟢',
  reviewing: '🟡',
  done: '✅',
  cleaned: '⚪',
};

function formatIssueRef(dispatch) {
  const prefix = dispatch.type === 'pr' ? 'PR' : 'Issue';
  return `${prefix} #${dispatch.number}`;
}

function formatStatus(status) {
  const icon = STATUS_ICONS[status] ?? '?';
  return `${icon} ${status}`;
}

const COLUMNS = [
  { key: 'project', label: 'Project', width: 20 },
  { key: 'issueRef', label: 'Issue/PR', width: 12 },
  { key: 'branch', label: 'Branch', width: 28 },
  { key: 'status', label: 'Status', width: 16 },
  { key: 'age', label: 'Age', width: 6 },
];

function TableRow({ cells, selected }) {
  return (
    <Box>
      {COLUMNS.map((col) => (
        <Box key={col.key} width={col.width} paddingRight={1}>
          <Text bold={selected} inverse={selected}>
            {cells[col.key] ?? ''}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

export default function DispatchTable({ dispatches = [], selectedIndex = -1 }) {
  const rows = dispatches.map((d) => ({
    project: d.repo ?? '',
    issueRef: formatIssueRef(d),
    branch: d.branch ?? '',
    status: formatStatus(d.status),
    age: formatAge(d.created ?? d.created_at),
  }));

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box>
        {COLUMNS.map((col) => (
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
          <TableRow key={dispatches[i].session_id ?? i} cells={row} selected={i === selectedIndex} />
        ))
      )}
    </Box>
  );
}

export { STATUS_ICONS };
