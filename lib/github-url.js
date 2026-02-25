/**
 * Shared GitHub URL parser.
 *
 * Consolidates three independent parsers (onboard.js parseGithubUrl,
 * onboard.js parseGitHubRemote, dispatch.js getRemoteRepo) into a
 * single function that handles ALL GitHub URL formats.
 */

// Patterns ordered from most specific to least specific
const PATTERNS = [
  // HTTPS: https://github.com/owner/repo[.git]
  /^https?:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/,
  // SCP-style: git@github.com:owner/repo[.git]
  /^git@github\.com:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/,
  // SSH or git:// protocols: ssh://git@github.com/owner/repo[.git] or git://github.com/owner/repo[.git]
  /^(?:ssh|git):\/\/(?:git@)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/,
  // Shorthand: owner/repo (no protocol, no host)
  /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/,
];

/**
 * Parse any GitHub URL format into { owner, repo }.
 *
 * Supported formats:
 *   - https://github.com/owner/repo[.git]
 *   - git@github.com:owner/repo[.git]
 *   - ssh://git@github.com/owner/repo[.git]
 *   - git://github.com/owner/repo[.git]
 *   - owner/repo (shorthand)
 *
 * @param {string} url - The URL or shorthand to parse
 * @returns {{ owner: string, repo: string } | null} Parsed result or null
 */
export function parseGitHubRemoteUrl(url) {
  if (!url || typeof url !== 'string') return null;

  const cleaned = url.trim().replace(/\/+$/, '');
  if (!cleaned) return null;

  for (const pattern of PATTERNS) {
    const match = cleaned.match(pattern);
    if (match) {
      const owner = match[1];
      const repo = match[2];
      // Reject path-traversal attempts
      if (owner.includes('..') || repo.includes('..') || owner === '.' || repo === '.') {
        return null;
      }
      return { owner, repo };
    }
  }

  return null;
}
