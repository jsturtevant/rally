import { existsSync, mkdirSync, realpathSync, lstatSync, readlinkSync } from 'node:fs';
import { join, basename, dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import chalk from 'chalk';
import { getConfigDir, readProjects, writeProjects } from './config.js';
import { createSymlink } from './symlink.js';
import { addExcludes, getExcludeEntries } from './exclude.js';
import { selectTeam } from './team.js';
import { parseGitHubRemoteUrl } from './github-url.js';
import { RallyError, EXIT_CONFIG } from './errors.js';

/**
 * Parse a GitHub URL or owner/repo shorthand into clone metadata.
 * Returns { owner, repo, cloneUrl } or null if input looks like a local path.
 *
 * Higher-level wrapper around parseGitHubRemoteUrl that adds cloneUrl
 * with protocol matching (SSH input → SSH clone URL, else HTTPS).
 */
export function parseGithubUrl(input) {
  const parsed = parseGitHubRemoteUrl(input);
  if (!parsed) return null;

  const { owner, repo } = parsed;

  // Preserve the original protocol for the clone URL
  const cleaned = (input || '').trim().replace(/\/+$/, '');
  const isSsh = cleaned.startsWith('git@');
  const cloneUrl = isSsh
    ? `git@github.com:${owner}/${repo}.git`
    : `https://github.com/${owner}/${repo}.git`;

  return { owner, repo, cloneUrl };
}
/**
 * Validate fork format (must be owner/repo).
 */
export function parseForkArg(fork) {
  if (!fork) return null;
  const match = fork.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (!match) {
    throw new RallyError(`Invalid --fork format: "${fork}". Expected owner/repo (e.g. myuser/myrepo).`, EXIT_CONFIG);
  }
  const owner = match[1];
  const repo = match[2];
  if (owner.includes('..') || repo.includes('..') || owner === '.' || repo === '.') {
    throw new RallyError(
      `Invalid --fork value: "${fork}". Owner and repo must not contain '..' or be '.'.`, EXIT_CONFIG
    );
  }
  return { owner, repo };
}

/**
 * Configure fork remotes: origin → fork, upstream → main project.
 * @param {string} projectPath - Path to the git repo
 * @param {string} fork - Fork in owner/repo format
 * @param {Function} [_exec] - Injectable exec function (for testing)
 * @param {object} [_chalk] - Injectable chalk instance (for testing)
 */
export function configureForkRemotes(projectPath, fork, _exec, _chalk = chalk) {
  const gitOpts = { cwd: projectPath, encoding: 'utf8', stdio: 'pipe' };
  const exec = _exec
    ? (args) => _exec('git', args, gitOpts)
    : (args) => execFileSync('git', args, gitOpts);
  const forkInfo = parseForkArg(fork);
  const forkUrl = `https://github.com/${forkInfo.owner}/${forkInfo.repo}.git`;

  // Check if upstream already exists
  let hasUpstream = false;
  try {
    exec(['remote', 'get-url', 'upstream']);
    hasUpstream = true;
  } catch {
    // no upstream remote
  }

  if (!hasUpstream) {
    // Rename current origin to upstream
    try {
      exec(['remote', 'rename', 'origin', 'upstream']);
      console.log(_chalk.green('✓') + ` Renamed origin → upstream`);
    } catch {
      throw new RallyError('Failed to rename origin to upstream. Does the repo have an origin remote?', EXIT_CONFIG);
    }
  }

  // Set origin to the fork (add or update)
  let hasOrigin = false;
  try {
    exec(['remote', 'get-url', 'origin']);
    hasOrigin = true;
  } catch {
    // no origin
  }

  if (hasOrigin) {
    exec(['remote', 'set-url', 'origin', forkUrl]);
    console.log(_chalk.green('✓') + ` Updated origin → ${forkUrl}`);
  } else {
    exec(['remote', 'add', 'origin', forkUrl]);
    console.log(_chalk.green('✓') + ` Added origin → ${forkUrl}`);
  }

  return forkInfo;
}

// ─── Private helpers (decomposed from onboard monolith, #292) ────────────────

/**
 * Clone a repo or validate an existing clone target.
 * @param {{ owner: string, repo: string, cloneUrl: string }} parsed - Parsed GitHub metadata,
 *   including repository owner, name, and the clone URL to use.
 * @param {{ existingPath?: string, _clone?: (url: string, target: string) => void }} options - Options
 *   controlling clone behavior, including an optional existing project path and injectable
 *   clone function for testing.
 * @param {Object} _chalk - Chalk-like instance used for colored CLI output.
 * @returns {string} resolved absolute project path
 */
function cloneOrValidateExisting(parsed, options, _chalk) {
  const configDir = getConfigDir();
  const projectsDir = join(configDir, 'projects');
  const cloneTarget = join(projectsDir, parsed.repo);

  const clone = options._clone || ((url, target) => {
    execFileSync('gh', ['repo', 'clone', url, target], { stdio: 'pipe' });
  });

  if (existsSync(cloneTarget)) {
    // Validate that existing directory's remote URL matches the expected repo
    try {
      const remoteUrl = execFileSync('git', ['remote', 'get-url', 'origin'], {
        cwd: cloneTarget,
        encoding: 'utf8',
        stdio: 'pipe',
      }).trim();

      // Only validate GitHub URLs (skip validation for non-GitHub / local-path remotes)
      const isGitHubUrl = /github\.com/.test(remoteUrl);

      if (isGitHubUrl) {
        const remoteInfo = parseGitHubRemoteUrl(remoteUrl);
        if (remoteInfo) {
          if (remoteInfo.owner !== parsed.owner || remoteInfo.repo !== parsed.repo) {
            throw new RallyError(
              `Clone target "${cloneTarget}" already exists but belongs to a different repository.\n` +
              `  Expected: ${parsed.owner}/${parsed.repo}\n` +
              `  Found:    ${remoteUrl}\n` +
              `  Remove the directory or use a different path.`, EXIT_CONFIG
            );
          }
        }
      }
    } catch (err) {
      // If it's our validation error, re-throw
      if (err.message.includes('already exists but belongs to')) {
        throw err;
      }
      // Otherwise, it's a git command failure (not a git repo, no remote, etc.)
      const errorDetails = err.stderr || err.message || 'Unknown error';
      throw new RallyError(
        `Clone target "${cloneTarget}" exists but is not a valid git repository with a remote: ${errorDetails}`, EXIT_CONFIG
      );
    }
    console.log(`  Clone target already exists — skipping clone: ${cloneTarget}`);
  } else {
    mkdirSync(projectsDir, { recursive: true });
    console.log(_chalk.blue('⬇') + ` Cloning ${parsed.cloneUrl} → ${cloneTarget}`);
    try {
      clone(parsed.cloneUrl, cloneTarget);
    } catch (err) {
      const msg = err.stderr ? err.stderr.toString().trim() : err.message;
      throw new RallyError(`Clone failed: ${msg}`, EXIT_CONFIG);
    }
    console.log(_chalk.green('✓') + ` Cloned ${parsed.owner}/${parsed.repo}`);
  }

  return resolve(cloneTarget);
}

/**
 * Verify projectPath is a git repo and resolve the real git directory.
 * Handles worktrees where .git is a file.
 * @param {string} projectPath - Path to the project directory to verify as a git repo.
 * @returns {string} absolute path to the git directory
 */
function resolveGitDir(projectPath) {
  const gitCheck = join(projectPath, '.git');
  if (!existsSync(gitCheck)) {
    throw new RallyError('Not a git repository. Run from inside a repo or provide a path to one.', EXIT_CONFIG);
  }

  try {
    const raw = execFileSync('git', ['rev-parse', '--git-dir'], {
      cwd: projectPath,
      encoding: 'utf8',
    }).trim();
    return resolve(projectPath, raw);
  } catch {
    throw new RallyError('Failed to resolve git directory. Is this a valid git repository?', EXIT_CONFIG);
  }
}

/**
 * Determine full owner/repo name from parsed URL or git remote.
 * @param {{owner: string, repo: string}|null|undefined} parsed Parsed GitHub URL information, or null/undefined to infer from git remotes.
 * @param {string} projectPath Absolute or relative path to the local git project used to resolve the origin remote.
 * @returns {string|undefined} e.g. "octocat/Hello-World"
 */
function resolveFullRepoName(parsed, projectPath) {
  if (parsed) {
    return `${parsed.owner}/${parsed.repo}`;
  }
  try {
    const remoteUrl = execFileSync('git', ['remote', 'get-url', 'origin'], {
      cwd: projectPath,
      encoding: 'utf8',
    }).trim();
    const remoteInfo = parseGitHubRemoteUrl(remoteUrl);
    if (remoteInfo) {
      return `${remoteInfo.owner}/${remoteInfo.repo}`;
    }
  } catch {
    // No remote — fullRepoName stays undefined
  }
  return undefined;
}

/**
 * Create symlinks from project into team dir with idempotency checks.
 * @param {string} projectPath absolute path to the project directory where symlinks are created
 * @param {string} teamDir absolute path to the team directory containing the source files for symlinks
 * @param {Object} _chalk chalk-like instance used for colored CLI output
 */
function setupSymlinks(projectPath, teamDir, _chalk) {
  const symlinks = [
    ['.squad', join(teamDir, '.squad')],
    ['.squad-templates', join(teamDir, '.squad-templates')],
    ['.github/agents/squad.agent.md', join(teamDir, '.github', 'agents', 'squad.agent.md')],
  ];

  for (const [linkRel, target] of symlinks) {
    if (!existsSync(target)) {
      console.error(
        _chalk.yellow('⚠') + ` Symlink target not found: ${target} — skipping ${linkRel}`
      );
      continue;
    }
    const linkPath = join(projectPath, linkRel);
    const parentDir = dirname(linkPath);
    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true });
    }

    if (existsSync(linkPath)) {
      // Validate existing path is a correct symlink (issue #7)
      const stats = lstatSync(linkPath);
      if (stats.isSymbolicLink()) {
        const currentTarget = readlinkSync(linkPath);
        if (currentTarget === target) {
          console.log(`  ${linkRel} already exists — skipping`);
        } else {
          console.error(
            _chalk.yellow('⚠') +
              ` ${linkRel} is a symlink to ${currentTarget}, expected ${target}. Remove it and re-run onboard.`
          );
        }
      } else {
        console.error(
          _chalk.yellow('⚠') +
            ` ${linkRel} exists but is not a symlink. Remove it and re-run onboard.`
        );
      }
    } else {
      createSymlink(target, linkPath);
      console.log(_chalk.green('✓') + ` Symlinked ${linkRel} → ${target}`);
    }
  }
}

