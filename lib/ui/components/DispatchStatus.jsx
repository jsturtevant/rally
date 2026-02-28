import React from 'react';
import { Box, Text } from 'ink';

export default function DispatchStatus({ item, status, message }) {
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>Dispatch #{item.number} ({item.type})</Text>
      </Box>
      {status === 'dispatching' && <Text color="yellow">Dispatching...</Text>}
      {status === 'done' && <Text color="green">✓ {message}</Text>}
      {status === 'error' && <Text color="red">✗ {message}</Text>}
      {(status === 'done' || status === 'error') && (
        <Box marginTop={1}><Text dimColor>Press any key to return</Text></Box>
      )}
    </Box>
  );
}
