import { execFileSync } from 'node:child_process';

/**
 * Gets issue details from GitHub.
 * @param {number|string} number - Issue number
 * @param {string} repo - Repository in owner/repo format
 * @returns {Object} Parsed issue JSON with title, body, labels, assignees
 */
export function getIssue(number, repo) {
  try {
    const output = execFileSync(
      'gh',
      ['issue', 'view', String(number), '--repo', repo, '--json', 'title,body,labels,assignees'],
      { encoding: 'utf8' }
    );
    return JSON.parse(output);
  } catch (error) {
    if (error.message.includes('Could not resolve to an Issue')) {
      throw new Error(`Issue #${number} not found in ${repo}`);
    }
    throw new Error(`Failed to get issue #${number}: ${error.message}`);
  }
}

/**
 * Gets pull request details from GitHub.
 * @param {number|string} number - PR number
 * @param {string} repo - Repository in owner/repo format
 * @returns {Object} Parsed PR JSON with title, body, headRefName, baseRefName, files
 */
export function getPr(number, repo) {
  try {
    const output = execFileSync(
      'gh',
      ['pr', 'view', String(number), '--repo', repo, '--json', 'title,body,headRefName,baseRefName,files'],
      { encoding: 'utf8' }
    );
    return JSON.parse(output);
  } catch (error) {
    if (error.message.includes('Could not resolve to a PullRequest')) {
      throw new Error(`PR #${number} not found in ${repo}`);
    }
    throw new Error(`Failed to get PR #${number}: ${error.message}`);
  }
}

/**
 * Creates a new pull request.
 * @param {string} title - PR title
 * @param {string} body - PR body/description
 * @param {string} base - Base branch name
 * @param {string} head - Head branch name
 * @param {string} repo - Repository in owner/repo format
 * @returns {string} PR URL
 */
export function createPr(title, body, base, head, repo) {
  try {
    const output = execFileSync(
      'gh',
      ['pr', 'create', '--title', title, '--body', body, '--base', base, '--head', head, '--repo', repo],
      { encoding: 'utf8' }
    );
    return output.trim();
  } catch (error) {
    throw new Error(`Failed to create PR: ${error.message}`);
  }
}

/**
 * Gets the default branch name for a repository.
 * @param {string} repo - Repository in owner/repo format
 * @returns {string} Default branch name (e.g., 'main', 'master')
 */
export function getRepoDefaultBranch(repo) {
  try {
    const output = execFileSync(
      'gh',
      ['repo', 'view', repo, '--json', 'defaultBranchRef', '--jq', '.defaultBranchRef.name'],
      { encoding: 'utf8' }
    );
    return output.trim();
  } catch (error) {
    throw new Error(`Failed to get default branch for ${repo}: ${error.message}`);
  }
}
