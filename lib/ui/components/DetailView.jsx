import React from 'react';
import { Box, Text, useInput } from 'ink';
import { formatAge } from '../dashboard-data.js';

/**
 * Detail view — shows full info for a single dispatch.
 * Escape to return to the dashboard.
 */
export default function DetailView({ dispatch, onBack, terminalRows }) {
  useInput((input, key) => {
    if (key.escape) {
      onBack();
    }
  }, { isActive: true });

  const issueRef = dispatch.type === 'pr' ? `PR #${dispatch.number}` : `Issue #${dispatch.number}`;

  const fields = [
    { label: 'Repository', value: dispatch.repo ?? '—' },
    { label: 'Type', value: dispatch.type === 'pr' ? 'Pull Request' : 'Issue' },
    { label: 'Number', value: `#${dispatch.number}` },
    { label: 'Status', value: dispatch.status ?? '—' },
    { label: 'Branch', value: dispatch.branch ?? '—' },
    { label: 'Worktree', value: dispatch.worktreePath ?? '—' },
    { label: 'Session ID', value: dispatch.session_id ?? '—' },
    { label: 'Changes', value: dispatch.changes ?? '—' },
    { label: 'Age', value: formatAge(dispatch.created ?? dispatch.created_at) },
    { label: 'Log Path', value: dispatch.logPath ?? '—' },
  ];

  // 6 lines reserved: border top/bottom (2) + header with margin (2) + footer with margin (2)
  const contentLines = terminalRows ? Math.max(5, terminalRows - 6) : 20;
  const padCount = Math.max(0, contentLines - fields.length);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold>📋 Details for </Text>
        <Text bold color="cyan">{issueRef}</Text>
        <Text bold> ({dispatch.repo})</Text>
      </Box>
      <Box flexDirection="column">
        {fields.map((f) => (
          <Box key={f.label}>
            <Box width={14}>
              <Text bold>{f.label}</Text>
            </Box>
            <Text>{f.value}</Text>
          </Box>
        ))}
        {Array.from({ length: padCount }, (_, i) => (
          <Text key={`pad-${i}`}>{' '}</Text>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Esc back</Text>
      </Box>
    </Box>
  );
}
