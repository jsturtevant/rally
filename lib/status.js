import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { getConfigDir, readConfig, readProjects, readActive } from './config.js';
import { getPersonalSquadRoot, personalSquadExists } from './squad-sdk.js';

/**
 * Gather status info for debugging Rally setup.
 * Returns a structured object suitable for display or JSON output.
 */
export function getStatus() {
  const configDir = getConfigDir();
  const configPath = join(configDir, 'config.yaml');
  const projectsPath = join(configDir, 'projects.yaml');
  const activePath = join(configDir, 'active.yaml');

  const config = readConfig();
  const projects = readProjects();
  const active = readActive();

  // Personal squad from SDK
  const squadExists = personalSquadExists();
  const squadRoot = squadExists ? getPersonalSquadRoot() : null;

  return {
    configDir,
    configPaths: {
      config: { path: configPath, exists: existsSync(configPath) },
      projects: { path: projectsPath, exists: existsSync(projectsPath) },
      active: { path: activePath, exists: existsSync(activePath) },
    },
    personalSquad: squadRoot,
    projectsDir: config?.projectsDir ?? null,
    projects: projects?.projects ?? [],
    dispatches: active?.dispatches ?? [],
  };
}

/**
 * Format status as human-readable lines.
 */
export function formatStatus(status) {
  const lines = [];

  lines.push('Rally Status');
  lines.push('============');
  lines.push('');

  // Config paths
  lines.push('Config Paths:');
  for (const [name, info] of Object.entries(status.configPaths)) {
    const marker = info.exists ? '✓' : '✗';
    lines.push(`  ${marker} ${name}: ${info.path}`);
  }
  lines.push('');

  // Directories
  lines.push('Directories:');
  lines.push(`  configDir:     ${status.configDir}`);
  lines.push(`  personalSquad: ${status.personalSquad ?? '(not configured)'}`);
  lines.push(`  projectsDir:   ${status.projectsDir ?? '(not configured)'}`);
  lines.push('');

  // Projects
  lines.push(`Onboarded Projects (${status.projects.length}):`);
  if (status.projects.length === 0) {
    lines.push('  (none)');
  } else {
    for (const p of status.projects) {
      lines.push(`  - ${p.name}: ${p.path}`);
    }
  }
  lines.push('');

  // Active dispatches
  lines.push(`Active Dispatches (${status.dispatches.length}):`);
  if (status.dispatches.length === 0) {
    lines.push('  (none)');
  } else {
    for (const d of status.dispatches) {
      const typeLabel = d.type === 'pr' ? 'PR ' : d.type === 'issue' ? 'Issue ' : '';
      lines.push(`  - ${d.repo ?? 'unknown'} ${typeLabel}#${d.number ?? '?'} [${d.status ?? 'unknown'}]`);
    }
  }

  return lines.join('\n');
}
