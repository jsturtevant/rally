import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { readFileSync, existsSync } from 'node:fs';

/**
 * Inline log viewer — shows .copilot-output.log content for a dispatch.
 * ↑/↓ to scroll, Escape to return to the dashboard.
 */
export default function LogViewer({ dispatch, onBack, visibleLines = 20, _readFile = readFileSync, _existsSync = existsSync }) {
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
  });

  const visible = lines.slice(scrollOffset, scrollOffset + visibleLines);
  const issueRef = dispatch.type === 'pr' ? `PR #${dispatch.number}` : `Issue #${dispatch.number}`;

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>Logs for </Text>
        <Text bold color="cyan">{issueRef}</Text>
        <Text bold> ({dispatch.repo})</Text>
      </Box>
      <Box flexDirection="column">
        {visible.map((line, i) => (
          <Text key={scrollOffset + i} wrap="truncate">{line}</Text>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          ↑/↓ scroll · Esc back · Line {scrollOffset + 1}–{Math.min(scrollOffset + visibleLines, lines.length)} of {lines.length}
        </Text>
      </Box>
    </Box>
  );
}
