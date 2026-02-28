import React from 'react';
import { Box, Text, useInput } from 'ink';

const ACTIONS = {
  OPEN_VSCODE: 'open-vscode',
  OPEN_BROWSER: 'open-browser',
  ATTACH_SESSION: 'attach-session',
  VIEW_LOGS: 'view-logs',
  BACK: 'back',
};

/**
 * Action menu shown when a dispatch is selected.
 * Displays contextual actions for the selected dispatch.
 */
export default function ActionMenu({ dispatch, selectedAction, onSelect, onBack }) {
  const hasLog = Boolean(dispatch.logPath);
  const hasWorktree = Boolean(dispatch.worktreePath);
  const isBranch = dispatch.type === 'branch';

  const actions = [
    { id: ACTIONS.OPEN_VSCODE, label: 'Open in VSCode' },
    ...(!isBranch
      ? [{ id: ACTIONS.OPEN_BROWSER, label: 'Open in browser' }]
      : []),
    ...(hasWorktree
      ? [{ id: ACTIONS.ATTACH_SESSION, label: 'Attach to session' }]
      : []),
    ...(hasLog ? [{ id: ACTIONS.VIEW_LOGS, label: 'View logs' }] : []),
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
  }, { isActive: true });

  const typeLabel = dispatch.type === 'pr' ? 'PR' : dispatch.type === 'branch' ? 'Branch' : 'Issue';
  const refLabel = dispatch.type === 'branch' ? dispatch.branch : `#${dispatch.number}`;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1} paddingY={0}>
      <Box marginBottom={1}>
        <Text bold>Actions for </Text>
        <Text bold color="cyan">{typeLabel} {refLabel}</Text>
        <Text bold> ({dispatch.repo})</Text>
      </Box>
      {actions.map((action, i) => (
        <Box key={action.id}>
          <Text color="cyan">{i === selectedAction ? '❯ ' : '  '}</Text>
          <Text bold={i === selectedAction}>{action.label}</Text>
        </Box>
      ))}
      <Box marginTop={1}>
        <Text dimColor>↑/↓ navigate · Enter select · Esc back</Text>
      </Box>
    </Box>
  );
}

export { ACTIONS };
