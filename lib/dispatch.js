import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { readProjects } from './config.js';
import { RallyError, EXIT_GENERAL } from './errors.js';

/**
 * Parse owner/repo from a --repo flag value.
 * @param {string} value - Expected format: owner/repo
 * @returns {{ owner: string, repo: string }}
 */
export function parseRepoFlag(value) {
  const match = value.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (!match) {
    throw new Error(
      `Invalid repo format: "${value}". Expected owner/repo (e.g. jsturtevant/rally).`
    );
  }
  return { owner: match[1], repo: match[2] };
}

/**
 * Derive owner/repo from the git remote origin of a project path.
 * @param {string} projectPath - Absolute path to the git repo
 * @param {object} [opts]
 * @param {Function} [opts._exec] - Injectable exec (for testing)
 * @returns {{ owner: string, repo: string }}
 */
export function getRemoteRepo(projectPath, opts = {}) {
  const exec = opts._exec || execFileSync;
  let url;
  try {
    url = exec('git', ['remote', 'get-url', 'origin'], {
      cwd: projectPath,
      encoding: 'utf8',
    }).trim();
  } catch {
    throw new Error(
      `Cannot determine repo: no git remote "origin" in ${projectPath}`
    );
  }

  // https://github.com/owner/repo.git or https://github.com/owner/repo
  const httpsMatch = url.match(/github\.com\/([^/]+)\/([^/.]+)/);
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }

  // git@github.com:owner/repo.git
  const sshMatch = url.match(/github\.com:([^/]+)\/([^/.]+)/);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }

  throw new Error(
    `Cannot parse owner/repo from remote URL: ${url}`
  );
}

/**
 * Resolve owner/repo for a project entry.
 * Prefers the `repo` field from projects.yaml (the upstream) over git remote
 * origin, which may point at the user's fork.
 * @param {object} project - Project entry from projects.yaml
 * @param {Function} [_exec] - Injectable exec (for testing)
 * @returns {{ owner: string, repo: string }}
 */
function resolveProjectRepo(project, _exec) {
  if (project.repo) {
    const trimmed = project.repo.trim();
    const parts = trimmed.split('/');
    if (parts.length === 2 && parts[0] && parts[1]) {
      return { owner: parts[0], repo: parts[1] };
    }
    throw new RallyError(
      `Invalid repo format "${project.repo}" in projects.yaml for project "${project.name || project.path}". Expected "owner/repo".`,
      EXIT_GENERAL
    );
  }
  return getRemoteRepo(project.path, { _exec });
}

/**
 * Find the project whose path contains the current working directory.
 * @param {Array} projectList - Array of project entries from projects.yaml
 * @returns {object|null} Matching project entry, or null
 */
function findProjectByCwd(projectList) {
  const cwd = process.cwd();
  return projectList.find((p) => {
    try {
      const projectPath = path.resolve(p.path);
      return cwd === projectPath || cwd.startsWith(projectPath + path.sep);
    } catch {
      return false;
    }
  }) || null;
}

/**
 * Resolve which repo to dispatch against.
 *
 * Resolution order:
 *   1. --repo flag (owner/repo) → parse, find matching project, validate
 *   2. cwd detection → check if inside an onboarded project
 *   3. Single-project fallback → if exactly one project registered
 *   4. Error → ambiguous or no projects
 *
 * @param {object} [options]
 * @param {string} [options.repo] - Value of --repo flag (owner/repo)
 * @param {Function} [options._exec] - Injectable execFileSync (for testing)
 * @returns {{ owner: string, repo: string, fullName: string, project: object }}
 */
export function resolveRepo(options = {}) {
  const projects = readProjects();
  const projectList = (projects && projects.projects) || [];

  // 1. --repo flag
  if (options.repo) {
    const { owner, repo } = parseRepoFlag(options.repo);
    const project = projectList.find((p) => p.repo === options.repo) ||
                   projectList.find((p) => p.name === repo);
    if (!project) {
      throw new Error(
        `Repository "${options.repo}" is not onboarded. Run: rally onboard ${options.repo}`
      );
    }
    return { owner, repo, fullName: `${owner}/${repo}`, project };
  }

  // 2. cwd detection
  const cwdProject = findProjectByCwd(projectList);
  if (cwdProject) {
    const { owner, repo } = resolveProjectRepo(cwdProject, options._exec);
    return { owner, repo, fullName: `${owner}/${repo}`, project: cwdProject };
  }

  // 3. Single-project fallback
  if (projectList.length === 1) {
    const project = projectList[0];
    const { owner, repo } = resolveProjectRepo(project, options._exec);
    return { owner, repo, fullName: `${owner}/${repo}`, project };
  }

  // 4. Error cases
  if (projectList.length === 0) {
    throw new Error('No projects onboarded. Run: rally onboard <path-or-url>');
  }

  const names = projectList.map((p) => p.name).join(', ');
  throw new Error(
    `Multiple projects onboarded. Use --repo owner/repo or run from inside a project directory.\nRegistered projects: ${names}`
  );
}
