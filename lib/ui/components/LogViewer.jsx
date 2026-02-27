import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { readFileSync, existsSync } from 'node:fs';

/**
 * Fullscreen log viewer — shows .copilot-output.log content for a dispatch.
 * ↑/↓ to scroll, Escape to return to the dashboard.
 * @param {number} terminalRows - Terminal height (passed from Dashboard)
 */
export default function LogViewer({ dispatch, onBack, terminalRows, visibleLines: visibleLinesProp, _readFile = readFileSync, _existsSync = existsSync }) {
  // 6 lines reserved: border top/bottom (2) + header with margin (2) + footer with margin (2)
  const visibleLines = visibleLinesProp || (terminalRows ? Math.max(5, terminalRows - 6) : 20);
  const lines = useMemo(() => {
    if (!dispatch.logPath || !_existsSync(dispatch.logPath)) {
      return ['No log file available.'];
    }
    try {
      const content = _readFile(dispatch.logPath, 'utf8');
      return content.split('\n');
    } catch {
      return ['Failed to read log file.'];
    }
  }, [dispatch.logPath, _readFile, _existsSync]);

  const maxOffset = Math.max(0, lines.length - visibleLines);
  // Lazy initializer — only evaluated on mount so scroll starts at the bottom
  const [scrollOffset, setScrollOffset] = useState(() => maxOffset);

  useInput((input, key) => {
    if (key.escape) {
      onBack();
    } else if (key.upArrow) {
      setScrollOffset(o => Math.max(0, o - 1));
    } else if (key.downArrow) {
      setScrollOffset(o => Math.min(maxOffset, o + 1));
    }
  }, { isActive: true });

  const visible = lines.slice(scrollOffset, scrollOffset + visibleLines);
  // Pad to fill the full content area — Ink only renders actual <Text> nodes
  while (visible.length < visibleLines) visible.push('');
  const issueRef = dispatch.type === 'pr' ? `PR #${dispatch.number}` : `Issue #${dispatch.number}`;

  const isEmpty = lines.length <= 1 && (lines[0] === 'No log file available.' || lines[0] === '' || lines[0] === 'Failed to read log file.');

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold>📋 Logs for </Text>
        <Text bold color="cyan">{issueRef}</Text>
        <Text bold> ({dispatch.repo})</Text>
      </Box>
      {isEmpty ? (
        <Box flexDirection="column">
          <Text dimColor>No log output yet.</Text>
          <Text dimColor>Logs appear here once the Copilot session produces output.</Text>
          {Array.from({ length: Math.max(0, visibleLines - 2) }, (_, i) => (
            <Text key={`pad-${i}`}>{' '}</Text>
          ))}
        </Box>
      ) : (
        <Box flexDirection="column">
          {visible.map((line, i) => (
            <Text key={scrollOffset + i} wrap="truncate">{line || ' '}</Text>
          ))}
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>
          ↑/↓ scroll · Esc back{!isEmpty ? ` · Line ${scrollOffset + 1}–${Math.min(scrollOffset + visibleLines, lines.length)} of ${lines.length}` : ''}
        </Text>
      </Box>
    </Box>
  );
}
