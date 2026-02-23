import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import yaml from 'js-yaml';

export function getConfigDir() {
  const base = process.env.RALLY_HOME || join(homedir(), '.rally');
  return base;
}

export function readConfig() {
  const configPath = join(getConfigDir(), 'config.yaml');
  if (!existsSync(configPath)) {
    return null;
  }
  try {
    const content = readFileSync(configPath, 'utf8');
    return yaml.load(content, { schema: yaml.DEFAULT_SCHEMA });
  } catch (err) {
    throw new Error(`Failed to parse config.yaml: ${err.message}`);
  }
}

export function writeConfig(data) {
  const configDir = getConfigDir();
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
  const configPath = join(configDir, 'config.yaml');
  const content = yaml.dump(data);
  writeFileSync(configPath, content, 'utf8');
}

export function readProjects() {
  const projectsPath = join(getConfigDir(), 'projects.yaml');
  if (!existsSync(projectsPath)) {
    return { projects: [] };
  }
  try {
    const content = readFileSync(projectsPath, 'utf8');
    return yaml.load(content, { schema: yaml.DEFAULT_SCHEMA });
  } catch (err) {
    throw new Error(`Failed to parse projects.yaml: ${err.message}`);
  }
}

export function writeProjects(data) {
  const configDir = getConfigDir();
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
  const projectsPath = join(configDir, 'projects.yaml');
  const content = yaml.dump(data);
  writeFileSync(projectsPath, content, 'utf8');
}

export function readActive() {
  const activePath = join(getConfigDir(), 'active.yaml');
  if (!existsSync(activePath)) {
    return { dispatches: [] };
  }
  try {
    const content = readFileSync(activePath, 'utf8');
    return yaml.load(content, { schema: yaml.DEFAULT_SCHEMA });
  } catch (err) {
    throw new Error(`Failed to parse active.yaml: ${err.message}`);
  }
}

export function writeActive(data) {
  const configDir = getConfigDir();
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
  const activePath = join(configDir, 'active.yaml');
  const content = yaml.dump(data);
  writeFileSync(activePath, content, 'utf8');
}
