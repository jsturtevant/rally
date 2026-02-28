import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

/**
 * Inline text input for dispatching a new branch.
 * User types a task description and presses Enter.
 * Branch name is generated from the description.
 */
export default function BranchDispatchInput({ repo, terminalRows, onSubmit, onBack }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null); // null | 'dispatching' | 'done' | 'error'

  useInput((input, key) => {
    if (status === 'done' || status === 'error') {
      onBack();
      return;
    }
    if (status === 'dispatching') return;

    if (key.escape) {
      onBack();
      return;
    }
    if (key.return) {
      const trimmed = value.trim();
      if (!trimmed) {
        setError('Please describe the task');
        return;
      }
      setStatus('dispatching');
      setError(null);
      Promise.resolve(onSubmit(trimmed))
        .then(() => setStatus('done'))
        .catch((err) => {
          setError(err.message || String(err));
          setStatus('error');
        });
      return;
    }
    if (key.backspace || key.delete) {
      setValue((v) => v.slice(0, -1));
      setError(null);
      return;
    }
    if (input && !key.ctrl && !key.meta) {
      setValue((v) => v + input);
      setError(null);
    }
  });

  return (
    <Box flexDirection="column" justifyContent="space-between" borderStyle="round" borderColor="gray" paddingX={1} height={terminalRows}>
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>Dispatch New Branch</Text>
          <Text dimColor>  ({repo})</Text>
        </Box>
        <Text>Describe the task:</Text>
        <Box marginTop={1}>
          <Text color="cyan">❯ </Text>
          <Text>{value}</Text>
          <Text color="gray">█</Text>
        </Box>
        {error && (
          <Box marginTop={1}>
            <Text color="red">✗ {error}</Text>
          </Box>
        )}
        {status === 'dispatching' && (
          <Box marginTop={1}>
            <Text color="yellow">Creating worktree and launching Copilot…</Text>
          </Box>
        )}
        {status === 'done' && (
          <Box marginTop={1}>
            <Text color="green">✓ Branch dispatched! Press any key to continue.</Text>
          </Box>
        )}
      </Box>
      <Box justifyContent="center">
        <Text dimColor>Enter dispatch · Esc cancel</Text>
      </Box>
    </Box>
  );
}
