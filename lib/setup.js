import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { getConfigDir, readConfig, writeConfig, ensureConfigDir } from './config.js';
import { DEFAULT_DENY_TOOLS } from './copilot.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

/**
 * Runs the rally setup command.
 * Creates ~/rally/team/ and ~/rally/projects/, runs Squad init, writes config.yaml.
 * Idempotent — skips existing directories with a message.
 *
 * @param {object} options
 * @param {string} [options.dir] - Custom team directory path
 * @param {Function} [options._exec] - Injectable exec function (for testing)
 */
export async function setup(options = {}) {
  const configDir = getConfigDir();
  const teamDir = options.dir || join(configDir, 'team');
  const projectsDir = join(configDir, 'projects');
  const exec = options._exec || execFileSync;

  // Ensure base config directory exists with restricted permissions
  ensureConfigDir();

  // Create team directory
  if (existsSync(teamDir)) {
    console.log(`  Team directory already exists — skipping`);
  } else {
    mkdirSync(teamDir, { recursive: true });
    console.log(chalk.green('✓') + ` Created team directory at ${teamDir}`);
  }

  // Create projects directory
  if (existsSync(projectsDir)) {
    console.log(`  Projects directory already exists — skipping`);
  } else {
    mkdirSync(projectsDir, { recursive: true });
    console.log(chalk.green('✓') + ` Created projects directory at ${projectsDir}`);
  }

  // Run Squad init in team directory (skip if .squad/ already exists)
  const squadDir = join(teamDir, '.squad');
  if (existsSync(squadDir)) {
    console.log(`  Squad already initialized — skipping`);
  } else {
    const spinner = (await import('ora')).default('Initializing Squad...').start();
    try {
      exec('npx', ['github:bradygaster/squad#v0.5.2'], {
        cwd: teamDir,
        stdio: 'pipe',
      });
      spinner.succeed('Initialized Squad in ' + teamDir);
    } catch (err) {
      const detail = err && err.message ? `: ${err.message}` : '';
      spinner.warn(`Squad not initialized — will be set up per-project during \`rally onboard\`${detail}`);
    }
  }

  // Write config.yaml (merge with existing to preserve user settings)
  const existing = readConfig() || {};
  const existingSettings = existing.settings || {};
  const config = {
    ...existing,
    teamDir,
    projectsDir,
    version: pkg.version,
    settings: {
      ...existingSettings,
      deny_tools_copilot: (Array.isArray(existingSettings.deny_tools_copilot) && existingSettings.deny_tools_copilot.length > 0)
        ? existingSettings.deny_tools_copilot : [...DEFAULT_DENY_TOOLS],
      deny_tools_sandbox: (Array.isArray(existingSettings.deny_tools_sandbox) && existingSettings.deny_tools_sandbox.length > 0)
        ? existingSettings.deny_tools_sandbox : [...DEFAULT_DENY_TOOLS],
    },
  };
  writeConfig(config);
  console.log(chalk.green('✓') + ` Saved config to ${join(configDir, 'config.yaml')}`);
}