/**
 * Add exclude entries and register project in projects.yaml.
 *
 * @param {Object} options
 * @param {string} options.projectPath - Absolute path to the project working directory.
 * @param {string} options.gitDir - Path to the project's .git directory.
 * @param {string} options.fullRepoName - Full GitHub repo name in the form "owner/repo".
 * @param {{owner: string, repo: string}|null} [options.forkInfo] - Optional fork metadata if the project is a fork.
 * @param {Object} options._chalk - Chalk-like instance used for colored output.
 */
function registerProject({ projectPath, gitDir, fullRepoName, forkInfo, _chalk }) {
  // Add exclude entries (also exclude .worktrees/)
  const excludeEntries = getExcludeEntries();
  const allExcludes = [...excludeEntries, '.worktrees/', '.worktrees'];
  addExcludes(gitDir, allExcludes);
  console.log(_chalk.green('✓') + ` Updated .git/info/exclude`);

  // Check if already registered (idempotent)
  const projectName = basename(projectPath);
  const projects = readProjects() || { projects: [] };
  const currentRealPath = realpathSync(projectPath);
  const existing = (projects.projects || []).find((p) => {
    try {
      return realpathSync(p.path) === currentRealPath;
    } catch {
      return false;
    }
  });

  if (existing) {
    console.log(`  Project already registered — skipping`);
  } else {
    const entry = {
      name: projectName,
      repo: fullRepoName,
      path: projectPath,
      onboarded: new Date().toISOString(),
    };
    if (forkInfo) {
      entry.fork = `${forkInfo.owner}/${forkInfo.repo}`;
    }
    projects.projects = projects.projects || [];
    projects.projects.push(entry);
    writeProjects(projects);
    console.log(_chalk.green('✓') + ` Registered project: ${projectName}`);
  }
}

