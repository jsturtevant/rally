import React from 'react';
import { Box, Text, useStdout } from 'ink';
import { formatAge, groupByProject } from '../dashboard-data.js';

const STATUS_ICONS = {
  planning: '🔵',
  implementing: '⏳',
  reviewing: '🟡',
  pushed: '🟣',
  done: '✅',
  cleaned: '⚪',
};

const PR_INDENT = '';

function truncate(str, maxLen) {
  if (!str || str.length <= maxLen) return str || '';
  return str.slice(0, maxLen - 1) + '…';
}

function formatIssueRef(dispatch, maxWidth) {
  const ref = `#${dispatch.number}`;
  if (!dispatch.title) return ref;
  const titleSpace = maxWidth - ref.length - 2; // 2 for "  " separator
  if (titleSpace <= 3) return ref;
  return `${ref}  ${truncate(dispatch.title, titleSpace)}`;
}

const STATUS_LABELS = {
  implementing: 'copilot working',
  reviewing: 'ready for review',
  pushed: 'pushed',
};

function formatStatus(status) {
  const icon = STATUS_ICONS[status] ?? '?';
  const label = STATUS_LABELS[status] ?? status;
  return `${icon} ${label}`;
}

// Minimum widths per column; issueRef is flexible and gets remaining space
const COLUMN_DEFS = [
  { key: 'type', label: 'Type', minWidth: 7 },
  { key: 'issueRef', label: 'Issue/PR', minWidth: 12, flex: true },
  { key: 'status', label: 'Status', minWidth: 20 },
  { key: 'changes', label: 'Changes', minWidth: 10 },
  { key: 'age', label: 'Age', minWidth: 6 },
];

const SELECTOR_WIDTH = 2;
const ROW_INDENT = 2;
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
  const remaining = Math.max(0, width - SELECTOR_WIDTH - ROW_INDENT - fixedTotal);
  return COLUMN_DEFS.map((col) => ({
    ...col,
    width: col.flex ? Math.max(col.minWidth, remaining) : col.minWidth,
  }));
}

function TableRow({ cells, columns, selected }) {
  return (
    <Box>
      <Box width={ROW_INDENT}><Text> </Text></Box>
      <Box width={SELECTOR_WIDTH}>
        <Text color="cyan">{selected ? '❯' : ' '}</Text>
      </Box>
      {columns.map((col) => (
        <Box key={col.key} width={col.width} paddingRight={1}>
          <Text bold={selected} wrap="truncate">
            {cells[col.key] ?? ''}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

function ProjectHeader({ project }) {
  return (
    <Box>
      <Box width={SELECTOR_WIDTH}><Text> </Text></Box>
      <Text bold color="yellow">{project}</Text>
    </Box>
  );
}

export default function DispatchTable({ dispatches = [], selectedIndex = -1, onboardedProjects }) {
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns ?? DEFAULT_WIDTH;
  const columns = computeColumnWidths(terminalWidth);

  const groups = groupByProject(dispatches, onboardedProjects);

  return (
    <Box flexDirection="column" width={terminalWidth}>
      {/* Header */}
      <Box>
        <Box width={ROW_INDENT}><Text> </Text></Box>
        <Box width={SELECTOR_WIDTH}><Text> </Text></Box>
        {columns.map((col) => (
          <Box key={col.key} width={col.width} paddingRight={1}>
            <Text bold underline>{col.label}</Text>
          </Box>
        ))}
      </Box>

      {/* Data rows grouped by project */}
      {groups.length === 0 ? (
        <Box>
          <Text dimColor>No active dispatches</Text>
        </Box>
      ) : (
        (() => {
          let flatIndex = 0;
          return groups.map((group) => (
            <Box key={group.project} flexDirection="column">
              <ProjectHeader project={group.project} />
              {group.dispatches.length === 0 ? (
                <Box>
                  <Box width={ROW_INDENT}><Text> </Text></Box>
                  <Box width={SELECTOR_WIDTH}><Text> </Text></Box>
                  <Text dimColor>No active dispatches</Text>
                </Box>
              ) : group.dispatches.map((d) => {
                const idx = flatIndex++;
                const issueRefCol = columns.find(c => c.key === 'issueRef');
                const row = {
                  type: d.type === 'pr' ? 'PR' : 'Issue',
                  issueRef: formatIssueRef(d, issueRefCol?.width ?? 40),
                  status: formatStatus(d.status),
                  changes: d.changes ?? '',
                  age: formatAge(d.created ?? d.created_at),
                };
                return (
                  <TableRow key={d.id ?? idx} cells={row} columns={columns} selected={idx === selectedIndex} />
                );
              })}
            </Box>
          ));
        })()
      )}
    </Box>
  );
}

export { STATUS_ICONS, computeColumnWidths };
