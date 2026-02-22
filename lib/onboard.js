import { existsSync, mkdirSync, realpathSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import chalk from 'chalk';
import { readConfig, readProjects, writeProjects } from './config.js';
import { createSymlink } from './symlink.js';
import { addExcludes, getExcludeEntries } from './exclude.js';

/**
 * Onboard a local repo to Rally (shared team).
 * Creates symlinks from team dir into the project, adds .git/info/exclude entries,
 * and registers the project in projects.yaml.
 *
 * @param {object} options
 * @param {string} [options.path] - Path to the repo (defaults to cwd)
 */
export async function onboard(options = {}) {
  const projectPath = resolve(options.path || process.cwd());

  // Verify it's a git repo
  const gitDir = join(projectPath, '.git');
  if (!existsSync(gitDir)) {
    throw new Error('Not a git repository. Run from inside a repo or provide a path to one.');
  }

  // Read config to find team directory
  const config = readConfig();
  if (!config) {
    throw new Error('No team directory found. Run: rally setup');
  }

  const teamDir = config.teamDir;
  if (!teamDir || !existsSync(teamDir)) {
    throw new Error(`Team directory missing: ${teamDir || '(not configured)'}. Run: rally setup`);
  }

  // Check if already fully onboarded (idempotent)
  const projectName = basename(projectPath);
  const projects = readProjects();
  const existing = (projects.projects || []).find(
    (p) => realpathSync(p.path) === realpathSync(projectPath)
  );

  // Define symlink mappings: [linkRelPath, targetRelPath]
  const symlinks = [
    ['.squad', join(teamDir, '.squad')],
    ['.github/agents/squad.agent.md', join(teamDir, '.github', 'agents', 'squad.agent.md')],
  ];

  // Create symlinks
  for (const [linkRel, target] of symlinks) {
    const linkPath = join(projectPath, linkRel);
    const parentDir = join(linkPath, '..');
    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true });
    }

    if (existsSync(linkPath)) {
      console.log(`  ${linkRel} already exists — skipping`);
    } else {
      createSymlink(target, linkPath);
      console.log(chalk.green('✓') + ` Symlinked ${linkRel} → ${target}`);
    }
  }

  // Add exclude entries
  const excludeEntries = getExcludeEntries();
  // Also exclude .worktrees/
  const allExcludes = [...excludeEntries, '.worktrees/', '.worktrees'];
  addExcludes(gitDir, allExcludes);
  console.log(chalk.green('✓') + ` Updated .git/info/exclude`);

  // Register in projects.yaml
  if (existing) {
    console.log(`  Project already registered — skipping`);
  } else {
    const entry = {
      name: projectName,
      path: projectPath,
      team: 'shared',
      teamDir,
      onboarded: new Date().toISOString(),
    };
    projects.projects = projects.projects || [];
    projects.projects.push(entry);
    writeProjects(projects);
    console.log(chalk.green('✓') + ` Registered project: ${projectName} (shared team)`);
  }
}
