import React from 'react';
import { Text } from 'ink';

const types = {
  success: { icon: '✓', color: 'green' },
  error: { icon: '✗', color: 'red' },
  warning: { icon: '⚠', color: 'yellow' },
  skip: { icon: '⊘', color: 'gray' },
};

export default function StatusMessage({ type, children }) {
  const config = types[type];
  if (!config) return null;

  return (
    <Text color={config.color}>
      {config.icon} {children}
    </Text>
  );
}