// ─── Exported orchestrator ───────────────────────────────────────────────────

/**
 * Onboard a local repo to Rally (shared team).
 * Creates symlinks from team dir into the project, adds .git/info/exclude entries,
 * and registers the project in projects.yaml.
 *
 * Accepts a local path OR a GitHub URL / owner/repo shorthand.
 * When a URL is given the repo is cloned to the projects directory first.
 *
 * @param {object} options
 * @param {string} [options.path] - Path, GitHub URL, or owner/repo shorthand (defaults to cwd)
 * @param {string} [options.fork] - Fork in owner/repo format (sets origin to fork, upstream to main)
 * @param {Function} [options._clone] - Injectable clone function (for testing)
 * @param {Function} [options._exec] - Injectable exec function (for testing)
 * @param {Function} [options._selectTeam] - Injectable selectTeam function (for testing)
 * @param {object} [options._chalk] - Injectable chalk instance (for testing)
 */
export async function onboard(options = {}) {
  const _chalk = options._chalk || chalk;
  const _selectTeam = options._selectTeam || selectTeam;

  // When --fork is given without an explicit path, treat fork value as the upstream to clone
  let forkWithoutPath = false;
  if (options.fork && !options.path) {
    forkWithoutPath = true;
  }

  const input = forkWithoutPath ? options.fork : (options.path || process.cwd());

  // Validate that --fork without path resolves to a GitHub URL
  if (forkWithoutPath && !parseGithubUrl(input)) {
    throw new RallyError(
      `Invalid --fork value: "${options.fork}". Expected a GitHub owner/repo (e.g. hyperlight-dev/hyperlight-wasm).`, EXIT_CONFIG
    );
  }

  // 1. Resolve project path (clone from URL or use local path)
  const parsed = parseGithubUrl(input);
  const projectPath = parsed
    ? cloneOrValidateExisting(parsed, options, _chalk)
    : resolve(input);

  // 2. Verify git repo and resolve git directory
  const gitDir = resolveGitDir(projectPath);

  // 3. Determine full owner/repo for project entry
  const fullRepoName = resolveFullRepoName(parsed, projectPath);

  // 4. Configure fork remotes if --fork was provided
  let forkInfo = null;
  if (options.fork) {
    if (forkWithoutPath) {
      // --fork value is the upstream repo; derive user's fork from GitHub username
      const exec = options._exec || ((cmd, args, opts) => execFileSync(cmd, args, opts));
      let username;
      try {
        username = exec('gh', ['api', 'user', '--jq', '.login'], { encoding: 'utf8', stdio: 'pipe' }).trim();
      } catch (err) {
        const detail = err && err.message ? ` ${err.message}` : '';
        throw new RallyError(
          'Failed to determine GitHub username. ' +
          'Ensure gh CLI is installed and authenticated (gh auth login).' + detail, EXIT_CONFIG
        );
      }
      forkInfo = configureForkRemotes(projectPath, `${username}/${parsed.repo}`, options._exec, _chalk);
    } else {
      forkInfo = configureForkRemotes(projectPath, options.fork, options._exec, _chalk);
    }
  }

  // 5. Get personal squad directory
  const { teamDir } = await _selectTeam();

  // 6. Create symlinks
  setupSymlinks(projectPath, teamDir, _chalk);

  // 7. Register project and manage excludes
  registerProject({ projectPath, gitDir, fullRepoName, forkInfo, _chalk });
}
