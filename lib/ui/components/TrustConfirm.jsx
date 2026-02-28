import React from 'react';
import { Box, Text, useInput } from 'ink';

export default function TrustConfirm({ item, warnings, onConfirm, onCancel }) {
  useInput((input, key) => {
    if (input === 'y' || input === 'Y') onConfirm();
    else if (input === 'n' || input === 'N' || key.escape) onCancel();
  });
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>Dispatch #{item.number} ({item.type})</Text>
      </Box>
      {warnings.map((w, i) => (
        <Box key={i} flexDirection="column" marginBottom={1}>
          <Text color="yellow">⚠ {w.message}</Text>
          <Text dimColor>  {w.detail}</Text>
        </Box>
      ))}
      <Text>Proceed? <Text bold color="green">y</Text>/<Text bold color="red">n</Text></Text>
    </Box>
  );
}
