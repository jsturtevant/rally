import React from 'react';
import { Box, Text, useInput } from 'ink';

const ACTIONS = {
  OPEN_VSCODE: 'open-vscode',
  VIEW_LOGS: 'view-logs',
  BACK: 'back',
};

/**
 * Action menu shown when a dispatch is selected.
 * Displays contextual actions for the selected dispatch.
 */
export default function ActionMenu({ dispatch, selectedAction, onSelect, onBack }) {
  const hasLog = Boolean(dispatch.logPath);

  const actions = [
    { id: ACTIONS.OPEN_VSCODE, label: '(v) Open in VS Code' },
    ...(hasLog ? [{ id: ACTIONS.VIEW_LOGS, label: '(l) View dispatch logs' }] : []),
    { id: ACTIONS.BACK, label: 'Back' },
  ];

  useInput((input, key) => {
    if (key.upArrow) {
      onSelect('up');
    } else if (key.downArrow) {
      onSelect('down');
    } else if (key.return) {
      onSelect('confirm');
    } else if (key.escape || input === 'q') {
      onBack();
    }
  });

  const issueRef = dispatch.type === 'pr' ? `PR #${dispatch.number}` : `Issue #${dispatch.number}`;

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>Actions for </Text>
        <Text bold color="cyan">{issueRef}</Text>
        <Text bold> ({dispatch.repo})</Text>
      </Box>
      {actions.map((action, i) => (
        <Box key={action.id}>
          <Text color="cyan">{i === selectedAction ? '❯ ' : '  '}</Text>
          <Text bold={i === selectedAction}>{action.label}</Text>
        </Box>
      ))}
      <Box marginTop={1}>
        <Text dimColor>↑/↓ navigate · Enter confirm · Esc back</Text>
      </Box>
    </Box>
  );
}

export { ACTIONS };
