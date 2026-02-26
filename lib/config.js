import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, chmodSync, unlinkSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname, basename, isAbsolute } from 'node:path';
import yaml from 'js-yaml';
import { DEFAULT_DENY_TOOLS } from './copilot.js';


export function atomicWrite(filePath, content) {
  const dir = dirname(filePath);
  const base = basename(filePath);
  const tmp = join(dir, `.${base}.${process.pid}.${Date.now()}.tmp`);
  try {
    writeFileSync(tmp, content, { encoding: 'utf8', mode: 0o600 });
    renameSync(tmp, filePath);
  } catch (err) {
    try { unlinkSync(tmp); } catch (_) { /* best-effort cleanup */ }
    throw err;
  }
}

export function getConfigDir() {
  if (process.env.RALLY_HOME) {
    if (!isAbsolute(process.env.RALLY_HOME)) {
      throw new Error(`RALLY_HOME must be an absolute path, got: "${process.env.RALLY_HOME}"`);
    }
    return process.env.RALLY_HOME;
  }
  const newDefault = join(homedir(), 'rally');
  const legacyDefault = join(homedir(), '.rally');
  // Prefer new location; fall back to legacy ~/.rally if it exists and ~/rally does not
  if (!existsSync(newDefault) && existsSync(legacyDefault)) return legacyDefault;
  return newDefault;
}

/**
 * Ensure the config directory exists with restricted permissions (0o700).
 * Creates the directory if missing; tightens permissions if it already exists.
 */
export function ensureConfigDir() {
  const configDir = getConfigDir();
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true, mode: 0o700 });
  } else if (process.platform !== 'win32') {
    const stat = statSync(configDir);
    if (!stat.isDirectory()) {
      throw new Error(`Config path exists but is not a directory: ${configDir}`);
    }
    chmodSync(configDir, 0o700);
  }
  return configDir;
}

export function readConfig() {
  const configPath = join(getConfigDir(), 'config.yaml');
  if (!existsSync(configPath)) {
    return null;
  }
  try {
    const content = readFileSync(configPath, 'utf8');
    return yaml.load(content, { schema: yaml.CORE_SCHEMA });
  } catch (err) {
    throw new Error(`Failed to parse config.yaml: ${err.message}`);
  }
}

export function writeConfig(data) {
  const configDir = ensureConfigDir();
  const configPath = join(configDir, 'config.yaml');
  const content = yaml.dump(data);
  atomicWrite(configPath, content);
}

export function readProjects() {
  const projectsPath = join(getConfigDir(), 'projects.yaml');
  if (!existsSync(projectsPath)) {
    return { projects: [] };
  }
  try {
    const content = readFileSync(projectsPath, 'utf8');
    return yaml.load(content, { schema: yaml.CORE_SCHEMA }) ?? { projects: [] };
  } catch (err) {
    throw new Error(`Failed to parse projects.yaml: ${err.message}`);
  }
}

export function writeProjects(data) {
  const configDir = ensureConfigDir();
  const projectsPath = join(configDir, 'projects.yaml');
  const content = yaml.dump(data);
  atomicWrite(projectsPath, content);
}

export function readActive() {
  const activePath = join(getConfigDir(), 'active.yaml');
  if (!existsSync(activePath)) {
    return { dispatches: [] };
  }
  try {
    const content = readFileSync(activePath, 'utf8');
    return yaml.load(content, { schema: yaml.CORE_SCHEMA }) ?? { dispatches: [] };
  } catch (err) {
    throw new Error(`Failed to parse active.yaml: ${err.message}`);
  }
}

const VALID_TRISTATE = ['always', 'never', 'ask'];

/**
 * Validate that a repo is onboarded by checking projects.yaml.
 * @param {string} repo - Repository in owner/repo format
 * @throws {Error} If repo is not onboarded
 */

/**
 * Read user-facing config settings with defaults and validation.
 *
 * Settings are read from the `settings` key in config.yaml:
 * - `docker_sandbox` ('always'|'never'|'ask', default: 'ask') — Docker sandbox usage
 * - `review_template` (string|null, default: null) — custom review prompt file path
 * - `require_trust` ('always'|'never'|'ask', default: 'ask') — trust checking behavior
 * - `deny_tools_copilot` (string[], default: DEFAULT_DENY_TOOLS) — tools denied in non-sandbox mode
 * - `deny_tools_sandbox` (string[], default: DEFAULT_DENY_TOOLS) — tools denied in Docker sandbox mode
 *
 * Note: review_template file existence is validated by dispatch functions,
 * not here — the path is resolved relative to getConfigDir() at call site.
 *
 * @returns {{ docker_sandbox: 'always'|'never'|'ask', review_template: string|null, require_trust: 'always'|'never'|'ask', deny_tools_copilot: string[], deny_tools_sandbox: string[] }}
 * @throws {Error} If docker_sandbox or require_trust has an invalid value, or deny_tools are not arrays
 */
export function getSettings() {
  const config = readConfig();
  const settings = config?.settings || {};
  const dockerSandbox = settings.docker_sandbox || 'ask';
  const requireTrust = settings.require_trust || 'ask';
  if (!VALID_TRISTATE.includes(dockerSandbox)) {
    throw new Error(`Invalid docker_sandbox value: "${dockerSandbox}". Must be one of: ${VALID_TRISTATE.join(', ')}`);
  }
  if (!VALID_TRISTATE.includes(requireTrust)) {
    throw new Error(`Invalid require_trust value: "${requireTrust}". Must be one of: ${VALID_TRISTATE.join(', ')}`);
  }
  const denyToolsCopilot = settings.deny_tools_copilot || DEFAULT_DENY_TOOLS;
  const denyToolsSandbox = settings.deny_tools_sandbox || DEFAULT_DENY_TOOLS;
  if (!Array.isArray(denyToolsCopilot)) {
    throw new Error('Invalid deny_tools_copilot: must be an array of strings');
  }
  if (!Array.isArray(denyToolsSandbox)) {
    throw new Error('Invalid deny_tools_sandbox: must be an array of strings');
  }
  return {
    docker_sandbox: dockerSandbox,
    review_template: settings.review_template || null,
    require_trust: requireTrust,
    deny_tools_copilot: denyToolsCopilot,
    deny_tools_sandbox: denyToolsSandbox,
  };
}

export function validateOnboarded(repo) {
  const repoName = repo.split('/')[1];
  const projects = readProjects();
  const projectList = (projects && projects.projects) || [];
  // Match full owner/repo first, fall back to name-only for legacy entries
  const match = projectList.find((p) => p.repo === repo) ||
                projectList.find((p) => p.name === repoName);
  if (!match) {
    throw new Error(`Repository "${repo}" is not onboarded. Run: rally onboard ${repo}`);
  }
}
