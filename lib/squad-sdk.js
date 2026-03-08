/**
 * Squad SDK exports
 *
 * This module re-exports the Squad SDK functions used by Rally.
 */

import { existsSync } from 'node:fs';
import { confirm, select, input } from '@inquirer/prompts';
import chalk from 'chalk';

import {
  initSquad,
  setupConsultMode,
  extractLearnings,
  resolveGlobalSquadPath,
  getPersonalSquadRoot,
  ensureSquadPath,
  isConsultMode,
  PersonalSquadNotFoundError
} from '@bradygaster/squad-sdk';

export {
  initSquad,
  setupConsultMode,
  extractLearnings,
  resolveGlobalSquadPath,
  getPersonalSquadRoot,
  ensureSquadPath,
  isConsultMode,
  PersonalSquadNotFoundError
};

/**
 * Check if the personal squad exists.
 * @returns {boolean}
 */
export function personalSquadExists() {
  return existsSync(getPersonalSquadRoot());
}

/**
 * Core squad roles that are always included.
 */
const CORE_ROLES = [
  { name: 'lead', role: 'lead', description: 'Scope, decisions, code review', emoji: '🏗️' },
  { name: 'scribe', role: 'scribe', description: 'Memory, decisions, session logs', emoji: '📋' },
];

/**
 * Optional squad roles user can add.
 */
const OPTIONAL_ROLES = [
  { name: 'developer', role: 'developer', description: 'Code implementation, refactoring', emoji: '🔧' },
  { name: 'frontend', role: 'frontend', description: 'UI, components, styling', emoji: '⚛️' },
  { name: 'backend', role: 'backend', description: 'APIs, database, services', emoji: '🔧' },
  { name: 'tester', role: 'tester', description: 'Tests, quality, edge cases', emoji: '🧪' },
  { name: 'devops', role: 'devops', description: 'CI/CD, infrastructure, deployment', emoji: '⚙️' },
  { name: 'docs', role: 'docs', description: 'Documentation, technical writing', emoji: '📝' },
  { name: 'security', role: 'security', description: 'Security audits, auth, compliance', emoji: '🔒' },
];

/** Squad documentation URL */
const SQUAD_DOCS_URL = 'https://github.com/bradygaster/squad';

/**
 * Team presets for quick squad creation.
 */
const TEAM_PRESETS = [
  {
    key: 'full',
    name: 'Full team',
    description: 'Developer, Frontend, Backend, Tester, Security, DevOps, Docs',
    roles: ['developer', 'frontend', 'backend', 'tester', 'security', 'devops', 'docs'],
  },
  {
    key: 'custom',
    name: 'Custom',
    description: 'Pick exactly which roles you want',
    roles: [],
  },
];

/**
 * Interactively create a personal squad with user-selected team members.
 *
 * @param {object} [options]
 * @param {Function} [options._initSquad] - Injectable initSquad (for testing)
 * @param {Function} [options._select] - Injectable select (for testing)
 * @param {Function} [options._checkbox] - Injectable checkbox (for testing)
 * @param {Function} [options._input] - Injectable input (for testing)
 * @param {Function} [options._chalk] - Injectable chalk (for testing)
 * @param {boolean} [options._skipBanner] - Skip the banner (already shown by caller)
 * @returns {Promise<{ success: boolean, createdFiles?: string[], agents?: Array }>}
 */
export async function createPersonalSquadInteractive(options = {}) {
  const _initSquad = options._initSquad || initSquad;
  const _select = options._select || (await import('@inquirer/prompts')).select;
  const _checkbox = options._checkbox || (await import('@inquirer/prompts')).checkbox;
  const _input = options._input || input;
  const _chalk = options._chalk || chalk;
  const globalPath = resolveGlobalSquadPath();

  // Show banner unless caller already showed it
  if (!options._skipBanner) {
    console.log();
    console.log(_chalk.bold('🚀 Create Your Personal Squad'));
    console.log();
    console.log(_chalk.white('A Squad is your AI development team that follows you across projects.'));
    console.log(_chalk.white('It includes agents with different specialties that collaborate on your work.'));
    console.log();
    console.log(_chalk.dim(`Learn more: ${SQUAD_DOCS_URL}`));
    console.log();
    console.log(_chalk.bold('Core team members (always included):'));
    for (const role of CORE_ROLES) {
      console.log(`   ${role.emoji}  ${_chalk.cyan(role.name.charAt(0).toUpperCase() + role.name.slice(1))} — ${role.description}`);
    }
    console.log();
  }

  // Step 1: Choose full team or custom
  const presetKey = await _select({
    message: 'What kind of team do you need?',
    choices: TEAM_PRESETS.map((p) => ({
      name: `${p.name} — ${_chalk.dim(p.description)}`,
      value: p.key,
    })),
  });

  let selectedRoles = [];

  if (presetKey === 'full') {
    selectedRoles = TEAM_PRESETS.find((p) => p.key === 'full').roles;
  } else {
    // Custom: show checkbox for all optional roles
    console.log();
    selectedRoles = await _checkbox({
      message: 'Select team members (Lead & Scribe always included):',
      choices: OPTIONAL_ROLES.map((r) => ({
        name: `${r.emoji}  ${r.name.charAt(0).toUpperCase() + r.name.slice(1)} — ${r.description}`,
        value: r.name,
        checked: false,
      })),
    });

    // Offer to add a custom role
    console.log();
    const addCustom = await _select({
      message: 'Need a specialist not listed above?',
      choices: [
        { name: 'No, this is good', value: 'no' },
        { name: 'Yes, let me describe what I need', value: 'yes' },
      ],
    });

    if (addCustom === 'yes') {
      const customDesc = await _input({
        message: 'Describe the role (e.g., "Rust systems programmer" or "Mobile iOS developer"):',
      });
      if (customDesc && customDesc.trim()) {
        // Create a custom role from the description
        const customName = customDesc.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 20);
        selectedRoles.push({ custom: true, name: customName, description: customDesc.trim() });
      }
    }
  }

  // Build agents array: core roles + selected roles
  const agents = [
    ...CORE_ROLES.map((r) => ({ name: r.name, role: r.role })),
    ...selectedRoles.map((item) => {
      if (typeof item === 'object' && item.custom) {
        return { name: item.name, role: item.description };
      }
      const roleInfo = OPTIONAL_ROLES.find((r) => r.name === item);
      return { name: roleInfo.name, role: roleInfo.role };
    }),
  ];

  console.log();
  console.log(_chalk.dim('Creating squad...'));

  try {
    const result = await _initSquad({
      teamRoot: globalPath,
      projectName: 'personal-squad',
      projectDescription: 'Personal Squad for consulting on external projects',
      agents,
      configFormat: 'json',
    });

    console.log();
    console.log(_chalk.green('✅ Squad created successfully!'));
    console.log();
    console.log(_chalk.bold('Your team:'));
    for (const agent of agents) {
      const roleInfo = [...CORE_ROLES, ...OPTIONAL_ROLES].find((r) => r.name === agent.name);
      const emoji = roleInfo ? roleInfo.emoji : '👤';
      console.log(`   ${emoji}  ${agent.name}`);
    }
    console.log();
    console.log(_chalk.dim(`Squad location: ${globalPath}`));
    console.log();

    return { success: true, createdFiles: result.createdFiles, agents };
  } catch (err) {
    console.error(_chalk.red(`Failed to create squad: ${err.message}`));
    return { success: false };
  }
}

