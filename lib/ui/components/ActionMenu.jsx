import React from 'react';
import { Box, Text, useInput } from 'ink';
import { UUID_RE } from '../../copilot.js';

const ACTIONS = {
  OPEN_VSCODE: 'open-vscode',
  OPEN_BROWSER: 'open-browser',
  CONNECT_IDE: 'connect-ide',
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
  const hasConnectableSession = dispatch.session_id &&
    UUID_RE.test(dispatch.session_id);

  const actions = [
    { id: ACTIONS.OPEN_VSCODE, label: '(v) Open in VS Code' },
    { id: ACTIONS.OPEN_BROWSER, label: '(o) Open in browser' },
    ...(hasConnectableSession
      ? [{ id: ACTIONS.CONNECT_IDE, label: '(c) Connect IDE session' }]
      : []),
    ...(hasWorktree
      ? [{ id: ACTIONS.ATTACH_SESSION, label: '(a) Attach to session' }]
      : []),
    ...(hasLog ? [{ id: ACTIONS.VIEW_LOGS, label: '(l) View dispatch logs' }] : []),
    { id: ACTIONS.BACK, label: 'Back' },
  ];

  useInput((input, key) => {
    if (input === 'v') {
      onSelect(ACTIONS.OPEN_VSCODE);
    } else if (input === 'o') {
      onSelect(ACTIONS.OPEN_BROWSER);
    } else if (input === 'c' && hasConnectableSession) {
      onSelect(ACTIONS.CONNECT_IDE);
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
        <Text dimColor>↑/↓ navigate · Enter confirm · v/o/a/l shortcut · Esc back</Text>
      </Box>
    </Box>
  );
}

export { ACTIONS };
