import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

/**
 * Onboard input — collects repo path and optional fork configuration.
 * Uses the shared team automatically (no team selection).
 * Calls onSubmit({ path, fork }) which triggers onboard with the given options.
 */
export default function OnboardInput({ terminalRows, onSubmit, onBack }) {
  const [step, setStep] = useState('path'); // 'path' | 'fork-toggle' | 'fork-input' | 'running'
  const [repoPath, setRepoPath] = useState('');
  const [isFork, setIsFork] = useState(false);
  const [forkValue, setForkValue] = useState(''); // owner/repo or empty for auto-detect
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null); // null | 'onboarding' | 'done' | 'error'

  function runOnboard() {
    setStep('running');
    setStatus('onboarding');
    setError(null);
    const opts = {
      path: repoPath.trim(),
      fork: isFork ? (forkValue.trim() || 'auto') : undefined,
    };
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
      if (step === 'fork-toggle') {
        setStep('path');
        return;
      }
      if (step === 'fork-input') {
        setStep('fork-toggle');
        return;
      }
      onBack();
      return;
    }

    if (step === 'path') {
      if (key.return) {
        const trimmed = repoPath.trim();
        if (!trimmed) { setError('Please enter a GitHub URL, owner/repo, or local path'); return; }
        setError(null);
        setStep('fork-toggle');
        return;
      }
      if (key.backspace || key.delete) { setRepoPath((v) => v.slice(0, -1)); setError(null); return; }
      if (input && !key.ctrl && !key.meta) { setRepoPath((v) => v + input); setError(null); }
      return;
    }

    if (step === 'fork-toggle') {
      if (key.leftArrow || key.rightArrow || input === ' ') {
        setIsFork((v) => !v);
        return;
      }
      if (key.return) {
        if (isFork) {
          setStep('fork-input');
        } else {
          runOnboard();
        }
        return;
      }
      return;
    }

    if (step === 'fork-input') {
      if (key.return) {
        // Empty fork value = auto-detect from GitHub username
        runOnboard();
        return;
      }
      if (key.backspace || key.delete) { setForkValue((v) => v.slice(0, -1)); setError(null); return; }
      if (input && !key.ctrl && !key.meta) { setForkValue((v) => v + input); setError(null); }
      return;
    }
  });

  const showPath = step === 'path' || step === 'fork-toggle' || step === 'fork-input' || step === 'running';
  const showForkToggle = step === 'fork-toggle' || step === 'fork-input' || step === 'running';
  const showForkInput = (step === 'fork-input' || step === 'running') && isFork;

  return (
    <Box flexDirection="column" justifyContent="space-between" borderStyle="round" borderColor="gray" paddingX={1} height={terminalRows}>
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>Add Project</Text>
        </Box>

        {/* Step 1: Repo path */}
        <Text dimColor={step !== 'path'}>GitHub URL, owner/repo, or local path:</Text>
        <Box marginTop={step === 'path' ? 1 : 0}>
          <Text color="cyan">{step === 'path' ? '❯ ' : '  '}</Text>
          <Text dimColor={step !== 'path'}>{repoPath || (step === 'path' ? '' : '…')}</Text>
          {step === 'path' && <Text color="gray">█</Text>}
        </Box>

        {/* Step 2: Fork toggle */}
        {showForkToggle && (
          <Box marginTop={1} flexDirection="column">
            <Text dimColor={step !== 'fork-toggle'}>This is a fork:</Text>
            <Box marginTop={step === 'fork-toggle' ? 1 : 0}>
              <Text color="cyan">{step === 'fork-toggle' ? '❯ ' : '  '}</Text>
              <Text color={isFork ? 'green' : 'gray'}>[{isFork ? '✓' : ' '}]</Text>
              <Text> {isFork ? 'Yes' : 'No'}</Text>
              {step === 'fork-toggle' && <Text dimColor>  (←/→ or space to toggle)</Text>}
            </Box>
          </Box>
        )}

        {/* Step 3: Fork URL (optional) */}
        {showForkInput && (
          <Box marginTop={1} flexDirection="column">
            <Text dimColor={step !== 'fork-input'}>Your fork (owner/repo) or leave empty for auto-detect:</Text>
            <Box marginTop={step === 'fork-input' ? 1 : 0}>
              <Text color="cyan">{step === 'fork-input' ? '❯ ' : '  '}</Text>
              <Text dimColor={step !== 'fork-input'}>{forkValue || (step === 'fork-input' ? '' : '(auto)')}</Text>
              {step === 'fork-input' && <Text color="gray">█</Text>}
            </Box>
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
          {step === 'fork-toggle' && 'Enter continue · ←/→ toggle · Esc back'}
          {step === 'fork-input' && 'Enter submit · Esc back'}
          {step === 'running' && ''}
        </Text>
      </Box>
    </Box>
  );
}
