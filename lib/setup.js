import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { getConfigDir, readConfig, writeConfig, ensureConfigDir } from './config.js';
import { DEFAULT_DENY_TOOLS } from './copilot.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

/**
 * Ensure Rally is set up. Runs automatically before commands that need it.
 * Creates ~/rally/, ~/rally/projects/, and config.yaml if missing.
 * Silent if already set up; prints "Running setup..." to stderr if initializing.
 *
 * @param {object} [options]
 * @param {object} [options._chalk] - Injectable chalk instance (for testing)
 * @returns {boolean} true if setup was needed, false if already configured
 */
export function ensureSetup(options = {}) {
  const _chalk = options._chalk || chalk;
  const configDir = getConfigDir();
  const configPath = join(configDir, 'config.yaml');

  // If config.yaml exists and has required fields, we're already set up
  const existing = readConfig();
  if (existing && existing.projectsDir && existsSync(existing.projectsDir)) {
    return false;
  }

  // Need to run setup — print to stderr to avoid interfering with JSON output
  console.error(_chalk.cyan('Running setup...'));

  // Ensure base config directory exists with restricted permissions
  ensureConfigDir();

  // Create projects directory
  const projectsDir = join(configDir, 'projects');
  if (!existsSync(projectsDir)) {
    mkdirSync(projectsDir, { recursive: true });
    console.error(_chalk.green('✓') + ` Created projects directory at ${projectsDir}`);
  }

  // Write config.yaml (merge with existing to preserve user settings)
  const existingSettings = (existing && existing.settings) || {};
  const config = {
    ...existing,
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
  console.error(_chalk.green('✓') + ` Saved config to ${configPath}`);

  return true;
}
