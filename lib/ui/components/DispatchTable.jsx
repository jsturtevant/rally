import React from 'react';
import { Box, Text } from 'ink';
import { formatAge, groupByProject } from '../dashboard-data.js';

const STATUS_ICONS = {
  planning: '\U0001f535',
  implementing: '\u231b',
  reviewing: '\U0001f7e1',
  pushed: '\U0001f7e3',
  done: '\u2705',
  cleaned: '\u26aa',
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

const COLUMNS = [
  { key: 'issueRef', label: 'Issue/PR', width: 12 },
  { key: 'status', label: 'Status', width: 16 },
  { key: 'changes', label: 'Changes', width: 10 },
  { key: 'age', label: 'Age', width: 6 },
];

function ProjectHeader({ project }) {
  return (
    <Box>
      <Box width={SELECTOR_WIDTH}><Text> </Text></Box>
      <Text bold color="yellow">{project}</Text>
    </Box>
  );
}

function TableRow({ cells, selected }) {
  return (
    <Box>
      <Box width={SELECTOR_WIDTH}>
        <Text color="cyan">{selected ? '\u276f' : ' '}</Text>
      </Box>
      <Box width={INDENT_WIDTH}><Text> </Text></Box>
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
  if (dispatches.length === 0) {
    return (
      <Box flexDirection="column">
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
    <Box flexDirection="column">
      <Box>
        <Box width={SELECTOR_WIDTH}><Text> </Text></Box>
        <Box width={INDENT_WIDTH}><Text> </Text></Box>
        {COLUMNS.map((col) => (
          <Box key={col.key} width={col.width} paddingRight={1}>
            <Text bold underline>{col.label}</Text>
          </Box>
        ))}
      </Box>

      {rows.map((row, i) => {
        if (row.type === 'header') {
          return <ProjectHeader key={`hdr-${row.project}`} project={row.project} />;
        }
        return (
          <TableRow
            key={row.id}
            cells={row.cells}
            selected={row.originalIndex === selectedIndex}
          />
        );
      })}
    </Box>
  );
}

export { STATUS_ICONS };
