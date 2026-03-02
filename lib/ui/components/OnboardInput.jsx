import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

/**
 * Simplified onboard input — collects repo path only.
 * Uses the shared team automatically (no team selection).
 * Calls onSubmit(path) which triggers onboard with default shared team.
 */
export default function OnboardInput({ terminalRows, onSubmit, onBack }) {
  const [step, setStep] = useState('path'); // 'path' | 'running'
  const [repoPath, setRepoPath] = useState('');
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null); // null | 'onboarding' | 'done' | 'error'

  function runOnboard(path) {
    setStep('running');
    setStatus('onboarding');
    setError(null);
    Promise.resolve(onSubmit(path))
      .then(() => setStatus('done'))
      .catch((err) => {
        setError(err.message || String(err));
        setStatus('error');
      });
  }

  useInput((input, key) => {
    if (status === 'done' || status === 'error') {
      onBack();
      return;
    }
    if (step === 'running') return;

    if (key.escape) {
      onBack();
      return;
    }

    if (step === 'path') {
      if (key.return) {
        const trimmed = repoPath.trim();
        if (!trimmed) { setError('Please enter a GitHub URL, owner/repo, or local path'); return; }
        setError(null);
        runOnboard(trimmed);
        return;
      }
      if (key.backspace || key.delete) { setRepoPath((v) => v.slice(0, -1)); setError(null); return; }
      if (input && !key.ctrl && !key.meta) { setRepoPath((v) => v + input); setError(null); }
    }
  });

  return (
    <Box flexDirection="column" justifyContent="space-between" borderStyle="round" borderColor="gray" paddingX={1} height={terminalRows}>
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>Add Project</Text>
        </Box>

        <Text>GitHub URL, owner/repo, or local path:</Text>
        <Box marginTop={step === 'path' ? 1 : 0}>
          <Text color="cyan">{step === 'path' ? '❯ ' : '  '}</Text>
          <Text dimColor={step !== 'path'}>{repoPath || (step === 'path' ? '' : '…')}</Text>
          {step === 'path' && <Text color="gray">█</Text>}
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
        <Text dimColor>Enter submit · Esc back</Text>
      </Box>
    </Box>
  );
}
