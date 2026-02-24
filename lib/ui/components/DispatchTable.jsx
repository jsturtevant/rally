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

const STATUS_LABELS = {
  reviewing: 'ready for review',
};

function formatStatus(status) {
  const icon = STATUS_ICONS[status] ?? '?';
  const label = STATUS_LABELS[status] ?? status;
  return `${icon} ${label}`;
}

const COLUMNS = [
  { key: 'project', label: 'Project', width: 18 },
  { key: 'issueRef', label: 'Issue/PR', width: 12 },
  { key: 'branch', label: 'Branch', width: 22 },
  { key: 'folder', label: 'Folder', width: 30 },
  { key: 'status', label: 'Status', width: 20 },
  { key: 'changes', label: 'Changes', width: 10 },
  { key: 'age', label: 'Age', width: 6 },
];

function TableRow({ cells, selected }) {
  return (
    <Box>
      <Box width={2}>
        <Text color="cyan">{selected ? '❯' : ' '}</Text>
      </Box>
      {COLUMNS.map((col) => (
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
  const rows = dispatches.map((d) => {
    const folderPath = d.worktreePath ?? '';
    const truncatedFolder = folderPath.length > 30 ? '…' + folderPath.slice(-29) : folderPath;
    return {
      project: d.repo ?? '',
      issueRef: formatIssueRef(d),
      branch: d.branch ?? '',
      folder: truncatedFolder,
      status: formatStatus(d.status),
      changes: d.changes ?? '',
      age: formatAge(d.created ?? d.created_at),
    };
  });

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box>
        <Box width={2}><Text> </Text></Box>
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
          <TableRow key={dispatches[i].id ?? i} cells={row} selected={i === selectedIndex} />
        ))
      )}
    </Box>
  );
}

export { STATUS_ICONS };
