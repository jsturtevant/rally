import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, chmodSync, unlinkSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname, basename, isAbsolute, resolve, sep } from 'node:path';
import yaml from 'js-yaml';
import { DEFAULT_DENY_TOOLS } from './copilot.js';
import { RallyError, EXIT_CONFIG } from './errors.js';


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
      throw new RallyError(`RALLY_HOME must be an absolute path, got: "${process.env.RALLY_HOME}"`, EXIT_CONFIG);
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
      throw new RallyError(`Config path exists but is not a directory: ${configDir}`, EXIT_CONFIG);
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
    throw new RallyError(`Failed to parse config.yaml: ${err.message}`, EXIT_CONFIG);
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
    throw new RallyError(`Failed to parse projects.yaml: ${err.message}`, EXIT_CONFIG);
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
    throw new RallyError(`Failed to parse active.yaml: ${err.message}`, EXIT_CONFIG);
  }
}

const VALID_TRISTATE = ['always', 'never', 'ask'];

/**
 * Validate that a repo is onboarded by checking projects.yaml.
 * @param {string} repo - Repository in owner/repo format
 * @throws {Error} If repo is not onboarded
 */

/**
 * Validate and return a deny_tools array from config, falling back to defaults.
 * Rejects empty arrays (would silently bypass all tool restrictions), non-array
 * types, and arrays containing non-string elements.
 */
function validateDenyTools(value, fieldName) {
  if (value == null) return [...DEFAULT_DENY_TOOLS];
  if (!Array.isArray(value)) {
    throw new RallyError(`Invalid ${fieldName}: must be an array of strings`, EXIT_CONFIG);
  }
  if (value.length === 0) {
    throw new RallyError(`Invalid ${fieldName}: must not be empty (would bypass all tool restrictions)`, EXIT_CONFIG);
  }
  if (!value.every(t => typeof t === 'string')) {
    throw new RallyError(`Invalid ${fieldName}: must be an array of strings`, EXIT_CONFIG);
  }
  return value;
}

/**
 * Validate review_template config value: must be a string (or null/undefined),
 * and must not traverse outside the config directory.
 */
function validateReviewTemplate(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') {
    throw new RallyError('Invalid review_template: must be a string path or null', EXIT_CONFIG);
  }
  if (isAbsolute(value)) {
    throw new RallyError('Invalid review_template: must be a relative path (resolved from config directory)', EXIT_CONFIG);
  }
  const configDir = getConfigDir();
  const resolved = resolve(configDir, value);
  if (!resolved.startsWith(configDir + sep) && resolved !== configDir) {
    throw new RallyError('Invalid review_template: path must not traverse outside config directory', EXIT_CONFIG);
  }
  return value;
}

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
 * Note: review_template type and path traversal are validated here.
 * File existence is validated by dispatch functions at call site.
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
    throw new RallyError(`Invalid docker_sandbox value: "${dockerSandbox}". Must be one of: ${VALID_TRISTATE.join(', ')}`, EXIT_CONFIG);
  }
  if (!VALID_TRISTATE.includes(requireTrust)) {
    throw new RallyError(`Invalid require_trust value: "${requireTrust}". Must be one of: ${VALID_TRISTATE.join(', ')}`, EXIT_CONFIG);
  }
  const rawCopilot = settings.deny_tools_copilot;
  const rawSandbox = settings.deny_tools_sandbox;
  const denyToolsCopilot = validateDenyTools(rawCopilot, 'deny_tools_copilot');
  const denyToolsSandbox = validateDenyTools(rawSandbox, 'deny_tools_sandbox');
  const reviewTemplate = validateReviewTemplate(settings.review_template);
  return {
    docker_sandbox: dockerSandbox,
    review_template: reviewTemplate,
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
    throw new RallyError(`Repository "${repo}" is not onboarded. Run: rally onboard ${repo}`, EXIT_CONFIG);
  }
}
