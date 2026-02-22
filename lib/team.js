import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { select, input } from '@inquirer/prompts';
import chalk from 'chalk';
import { getConfigDir } from './config.js';

/**
 * Validate a team name: alphanumeric, hyphens, underscores only.
 * @param {string} name
 * @returns {boolean}
 */
function isValidTeamName(name) {
  return /^[a-zA-Z0-9_-]+$/.test(name);
}

/**
 * Select or create a team directory for onboarding.
 *
 * @param {object} options
 * @param {string} [options.team] - Team name (skips prompt if provided)
 * @param {Function} [options._exec] - Injectable exec function (for testing)
 * @param {Function} [options._select] - Injectable select function (for testing)
 * @param {Function} [options._input] - Injectable input function (for testing)
 * @returns {Promise<{ teamDir: string, teamType: string }>}
 */
export async function selectTeam(options = {}) {
  const configDir = getConfigDir();
  const teamsDir = join(configDir, 'teams');
  const exec = options._exec || execFileSync;
  const promptSelect = options._select || select;
  const promptInput = options._input || input;

  // If --team flag provided, use that team directly
  if (options.team) {
    if (!isValidTeamName(options.team)) {
      throw new Error(
        `Invalid team name: "${options.team}". Use only letters, numbers, hyphens, and underscores.`
      );
    }
    const teamDir = join(teamsDir, options.team);
    const isNew = !existsSync(teamDir);
    if (isNew) {
      await initTeamDir(teamDir, exec);
    }
    return { teamDir, teamType: 'project' };
  }

  // Interactive prompt
  const choice = await promptSelect({
    message: 'Select team type:',
    choices: [
      { name: 'Use shared team', value: 'shared' },
      { name: 'Create new project team', value: 'project' },
    ],
    default: 'shared',
  });

  if (choice === 'shared') {
    // Use the default shared team from config
    const sharedTeamDir = join(configDir, 'team');
    if (!existsSync(sharedTeamDir)) {
      throw new Error('Shared team directory not found. Run: rally setup');
    }
    return { teamDir: sharedTeamDir, teamType: 'shared' };
  }

  // New project team
  const teamName = await promptInput({
    message: 'Team name:',
    validate: (val) => {
      if (!val || !val.trim()) return 'Team name is required.';
      if (!isValidTeamName(val.trim())) {
        return 'Use only letters, numbers, hyphens, and underscores.';
      }
      return true;
    },
  });

  const teamDir = join(teamsDir, teamName.trim());
  if (existsSync(teamDir)) {
    console.log(`  Team "${teamName.trim()}" already exists — using it`);
  } else {
    await initTeamDir(teamDir, exec);
  }

  return { teamDir, teamType: 'project' };
}

/**
 * Initialize a new team directory with Squad.
 */
async function initTeamDir(teamDir, exec) {
  mkdirSync(teamDir, { recursive: true });
  console.log(chalk.green('✓') + ` Created team directory: ${teamDir}`);

  const squadDir = join(teamDir, '.squad');
  if (!existsSync(squadDir)) {
    try {
      exec('npx', ['github:bradygaster/squad'], {
        cwd: teamDir,
        stdio: 'pipe',
      });
      console.log(chalk.green('✓') + ` Initialized Squad in ${teamDir}`);
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new Error('npx not found. Ensure Node.js and npm are installed and on your PATH.');
      }
      throw new Error(`Squad init failed in ${teamDir}: ${err.message}`);
    }
  }
}
