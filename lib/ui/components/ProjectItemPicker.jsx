import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { fetchIssues, fetchPrs } from '../../picker.js';

/**
 * Project item picker — shows issues and PRs for a selected project.
 * Fetches data from GitHub on mount. ↑/↓ to navigate, Enter to dispatch, Esc to go back.
 */
export default function ProjectItemPicker({ project, onSelectItem, onBack, _fetchIssues, _fetchPrs }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const repo = project.repo || project.name;
  const _fi = _fetchIssues || fetchIssues;
  const _fp = _fetchPrs || fetchPrs;

  useEffect(() => {
    try {
      const issues = _fi(repo);
      const prs = _fp(repo);
      setData({ issues, prs });
    } catch (err) {
      setError(err.message);
    }
  }, [repo]);

  const items = data
    ? [
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
      onSelectItem(items[selectedIndex], repo);
    }
  });

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">✗ {error}</Text>
        <Box marginTop={1}>
          <Text dimColor>Esc back</Text>
        </Box>
      </Box>
    );
  }

  if (!data) {
    return (
      <Box>
        <Text dimColor>Loading issues and PRs for {repo}…</Text>
      </Box>
    );
  }

  if (items.length === 0) {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>{repo}</Text>
        </Box>
        <Text dimColor>No open issues or pull requests</Text>
        <Box marginTop={1}>
          <Text dimColor>Esc back</Text>
        </Box>
      </Box>
    );
  }

  let flatIndex = 0;

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>{repo}</Text>
        <Text> — select an issue or PR to dispatch</Text>
      </Box>

      {data.issues.length > 0 && (
        <Box flexDirection="column">
          <Text bold color="yellow">Issues</Text>
          {data.issues.map((issue) => {
            const idx = flatIndex++;
            const labels = issue.labels && issue.labels.length
              ? ` [${issue.labels.map((l) => l.name).join(', ')}]`
              : '';
            return (
              <Box key={`issue-${issue.number}`}>
                <Text color="cyan">{idx === selectedIndex ? '❯ ' : '  '}</Text>
                <Text bold={idx === selectedIndex}>
                  #{issue.number} {issue.title}{labels}
                </Text>
              </Box>
            );
          })}
        </Box>
      )}

      {data.prs.length > 0 && (
        <Box flexDirection="column" marginTop={data.issues.length > 0 ? 1 : 0}>
          <Text bold color="yellow">Pull Requests</Text>
          {data.prs.map((pr) => {
            const idx = flatIndex++;
            return (
              <Box key={`pr-${pr.number}`}>
                <Text color="cyan">{idx === selectedIndex ? '❯ ' : '  '}</Text>
                <Text bold={idx === selectedIndex}>
                  #{pr.number} {pr.title}
                </Text>
              </Box>
            );
          })}
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>↑/↓ navigate · Enter dispatch · Esc back</Text>
      </Box>
    </Box>
  );
}
