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
    { id: ACTIONS.OPEN_VSCODE, label: 'v VSCode' },
    ...(!isBranch
      ? [{ id: ACTIONS.OPEN_BROWSER, label: 'o browser' }]
      : []),
    ...(hasWorktree
      ? [{ id: ACTIONS.ATTACH_SESSION, label: 'a attach' }]
      : []),
    ...(hasLog ? [{ id: ACTIONS.VIEW_LOGS, label: 'l logs' }] : []),
    { id: ACTIONS.BACK, label: 'Esc back' },
  ];

  useInput((input, key) => {
    if (input === 'v') {
      onSelect(ACTIONS.OPEN_VSCODE);
    } else if (input === 'o' && !isBranch) {
      onSelect(ACTIONS.OPEN_BROWSER);
    } else if (input === 'a' && hasWorktree) {
      onSelect(ACTIONS.ATTACH_SESSION);
    } else if (input === 'l' && hasLog) {
      onSelect(ACTIONS.VIEW_LOGS);
    } else if (key.upArrow) {
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
        <Text dimColor>↑/↓ navigate · Enter confirm · Esc back</Text>
      </Box>
    </Box>
  );
}

export { ACTIONS };
