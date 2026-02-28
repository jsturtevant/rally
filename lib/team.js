import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { getConfigDir } from './config.js';
import { initSquad } from './squad-sdk.js';

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
 * @param {Function} [options._initSquad] - Injectable initSquad function (for testing)
 * @param {Function} [options._select] - Injectable select function (for testing)
 * @param {Function} [options._input] - Injectable input function (for testing)
 * @param {object} [options._chalk] - Injectable chalk instance (for testing)
 * @returns {Promise<{ teamDir: string, teamType: string }>}
 */
export async function selectTeam(options = {}) {
  const configDir = getConfigDir();
  const teamsDir = join(configDir, 'teams');
  const _initSquad = options._initSquad || initSquad;
  const _chalk = options._chalk || chalk;
  const promptSelect = options._select || (await import('@inquirer/prompts')).select;
  const promptInput = options._input || (await import('@inquirer/prompts')).input;

  // If --team flag provided, use that team directly
  if (options.team) {
    if (!isValidTeamName(options.team)) {
      throw new Error(
        `Invalid team name: "${options.team}". Use only letters, numbers, hyphens, and underscores.`
      );
    }
    const teamDir = join(teamsDir, options.team);
    const isNew = !existsSync(teamDir) || !existsSync(join(teamDir, '.squad'));
    if (isNew) {
      await initTeamDir(teamDir, _initSquad, _chalk);
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
  if (existsSync(teamDir) && existsSync(join(teamDir, '.squad'))) {
    console.log(`  Team "${teamName.trim()}" already exists — using it`);
  } else {
    await initTeamDir(teamDir, _initSquad, _chalk);
  }

  return { teamDir, teamType: 'project' };
}

/**
 * Initialize a new team directory with Squad.
 */
async function initTeamDir(teamDir, _initSquad, _chalk) {
  mkdirSync(teamDir, { recursive: true });
  console.log(_chalk.green('✓') + ` Created team directory: ${teamDir}`);

  const squadDir = join(teamDir, '.squad');
  if (!existsSync(squadDir)) {
    try {
      await _initSquad({ teamRoot: teamDir });
      console.log(_chalk.green('✓') + ` Initialized Squad in ${teamDir}`);
    } catch (err) {
      const detail = err && err.message ? `: ${err.message}` : '';
      console.error(_chalk.yellow('⚠') + ` Squad not initialized — run Squad manually in ${teamDir} if needed${detail}`);
    }
  }
}