/**
 * Initialize a personal squad in the global config directory.
 *
 * @param {object} [options]
 * @param {Function} [options._initSquad] - Injectable initSquad (for testing)
 * @param {Array} [options.agents] - Custom agents to create (optional)
 * @returns {Promise<{ success: boolean, createdFiles?: string[] }>}
 */
export async function initPersonalSquad(options = {}) {
  const _initSquad = options._initSquad || initSquad;
  const globalPath = resolveGlobalSquadPath();

  const agents = options.agents || [
    { name: 'lead', role: 'lead' },
    { name: 'developer', role: 'developer' },
  ];

  try {
    const result = await _initSquad({
      teamRoot: globalPath,
      projectName: options.projectName || 'personal-squad',
      projectDescription: 'Personal Squad for consulting on external projects',
      agents,
      configFormat: 'json',
    });
    return { success: true, createdFiles: result.createdFiles };
  } catch (err) {
    console.error(`Failed to initialize personal squad: ${err.message}`);
    return { success: false };
  }
}

/**
 * Ensure personal squad exists, prompting to create it if needed.
 * Uses interactive flow to let user select team members.
 *
 * @param {object} [options]
 * @param {Function} [options._confirm] - Injectable confirm (for testing)
 * @param {Function} [options._initSquad] - Injectable initSquad (for testing)
 * @param {Function} [options._checkbox] - Injectable checkbox (for testing)
 * @param {Function} [options._input] - Injectable input (for testing)
 * @param {Function} [options._chalk] - Injectable chalk (for testing)
 * @param {boolean} [options.interactive=true] - Use interactive flow (false for quick init)
 * @returns {Promise<boolean>} true if squad exists or was created, false if user declined
 */
export async function ensurePersonalSquad(options = {}) {
  const _confirm = options._confirm || confirm;
  const _chalk = options._chalk || chalk;
  const interactive = options.interactive !== false;

  if (personalSquadExists()) {
    return true;
  }

  // Show the squad introduction banner
  console.log();
  console.log(_chalk.yellow('✔ No personal squad found.'));
  console.log();
  console.log(_chalk.bold('🚀 Create Your Personal Squad'));
  console.log();
  console.log(_chalk.white('A Squad is your AI development team that follows you across projects.'));
  console.log(_chalk.white('It includes agents with different specialties that collaborate on your work.'));
  console.log();
  console.log(_chalk.dim(`Learn more: ${SQUAD_DOCS_URL}`));
  console.log();
  console.log(_chalk.bold('Core team members (always included):'));
  for (const role of CORE_ROLES) {
    console.log(`   ${role.emoji}  ${_chalk.cyan(role.name.charAt(0).toUpperCase() + role.name.slice(1))} — ${role.description}`);
  }
  console.log();

  const shouldInit = await _confirm({
    message: 'Would you like to create one now?',
    default: true,
  });

  if (!shouldInit) {
    return false;
  }

  let result;
  if (interactive) {
    // Interactive flow - let user pick team members
    result = await createPersonalSquadInteractive({
      _initSquad: options._initSquad,
      _checkbox: options._checkbox,
      _input: options._input,
      _chalk: options._chalk,
      _skipBanner: true, // Banner already shown
    });
  } else {
    // Quick init with defaults
    result = await initPersonalSquad({ _initSquad: options._initSquad });
    if (result.success) {
      console.log('Personal squad created successfully.');
    }
  }

  return result.success;
}
