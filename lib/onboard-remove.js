import { existsSync, lstatSync } from 'node:fs';
import { join, resolve } from 'node:path';
import chalk from 'chalk';
import { readProjects, writeProjects } from './config.js';
import { removeSymlink } from './symlink.js';
import { removeExcludes, getExcludeEntries } from './exclude.js';

/**
 * Remove an onboarded project from Rally.
 * Removes the project entry from projects.yaml, cleans up symlinks,
 * and removes exclude entries from .git/info/exclude.
 *
 * @param {object} [options]
 * @param {string} [options.project] - Project name to remove (interactive picker if omitted)
 * @param {boolean} [options.yes] - Skip confirmation prompt
 * @param {Function} [options._select] - Injectable select function (for testing)
 * @param {Function} [options._confirm] - Injectable confirm function (for testing)
 * @param {Function} [options._readProjects] - Injectable for testing
 * @param {Function} [options._writeProjects] - Injectable for testing
 * @param {object} [options._chalk] - Injectable for testing
 * @returns {Promise<object|null>} The removed project entry, or null if cancelled
 */
export async function onboardRemove(options = {}) {
  const _readProjects = options._readProjects || readProjects;
  const _writeProjects = options._writeProjects || writeProjects;
  const _chalk = options._chalk || chalk;

  const projects = _readProjects();
  const projectList = projects.projects || [];

  if (projectList.length === 0) {
    throw new Error('No onboarded projects found.');
  }

  let project;

  if (options.project) {
    // Find by name or repo
    project = projectList.find(
      (p) => p.name === options.project || p.repo === options.project
    );
    if (!project) {
      throw new Error(
        `Project "${options.project}" not found. Run ${_chalk.dim('rally onboard remove')} to see available projects.`
      );
    }
  } else {
    // Interactive picker
    const selectFn = options._select || (await import('@inquirer/prompts')).select;
    const choices = [
      ...projectList.map((p) => ({
        name: `${p.name}${p.repo ? ` (${p.repo})` : ''} — ${p.path}`,
        value: p.name,
      })),
      { name: '← Cancel', value: null },
    ];
    const selected = await selectFn({
      message: 'Select a project to remove:',
      choices,
    });
    if (selected === null) return null;
    project = projectList.find((p) => p.name === selected);
  }

  // Confirm removal
  if (!options.yes) {
    const confirmFn = options._confirm || (await import('@inquirer/prompts')).confirm;
    const confirmed = await confirmFn({
      message: `Remove "${project.name}"${project.repo ? ` (${project.repo})` : ''} from Rally?`,
      default: false,
    });
    if (!confirmed) {
      console.log(_chalk.dim('Cancelled.'));
      return null;
    }
  }

  // Clean up symlinks if project path still exists
  const projectPath = project.path;
  if (projectPath && existsSync(projectPath)) {
    const symlinks = [
      join(projectPath, '.squad'),
      join(projectPath, '.squad-templates'),
      join(projectPath, '.github', 'agents', 'squad.agent.md'),
    ];
    for (const linkPath of symlinks) {
      try {
        if (existsSync(linkPath) || lstatSync(linkPath).isSymbolicLink()) {
          removeSymlink(linkPath);
        }
      } catch {
        // Symlink may already be gone
      }
    }

    // Remove exclude entries from .git/info/exclude
    const gitDir = join(projectPath, '.git');
    if (existsSync(gitDir)) {
      try {
        const excludeEntries = getExcludeEntries();
        const allExcludes = [...excludeEntries, '.worktrees/', '.worktrees'];
        removeExcludes(gitDir, allExcludes);
      } catch {
        // Best effort — exclude file may not exist
      }
    }
  }

  // Remove from projects.yaml
  projects.projects = projectList.filter((p) => p.name !== project.name);
  _writeProjects(projects);

  console.log(
    _chalk.green('✓') + ` Removed project: ${project.name}${project.repo ? ` (${project.repo})` : ''}`
  );
  return project;
}
