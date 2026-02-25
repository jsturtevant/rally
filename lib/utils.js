import { readProjects } from './config.js';

const SLUG_MAX_LENGTH = 50;

/**
 * Check if a process with the given PID is still alive.
 * Uses process.kill(pid, 0) which sends no signal but checks existence.
 * EPERM means the process exists but we lack permissions — treat as alive.
 *
 * @param {number} pid
 * @param {Function} [_kill] - Injectable process.kill for testing
 * @returns {boolean}
 */
export function isPidAlive(pid, _kill = process.kill.bind(process)) {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    _kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

/**
 * Find a single dispatch by issue/PR number, with optional repo disambiguation.
 *
 * @param {Array} dispatches - List of active dispatch records
 * @param {number} number - Issue or PR number to find
 * @param {object} [opts]
 * @param {string} [opts.repo] - Target repository (owner/repo) for disambiguation
 * @returns {object} The matching dispatch record
 * @throws {Error} If no match or multiple ambiguous matches
 */
export function findDispatchByNumber(dispatches, number, opts = {}) {
  let matches = dispatches.filter((d) => d.number === number);
  if (opts.repo) {
    matches = matches.filter((d) => d.repo === opts.repo);
  }

  if (matches.length === 0) {
    throw new Error(`No active dispatch found for #${number}`);
  }
  if (matches.length > 1) {
    const repos = matches.map((d) => d.repo).join(', ');
    throw new Error(
      `Multiple dispatches found for #${number} (${repos}). Use --repo to disambiguate.`
    );
  }

  return matches[0];
}

/**
 * Create a URL-safe slug from a title.
 * Lowercase, replace non-alphanumeric with hyphens, collapse, trim, cap at 50 chars.
 * @param {string} title
 * @returns {string}
 */
export function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/^-+|-+$/g, '') || 'untitled';
}

/**
 * Find the project path for a given repo (owner/repo format).
 * @param {string} repo - e.g. "jsturtevant/rally"
 * @param {Function} [_readProjects] - Injectable for testing
 * @returns {string|null} Absolute path to the project, or null
 */
export function findProjectPath(repo, _readProjects) {
  const read = _readProjects || readProjects;
  const projects = read();
  const repoName = repo.split('/').pop();
  const project = (projects.projects || []).find((p) => p.name === repoName);
  return project ? project.path : null;
}
