import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

/**
 * Onboard input — collects repo path and optional fork configuration.
 * Uses the shared team automatically (no team selection).
 * Simplified 2-step flow: path → fork toggle (with auto-detect).
 * Calls onSubmit({ path, fork }) which triggers onboard with the given options.
 */
export default function OnboardInput({ terminalRows, onSubmit, onBack }) {
  const [step, setStep] = useState('path'); // 'path' | 'fork' | 'running'
  const [repoPath, setRepoPath] = useState('');
  const [isFork, setIsFork] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null); // null | 'onboarding' | 'done' | 'error'

  function runOnboard() {
    setStep('running');
    setStatus('onboarding');
    setError(null);
    const opts = {
      path: repoPath.trim(),
      fork: isFork ? 'auto' : undefined, // 'auto' triggers username detection
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
      if (step === 'fork') {
        setStep('path');
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
        setStep('fork');
        return;
      }
      if (key.backspace || key.delete) { setRepoPath((v) => v.slice(0, -1)); setError(null); return; }
      if (input && !key.ctrl && !key.meta) { setRepoPath((v) => v + input); setError(null); }
      return;
    }

    if (step === 'fork') {
      if (key.leftArrow || key.rightArrow || input === ' ') {
        setIsFork((v) => !v);
        return;
      }
      if (key.return) {
        runOnboard();
        return;
      }
      return;
    }
  });

  const showPath = step === 'path' || step === 'fork' || step === 'running';
  const showFork = step === 'fork' || step === 'running';

  return (
    <Box flexDirection="column" justifyContent="space-between" borderStyle="round" borderColor="gray" paddingX={1} height={terminalRows}>
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>Add Project</Text>
        </Box>

        {/* Step 1: Repo path */}
        <Text dimColor={step !== 'path'}>Upstream repository (GitHub URL, owner/repo, or local path):</Text>
        <Box marginTop={step === 'path' ? 1 : 0}>
          <Text color="cyan">{step === 'path' ? '❯ ' : '  '}</Text>
          <Text dimColor={step !== 'path'}>{repoPath || (step === 'path' ? '' : '…')}</Text>
          {step === 'path' && <Text color="gray">█</Text>}
        </Box>

        {/* Step 2: Fork toggle with explanation */}
        {showFork && (
          <Box marginTop={1} flexDirection="column">
            <Box>
              <Text dimColor={step !== 'fork'}>Contributing via your fork?</Text>
              {step === 'fork' && <Text dimColor>  (Sets origin → your-username/repo, upstream → original)</Text>}
            </Box>
            <Box marginTop={step === 'fork' ? 1 : 0}>
              <Text color="cyan">{step === 'fork' ? '❯ ' : '  '}</Text>
              <Text color={isFork ? 'green' : 'gray'}>[{isFork ? '✓' : ' '}]</Text>
              <Text> {isFork ? 'Yes — auto-detect my fork' : 'No — clone directly'}</Text>
              {step === 'fork' && <Text dimColor>  (←/→ or space)</Text>}
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
          {step === 'fork' && 'Enter submit · ←/→ toggle · Esc back'}
          {step === 'running' && ''}
        </Text>
      </Box>
    </Box>
  );
}
