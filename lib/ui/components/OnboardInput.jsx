import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

/**
 * Inline text input for onboarding a new project.
 * User types a GitHub URL, owner/repo, or local path and presses Enter.
 * Esc to cancel.
 */
export default function OnboardInput({ terminalRows, onSubmit, onBack }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null); // null | 'onboarding' | 'done' | 'error'

  useInput((input, key) => {
    if (status === 'done' || status === 'error') {
      onBack();
      return;
    }
    if (status === 'onboarding') return;

    if (key.escape) {
      onBack();
      return;
    }
    if (key.return) {
      const trimmed = value.trim();
      if (!trimmed) {
        setError('Please enter a GitHub URL, owner/repo, or local path');
        return;
      }
      setStatus('onboarding');
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
          <Text bold>Add Project</Text>
        </Box>
        <Box>
          <Text>Enter a GitHub URL, owner/repo, or local path:</Text>
        </Box>
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
        {status === 'onboarding' && (
          <Box marginTop={1}>
            <Text color="yellow">Onboarding…</Text>
          </Box>
        )}
        {status === 'done' && (
          <Box marginTop={1}>
            <Text color="green">✓ Project onboarded successfully! Press any key to continue.</Text>
          </Box>
        )}
      </Box>
      <Box justifyContent="center">
        <Text dimColor>Enter submit · Esc cancel</Text>
      </Box>
    </Box>
  );
}
