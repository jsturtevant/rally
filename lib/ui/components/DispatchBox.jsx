import React from 'react';
import { Box, Text } from 'ink';

export default function DispatchBox({ title, children }) {
  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      {title && <Text bold>{title}</Text>}
      {children}
    </Box>
  );
}
