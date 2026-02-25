import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, chmodSync, unlinkSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname, basename, isAbsolute } from 'node:path';
import yaml from 'js-yaml';


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

/**
 * Validate that a repo is onboarded by checking projects.yaml.
 * @param {string} repo - Repository in owner/repo format
 * @throws {Error} If repo is not onboarded
 */
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
