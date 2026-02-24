import React from 'react';
import { Box, Text, useInput } from 'ink';
import { formatAge } from '../dashboard-data.js';

/**
 * Detail view — shows full info for a single dispatch.
 * Escape to return to the dashboard.
 */
export default function DetailView({ dispatch, onBack }) {
  useInput((input, key) => {
    if (key.escape) {
      onBack();
    }
  });

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

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>Details for </Text>
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
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Esc back</Text>
      </Box>
    </Box>
  );
}
