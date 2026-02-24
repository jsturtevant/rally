import { execFileSync } from 'node:child_process';
import { select } from '@inquirer/prompts';
import { readProjects } from './config.js';

/**
 * List onboarded repos from projects.yaml.
 * @param {object} [opts]
 * @param {Function} [opts._readProjects] - Injectable for testing
 * @returns {Array<{name: string, repo: string, path: string}>}
 */
export function listOnboardedRepos(opts = {}) {
  const read = opts._readProjects || readProjects;
  const data = read();
  return (data && data.projects) || [];
}

/**
 * Fetch open issues for a repo via gh CLI.
 * @param {string} repo - owner/repo
 * @param {Function} [_exec] - Injectable execFileSync
 * @returns {Array<{number: number, title: string, labels: Array, state: string}>}
 */
export function fetchIssues(repo, _exec = execFileSync) {
  try {
    const output = _exec(
      'gh',
      ['issue', 'list', '--repo', repo, '--json', 'number,title,labels,state', '--limit', '20'],
      { encoding: 'utf8' },
    );
    return JSON.parse(output);
  } catch (err) {
    throw new Error(`Failed to fetch issues for ${repo}: ${err.message}`);
  }
}

/**
 * Fetch open PRs for a repo via gh CLI.
 * @param {string} repo - owner/repo
 * @param {Function} [_exec] - Injectable execFileSync
 * @returns {Array<{number: number, title: string, state: string}>}
 */
export function fetchPrs(repo, _exec = execFileSync) {
  try {
    const output = _exec(
      'gh',
      ['pr', 'list', '--repo', repo, '--json', 'number,title,state', '--limit', '20'],
      { encoding: 'utf8' },
    );
    return JSON.parse(output);
  } catch (err) {
    throw new Error(`Failed to fetch PRs for ${repo}: ${err.message}`);
  }
}

/**
 * Format an issue as a select choice.
 * @param {object} issue
 * @returns {{name: string, value: number}}
 */
export function formatIssueChoice(issue) {
  const labels = issue.labels && issue.labels.length
    ? ` [${issue.labels.map((l) => l.name).join(', ')}]`
    : '';
  return { name: `#${issue.number} - ${issue.title}${labels}`, value: issue.number };
}

/**
 * Format a PR as a select choice.
 * @param {object} pr
 * @returns {{name: string, value: number}}
 */
export function formatPrChoice(pr) {
  return { name: `#${pr.number} - ${pr.title}`, value: pr.number };
}

/**
 * Interactive repo picker. Auto-selects if only one repo.
 * @param {object} [opts]
 * @param {Function} [opts._readProjects] - Injectable for testing
 * @param {Function} [opts._select] - Injectable select prompt for testing
 * @returns {Promise<object|null>} Selected project entry, or null if cancelled
 */
export async function pickRepo(opts = {}) {
  const _sel = opts._select || select;
  const projects = listOnboardedRepos(opts);
  if (projects.length === 0) {
    throw new Error('No projects onboarded. Run: rally onboard <path-or-url>');
  }
  if (projects.length === 1) {
    return projects[0];
  }
  const repo = await _sel({
    message: 'Select a repository:',
    choices: [
      ...projects.map((p) => ({ name: p.repo || p.name, value: p })),
      { name: '← Cancel', value: null },
    ],
  });
  return repo;
}

/**
 * Interactive issue picker.
 * @param {string} repo - owner/repo
 * @param {object} [opts]
 * @param {Function} [opts._exec] - Injectable execFileSync
 * @param {Function} [opts._select] - Injectable select prompt for testing
 * @returns {Promise<number|null>} Selected issue number, or null if cancelled
 */
export async function pickIssue(repo, opts = {}) {
  const _sel = opts._select || select;
  const issues = fetchIssues(repo, opts._exec);
  if (issues.length === 0) {
    throw new Error(`No open issues found in ${repo}`);
  }
  return _sel({
    message: `Select an issue from ${repo}:`,
    choices: [
      ...issues.map(formatIssueChoice),
      { name: '← Cancel', value: null },
    ],
  });
}

/**
 * Interactive PR picker.
 * @param {string} repo - owner/repo
 * @param {object} [opts]
 * @param {Function} [opts._exec] - Injectable execFileSync
 * @param {Function} [opts._select] - Injectable select prompt for testing
 * @returns {Promise<number|null>} Selected PR number, or null if cancelled
 */
export async function pickPr(repo, opts = {}) {
  const _sel = opts._select || select;
  const prs = fetchPrs(repo, opts._exec);
  if (prs.length === 0) {
    throw new Error(`No open PRs found in ${repo}`);
  }
  return _sel({
    message: `Select a PR from ${repo}:`,
    choices: [
      ...prs.map(formatPrChoice),
      { name: '← Cancel', value: null },
    ],
  });
}
