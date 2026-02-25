import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { listOnboardedRepos } from '../../picker.js';

/**
 * Project browser — lists onboarded projects with an option to add a new one.
 * ↑/↓ to navigate, Enter to select, Esc to go back.
 */
export default function ProjectBrowser({ onSelectProject, onAddProject, onBack, _listOnboardedRepos }) {
  const listRepos = _listOnboardedRepos || listOnboardedRepos;
  const [selectedIndex, setSelectedIndex] = useState(0);

  let projects = [];
  let error = null;
  try {
    projects = listRepos();
  } catch (err) {
    error = err.message;
  }

  const items = [
    ...projects.map((p) => ({ type: 'project', label: p.repo || p.name, project: p })),
    { type: 'add', label: '+ Add Project' },
  ];

  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onBack();
      return;
    }
    if (error) return;
    if (key.upArrow) {
      setSelectedIndex((i) => Math.max(0, i - 1));
    } else if (key.downArrow) {
      setSelectedIndex((i) => Math.min(items.length - 1, i + 1));
    } else if (key.return) {
      const selected = items[selectedIndex];
      if (selected.type === 'add') {
        onAddProject();
      } else {
        onSelectProject(selected.project);
      }
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

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>Select a Project</Text>
      </Box>
      {items.map((item, i) => (
        <Box key={item.label}>
          <Text color="cyan">{i === selectedIndex ? '❯ ' : '  '}</Text>
          <Text bold={i === selectedIndex} color={item.type === 'add' ? 'green' : undefined}>
            {item.label}
          </Text>
        </Box>
      ))}
      <Box marginTop={1}>
        <Text dimColor>↑/↓ navigate · Enter select · Esc back</Text>
      </Box>
    </Box>
  );
}
