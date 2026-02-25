import React from 'react';
import { Box, Text } from 'ink';
import { formatAge, groupByProject } from '../dashboard-data.js';

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
  reviewing: 'review',
  pushed: 'pushed',
};

function formatStatus(status) {
  const icon = STATUS_ICONS[status] ?? '?';
  const label = STATUS_LABELS[status] ?? status;
  return `${icon} ${label}`;
}

const SELECTOR_WIDTH = 2;
const INDENT_WIDTH = 2;

const FIXED_COLUMNS = [
  { key: 'issueRef', label: 'Issue/PR', minWidth: 12 },
  { key: 'status', label: 'Status', minWidth: 16 },
  { key: 'changes', label: 'Changes', minWidth: 10 },
  { key: 'age', label: 'Age', minWidth: 6 },
];

const MIN_FIXED_TOTAL = SELECTOR_WIDTH + INDENT_WIDTH + FIXED_COLUMNS.reduce((sum, c) => sum + c.minWidth, 0);

function computeColumns(terminalWidth = 80) {
  const available = Math.max(terminalWidth, MIN_FIXED_TOTAL);
  const extra = available - MIN_FIXED_TOTAL;
  const weights = [0.4, 0.4, 0.15, 0.05];
  return FIXED_COLUMNS.map((col, i) => ({
    ...col,
    width: col.minWidth + Math.floor(extra * weights[i]),
  }));
}

function ProjectHeader({ project, width }) {
  return (
    <Box width={width}>
      <Box width={SELECTOR_WIDTH}><Text> </Text></Box>
      <Text bold color="yellow">{project}</Text>
    </Box>
  );
}

function TableRow({ cells, columns, selected, width }) {
  return (
    <Box width={width}>
      <Box width={SELECTOR_WIDTH}>
        <Text color="cyan">{selected ? '❯' : ' '}</Text>
      </Box>
      <Box width={INDENT_WIDTH}><Text> </Text></Box>
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

export default function DispatchTable({ dispatches = [], selectedIndex = -1, width }) {
  const columns = computeColumns(width);

  if (dispatches.length === 0) {
    return (
      <Box flexDirection="column" width={width}>
        <Box>
          <Text dimColor>No active dispatches</Text>
        </Box>
      </Box>
    );
  }

  const groups = groupByProject(dispatches);

  const rows = [];
  let flatIndex = 0;
  for (const group of groups) {
    rows.push({ type: 'header', project: group.project });
    for (const d of group.dispatches) {
      rows.push({
        type: 'item',
        originalIndex: flatIndex,
        cells: {
          issueRef: formatIssueRef(d),
          status: formatStatus(d.status),
          changes: d.changes ?? '',
          age: formatAge(d.created ?? d.created_at),
        },
        id: d.id ?? flatIndex,
      });
      flatIndex++;
    }
  }

  return (
    <Box flexDirection="column" width={width}>
      <Box width={width}>
        <Box width={SELECTOR_WIDTH}><Text> </Text></Box>
        <Box width={INDENT_WIDTH}><Text> </Text></Box>
        {columns.map((col) => (
          <Box key={col.key} width={col.width} paddingRight={1}>
            <Text bold underline>{col.label}</Text>
          </Box>
        ))}
      </Box>

      {rows.map((row, i) => {
        if (row.type === 'header') {
          return <ProjectHeader key={`hdr-${row.project}`} project={row.project} width={width} />;
        }
        return (
          <TableRow
            key={row.id}
            cells={row.cells}
            columns={columns}
            selected={row.originalIndex === selectedIndex}
            width={width}
          />
        );
      })}
    </Box>
  );
}

export { STATUS_ICONS, computeColumns };
