import { readProjects } from './config.js';

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
    .slice(0, 50)
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
