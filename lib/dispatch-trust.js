import { execFileSync } from 'node:child_process';
import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';

/**
 * Get the current GitHub user's login via `gh api user`.
 * @param {Function} [_exec] - Injectable execFileSync for testing
 * @returns {string|null} GitHub username or null if unavailable
 */
export function getCurrentUser(_exec = execFileSync) {
  try {
    const output = _exec('gh', ['api', 'user', '--jq', '.login'], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return output.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Get the author login of an issue or PR.
 * @param {string} type - 'issue' or 'pr'
 * @param {number} number - Issue/PR number
 * @param {string} repo - owner/repo
 * @param {Function} [_exec] - Injectable execFileSync for testing
 * @returns {string|null} Author login or null if unavailable
 */
export function getItemAuthor(type, number, repo, _exec = execFileSync) {
  try {
    const subcommand = type === 'pr' ? 'pr' : 'issue';
    const output = _exec(
      'gh', [subcommand, 'view', String(number), '--repo', repo, '--json', 'author', '--jq', '.author.login'],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return output.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Check if a user is a member of the org that owns the repo.
 * @param {string} repo - owner/repo
 * @param {string} username - GitHub username to check
 * @param {Function} [_exec] - Injectable execFileSync for testing
 * @returns {boolean|null} true if member, false if not, null if can't determine (e.g. user repo)
 */
export function checkOrgMembership(repo, username, _exec = execFileSync) {
  const owner = repo.split('/')[0];
  if (!owner || !username) return null;
  try {
    // First check if the owner is an organization (not a user)
    const ownerType = _exec(
      'gh', ['api', `users/${owner}`, '--jq', '.type'],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();
    if (ownerType !== 'Organization') return null; // User-owned repo — skip check
  } catch {
    return null; // Can't determine owner type
  }
  try {
    _exec(
      'gh', ['api', `orgs/${owner}/members/${username}`],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return true;
  } catch (err) {
    // 404 means not a member; other errors mean we can't determine
    if (err.stderr && err.stderr.includes('404')) return false;
    if (err.status === 404) return false;
    return null;
  }
}

/**
 * Run trust checks before dispatching an issue or PR.
 * Shows warnings if the author differs from the current user or if the
 * user isn't an org member. Returns true to proceed, false to abort.
 *
 * @param {object} opts
 * @param {string} opts.type - 'issue' or 'pr'
 * @param {number} opts.number - Issue/PR number
 * @param {string} opts.repo - owner/repo
 * @param {boolean} [opts.trust] - If true, skip all prompts
 * @param {Function} [opts._exec] - Injectable execFileSync
 * @param {Function} [opts._confirm] - Injectable confirm prompt
 * @param {boolean} [opts._isTTY] - Override TTY detection (for testing)
 * @returns {Promise<boolean>} true to proceed, false to abort
 */
export async function checkDispatchTrust(opts) {
  const {
    type,
    number,
    repo,
    trust = false,
    _exec = execFileSync,
    _confirm = confirm,
    _isTTY = process.stdin.isTTY,
  } = opts;

  if (trust) {
    console.error('Warning: --trust flag used — skipping all author/org trust checks');
    return true;
  }

  const currentUser = getCurrentUser(_exec);
  if (!currentUser) return true; // Can't determine user — proceed

  const author = getItemAuthor(type, number, repo, _exec);
  if (!author) return true; // Can't determine author — proceed

  // Non-interactive — perform author check but can't prompt
  if (!_isTTY) {
    if (author.toLowerCase() !== currentUser.toLowerCase()) {
      console.error(
        `Trust check: issue authored by ${author}, not ${currentUser}. Pass --trust to dispatch untrusted content.`
      );
      return false;
    }
    return true;
  }

  const warnings = [];

  if (author.toLowerCase() !== currentUser.toLowerCase()) {
    warnings.push(
      `${chalk.yellow('⚠ Author mismatch:')} This ${type} was created by ${chalk.bold(author)}, not you (${chalk.bold(currentUser)}).`,
      `  Content from other users may contain prompt injection attacks.`
    );
  }

  const isMember = checkOrgMembership(repo, currentUser, _exec);
  if (isMember === false) {
    warnings.push(
      `${chalk.yellow('⚠ Org membership:')} You (${chalk.bold(currentUser)}) are not a member of the ${chalk.bold(repo.split('/')[0])} org.`,
      `  You may be dispatching untrusted content from an organization you don't belong to.`
    );
  }

  if (warnings.length === 0) return true;

  console.error('');
  for (const w of warnings) {
    console.error(w);
  }
  console.error('');

  const proceed = await _confirm({
    message: `Do you want to proceed with dispatching this ${type}?`,
    default: false,
  });

  return proceed;
}
