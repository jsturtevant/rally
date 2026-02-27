import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

/**
 * Inline multi-step onboard wizard.
 * Step 1: Enter repo URL/path
 * Step 2: Select team type (shared vs new project)
 * Step 3: If project team, enter team name
 * Then calls onSubmit(path, teamName) to run onboard.
 */
export default function OnboardInput({ terminalRows, onSubmit, onBack }) {
  const [step, setStep] = useState('path'); // 'path' | 'team' | 'teamName' | 'running'
  const [repoPath, setRepoPath] = useState('');
  const [teamChoice, setTeamChoice] = useState(0); // 0=shared, 1=project
  const [teamName, setTeamName] = useState('');
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null); // null | 'onboarding' | 'done' | 'error'

  const teamOptions = ['Use shared team', 'Create new project team'];

  function runOnboard(path, team) {
    setStep('running');
    setStatus('onboarding');
    setError(null);
    Promise.resolve(onSubmit(path, team))
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
      if (step === 'teamName') { setStep('team'); setError(null); return; }
      if (step === 'team') { setStep('path'); setError(null); return; }
      onBack();
      return;
    }

    if (step === 'path') {
      if (key.return) {
        const trimmed = repoPath.trim();
        if (!trimmed) { setError('Please enter a GitHub URL, owner/repo, or local path'); return; }
        setError(null);
        setStep('team');
        return;
      }
      if (key.backspace || key.delete) { setRepoPath((v) => v.slice(0, -1)); setError(null); return; }
      if (input && !key.ctrl && !key.meta) { setRepoPath((v) => v + input); setError(null); }
      return;
    }

    if (step === 'team') {
      if (key.upArrow) { setTeamChoice(0); return; }
      if (key.downArrow) { setTeamChoice(1); return; }
      if (key.return) {
        if (teamChoice === 0) {
          runOnboard(repoPath.trim(), null);
        } else {
          setStep('teamName');
        }
        return;
      }
      return;
    }

    if (step === 'teamName') {
      if (key.return) {
        const trimmed = teamName.trim();
        if (!trimmed) { setError('Team name is required'); return; }
        if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
          setError('Use only letters, numbers, hyphens, and underscores');
          return;
        }
        setError(null);
        runOnboard(repoPath.trim(), trimmed);
        return;
      }
      if (key.backspace || key.delete) { setTeamName((v) => v.slice(0, -1)); setError(null); return; }
      if (input && !key.ctrl && !key.meta) { setTeamName((v) => v + input); setError(null); }
    }
  });

  return (
    <Box flexDirection="column" justifyContent="space-between" borderStyle="round" borderColor="gray" paddingX={1} height={terminalRows}>
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>Add Project</Text>
        </Box>

        {/* Step 1: Repo path */}
        <Text>GitHub URL, owner/repo, or local path:</Text>
        <Box marginTop={step === 'path' ? 1 : 0}>
          <Text color="cyan">{step === 'path' ? '❯ ' : '  '}</Text>
          <Text dimColor={step !== 'path'}>{repoPath || (step === 'path' ? '' : '…')}</Text>
          {step === 'path' && <Text color="gray">█</Text>}
        </Box>

        {/* Step 2: Team type */}
        {(step === 'team' || step === 'teamName' || step === 'running') && (
          <Box flexDirection="column" marginTop={1}>
            <Text>Select team type:</Text>
            {teamOptions.map((opt, i) => (
              <Box key={opt}>
                <Text color="cyan">{step === 'team' && i === teamChoice ? '❯ ' : '  '}</Text>
                <Text bold={step === 'team' && i === teamChoice} dimColor={step !== 'team'}>
                  {opt}
                </Text>
              </Box>
            ))}
          </Box>
        )}

        {/* Step 3: Team name */}
        {(step === 'teamName' || (step === 'running' && teamName)) && (
          <Box flexDirection="column" marginTop={1}>
            <Text>Team name:</Text>
            <Box>
              <Text color="cyan">{step === 'teamName' ? '❯ ' : '  '}</Text>
              <Text dimColor={step !== 'teamName'}>{teamName}</Text>
              {step === 'teamName' && <Text color="gray">█</Text>}
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
          {step === 'team' ? '↑/↓ select · Enter confirm · Esc back' : 'Enter submit · Esc back'}
        </Text>
      </Box>
    </Box>
  );
}
