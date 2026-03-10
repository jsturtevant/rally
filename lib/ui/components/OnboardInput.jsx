import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

/**
 * Onboard input — collects repo path and optional fork configuration.
 * Simple 2-step flow:
 *   1. Repo path (text input)
 *   2. "Is this a fork? (y/n)" — single character input
 * Calls onSubmit({ path, fork: 'auto' }) if fork=yes, or onSubmit({ path }) if fork=no.
 */
export default function OnboardInput({ terminalRows, onSubmit, onBack }) {
  const [step, setStep] = useState('path'); // 'path' | 'fork' | 'running'
  const [repoPath, setRepoPath] = useState('');
  const [forkAnswer, setForkAnswer] = useState('');
  const [isFork, setIsFork] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null); // null | 'onboarding' | 'done' | 'error'

  function runOnboard(useFork) {
    setStep('running');
    setStatus('onboarding');
    setError(null);
    const opts = useFork
      ? { path: repoPath.trim(), fork: 'auto' }
      : { path: repoPath.trim() };
    Promise.resolve(onSubmit(opts))
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
      if (step === 'fork') {
        setStep('path');
        setForkAnswer('');
        return;
      }
      onBack();
      return;
    }

    if (step === 'path') {
      if (key.return) {
        const trimmed = repoPath.trim();
        if (!trimmed) {
          setError('Please enter a GitHub URL, owner/repo, or local path');
          return;
        }
        setError(null);
        setStep('fork');
        return;
      }
      if (key.backspace || key.delete) {
        setRepoPath((v) => v.slice(0, -1));
        setError(null);
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setRepoPath((v) => v + input);
        setError(null);
      }
      return;
    }

    if (step === 'fork') {
      if (key.return) {
        const answer = forkAnswer.trim().toLowerCase();
        if (answer === 'y' || answer === 'yes') {
          setIsFork(true);
          runOnboard(true);
        } else if (answer === 'n' || answer === 'no') {
          setIsFork(false);
          runOnboard(false);
        } else {
          setError('Please enter y or n');
        }
        return;
      }
      if (key.backspace || key.delete) {
        setForkAnswer((v) => v.slice(0, -1));
        setError(null);
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setForkAnswer((v) => v + input);
        setError(null);
      }
      return;
    }
  });

  const isRunning = step === 'running';

  return (
    <Box flexDirection="column" justifyContent="space-between" borderStyle="round" borderColor="gray" paddingX={1} height={terminalRows}>
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>Add Project</Text>
        </Box>

        {/* Step 1: Repo path input */}
        <Text dimColor={step !== 'path' || isRunning}>Upstream repository (GitHub URL, owner/repo, or local path):</Text>
        <Box marginTop={step === 'path' && !isRunning ? 1 : 0}>
          <Text color="cyan">{step === 'path' && !isRunning ? '❯ ' : '  '}</Text>
          <Text dimColor={step !== 'path' || isRunning}>{repoPath || (step === 'path' && !isRunning ? '' : '…')}</Text>
          {step === 'path' && !isRunning && <Text color="gray">█</Text>}
        </Box>

        {/* Step 2: Fork question (y/n) */}
        {step === 'fork' && (
          <Box marginTop={1} flexDirection="column">
            <Text>Is this a fork? (y/n):</Text>
            <Box marginTop={1}>
              <Text color="cyan">❯ </Text>
              <Text>{forkAnswer}</Text>
              <Text color="gray">█</Text>
            </Box>
          </Box>
        )}

        {/* Running state — show summary */}
        {isRunning && (
          <Box marginTop={1} flexDirection="column">
            <Text dimColor>Fork: {isFork ? 'auto-detect' : 'No'}</Text>
          </Box>
        )}

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
        <Text dimColor>
          {step === 'path' && 'Enter continue · Esc back'}
          {step === 'fork' && 'Enter submit · Esc back'}
          {step === 'running' && (status === 'error' ? 'Press any key to continue' : '')}
        </Text>
      </Box>
    </Box>
  );
}
