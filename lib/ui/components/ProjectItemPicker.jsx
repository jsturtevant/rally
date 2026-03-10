import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { fetchIssues, fetchPrs } from '../../picker.js';

/**
 * Project item picker — shows issues and PRs for a selected project.
 * Fetches data from GitHub on mount. ↑/↓ to navigate, Enter to dispatch, Esc to go back.
 */
function resolveRepo(project) {
  const repo = project.repo;
  if (!repo || !repo.includes('/')) return null;
  return repo;
}

export default function ProjectItemPicker({ project, onSelectItem, onNewBranch, onBack, terminalRows, _fetchIssues, _fetchPrs }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [warnings, setWarnings] = useState([]);

  const repo = resolveRepo(project);
  const _fi = _fetchIssues || fetchIssues;
  const _fp = _fetchPrs || fetchPrs;

  useEffect(() => {
    if (!repo) {
      setError(`Invalid repo format: "${project.repo || project.name}". Expected "owner/repo".`);
      return;
    }
    const w = [];
    let issues = [];
    let prs = [];
    try {
      issues = _fi(repo);
    } catch (err) {
      w.push(err.message);
    }
    try {
      prs = _fp(repo);
    } catch (err) {
      w.push(err.message);
    }
    setWarnings(w);
    setData({ issues, prs });
  }, [repo, _fi, _fp]);

  const items = data
    ? [
        { itemType: 'new-branch', label: '+ Dispatch new branch' },
        ...data.issues.map((i) => ({ ...i, itemType: 'issue' })),
        ...data.prs.map((p) => ({ ...p, itemType: 'pr' })),
      ]
    : [];

  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onBack();
      return;
    }
    if (!data || items.length === 0) return;
    if (key.upArrow) {
      setSelectedIndex((i) => Math.max(0, i - 1));
    } else if (key.downArrow) {
      setSelectedIndex((i) => Math.min(items.length - 1, i + 1));
    } else if (key.return) {
      const selected = items[selectedIndex];
      if (selected.itemType === 'new-branch') {
        if (onNewBranch) onNewBranch(repo);
      } else {
        onSelectItem(selected, repo);
      }
    }
  });

  if (error) {
    return (
      <Box flexDirection="column" justifyContent="space-between" borderStyle="round" borderColor="gray" paddingX={1} height={terminalRows}>
        <Box flexDirection="column">
          <Text color="red">✗ {error}</Text>
        </Box>
        <Box justifyContent="center">
          <Text dimColor>Esc back</Text>
        </Box>
      </Box>
    );
  }

  if (!data) {
    return (
      <Box flexDirection="column" justifyContent="space-between" borderStyle="round" borderColor="gray" paddingX={1} height={terminalRows}>
        <Box flexDirection="column">
          <Text dimColor>Loading issues and PRs for {repo}…</Text>
        </Box>
        <Box justifyContent="center">
          <Text dimColor>Esc back</Text>
        </Box>
      </Box>
    );
  }

  const hasIssuePrs = data && (data.issues.length > 0 || data.prs.length > 0);

  if (data && !hasIssuePrs) {
    return (
      <Box flexDirection="column" justifyContent="space-between" borderStyle="round" borderColor="gray" paddingX={1} height={terminalRows}>
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text bold>{repo}</Text>
          </Box>
          {warnings.length > 0
            ? warnings.map((w, i) => <Text key={i} color="yellow">⚠ {w}</Text>)
            : <Text dimColor>No open issues or pull requests</Text>
          }
          <Box marginTop={1}>
            <Text color="cyan">{selectedIndex === 0 ? '❯ ' : '  '}</Text>
            <Text bold={selectedIndex === 0} color="green">+ Dispatch new branch</Text>
          </Box>
        </Box>
        <Box justifyContent="center">
          <Text dimColor>Enter dispatch · Esc back</Text>
        </Box>
      </Box>
    );
  }

  // items[0] is always 'new-branch', followed by issues, then PRs
  const newBranchIdx = 0;
  let flatIndex = 1; // start after new-branch

  return (
    <Box flexDirection="column" justifyContent="space-between" borderStyle="round" borderColor="gray" paddingX={1} height={terminalRows}>
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>{repo}</Text>
          <Text> — select an issue, PR, or start a new branch</Text>
        </Box>

        {warnings.map((w, i) => <Text key={`warn-${i}`} color="yellow">⚠ {w}</Text>)}

        <Box>
          <Text color="cyan">{selectedIndex === newBranchIdx ? '❯ ' : '  '}</Text>
          <Text bold={selectedIndex === newBranchIdx} color="green">+ Dispatch new branch</Text>
        </Box>

        {data.issues.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text bold color="yellow">Issues</Text>
            {data.issues.map((issue) => {
              const idx = flatIndex++;
              const labels = issue.labels && issue.labels.length
                ? ` [${issue.labels.map((l) => l.name).join(', ')}]`
                : '';
              return (
                <Box key={`issue-${issue.number}`}>
                  <Text color="cyan">{idx === selectedIndex ? '❯ ' : '  '}</Text>
                  <Text bold={idx === selectedIndex} wrap="truncate">
                    #{issue.number} {issue.title}{labels}
                  </Text>
                </Box>
              );
            })}
          </Box>
        )}

        {data.prs.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text bold color="yellow">Pull Requests</Text>
            {data.prs.map((pr) => {
              const idx = flatIndex++;
              return (
                <Box key={`pr-${pr.number}`}>
                  <Text color="cyan">{idx === selectedIndex ? '❯ ' : '  '}</Text>
                  <Text bold={idx === selectedIndex} wrap="truncate">
                    #{pr.number} {pr.title}
                  </Text>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>

      <Box justifyContent="center">
        <Text dimColor>↑/↓ navigate · Enter dispatch · Esc back</Text>
      </Box>
    </Box>
  );
}
