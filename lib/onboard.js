import { existsSync, mkdirSync, realpathSync, lstatSync, readlinkSync } from 'node:fs';
import { join, basename, dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import chalk from 'chalk';
import { getConfigDir, readProjects, writeProjects } from './config.js';
import { createSymlink } from './symlink.js';
import { addExcludes, getExcludeEntries } from './exclude.js';
import { selectTeam } from './team.js';

/**
 * Parse a GitHub URL or owner/repo shorthand into clone metadata.
 * Returns { owner, repo, cloneUrl } or null if input looks like a local path.
 */
export function parseGithubUrl(input) {
  if (!input) return null;

  // Strip trailing slashes so URLs like github.com/owner/repo/ still match
  const cleaned = input.replace(/\/+$/, '');

  // Full URL: https://github.com/owner/repo[.git]
  const urlMatch = cleaned.match(
    /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/
  );
  if (urlMatch) {
    const owner = urlMatch[1];
    const repo = urlMatch[2];
    if (repo.includes('..') || owner.includes('..')) return null;
    return {
      owner,
      repo,
      cloneUrl: `https://github.com/${owner}/${repo}.git`,
    };
  }

  // Shorthand: owner/repo (no slashes beyond the single separator, no path-like chars)
  const shortMatch = cleaned.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (shortMatch) {
    const owner = shortMatch[1];
    const repo = shortMatch[2];
    if (repo.includes('..') || owner.includes('..')) return null;
    return {
      owner,
      repo,
      cloneUrl: `https://github.com/${owner}/${repo}.git`,
    };
  }

  return null;
}

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
 * @param {string} [options.team] - Team name (skips interactive prompt)
 * @param {Function} [options._clone] - Injectable clone function (for testing)
 * @param {Function} [options._exec] - Injectable exec function (for testing)
 * @param {Function} [options._select] - Injectable select function (for testing)
 * @param {Function} [options._input] - Injectable input function (for testing)
 */
export async function onboard(options = {}) {
  const input = options.path || process.cwd();

  // Resolve GitHub URL cloning before entering the normal onboard flow
  const parsed = parseGithubUrl(input);
  let projectPath;

  if (parsed) {
    const configDir = getConfigDir();
    const projectsDir = join(configDir, 'projects');
    const cloneTarget = join(projectsDir, parsed.repo);

    const clone = options._clone || ((url, target) => {
      execFileSync('git', ['clone', url, target], { stdio: 'pipe' });
    });

    if (existsSync(cloneTarget)) {
      console.log(`  Clone target already exists — skipping clone: ${cloneTarget}`);
    } else {
      mkdirSync(projectsDir, { recursive: true });
      console.log(chalk.blue('⬇') + ` Cloning ${parsed.cloneUrl} → ${cloneTarget}`);
      try {
        clone(parsed.cloneUrl, cloneTarget);
      } catch (err) {
        const msg = err.stderr ? err.stderr.toString().trim() : err.message;
        throw new Error(`Clone failed: ${msg}`);
      }
      console.log(chalk.green('✓') + ` Cloned ${parsed.owner}/${parsed.repo}`);
    }

    projectPath = resolve(cloneTarget);
  } else {
    projectPath = resolve(input);
  }

  // Verify it's a git repo
  const gitCheck = join(projectPath, '.git');
  if (!existsSync(gitCheck)) {
    throw new Error('Not a git repository. Run from inside a repo or provide a path to one.');
  }

  // Resolve the real git directory (handles worktrees where .git is a file)
  let gitDir;
  try {
    gitDir = execFileSync('git', ['rev-parse', '--git-dir'], {
      cwd: projectPath,
      encoding: 'utf8',
    }).trim();
    gitDir = resolve(projectPath, gitDir);
  } catch {
    throw new Error('Failed to resolve git directory. Is this a valid git repository?');
  }

  // Select team — either via --team flag, interactive prompt, or fall back to config
  let teamDir;
  let teamType;

  // Always use selectTeam — it handles --team flag, _select test hook,
  // and interactive prompt (plain `rally onboard` with no flags).
  const result = await selectTeam({
    team: options.team,
    _exec: options._exec,
    _select: options._select,
    _input: options._input,
  });
  teamDir = result.teamDir;
  teamType = result.teamType;

  // Check if already fully onboarded (idempotent)
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

  // Define symlink mappings: [linkRelPath, targetAbsPath]
  const symlinks = [
    ['.squad', join(teamDir, '.squad')],
    ['.squad-templates', join(teamDir, '.squad-templates')],
    ['.github/agents/squad.agent.md', join(teamDir, '.github', 'agents', 'squad.agent.md')],
  ];

  // Create symlinks
  for (const [linkRel, target] of symlinks) {
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
          console.warn(
            chalk.yellow('⚠') +
              ` ${linkRel} is a symlink to ${currentTarget}, expected ${target}. Remove it and re-run onboard.`
          );
        }
      } else {
        console.warn(
          chalk.yellow('⚠') +
            ` ${linkRel} exists but is not a symlink. Remove it and re-run onboard.`
        );
      }
    } else {
      createSymlink(target, linkPath);
      console.log(chalk.green('✓') + ` Symlinked ${linkRel} → ${target}`);
    }
  }

  // Add exclude entries
  const excludeEntries = getExcludeEntries();
  // Also exclude .worktrees/
  const allExcludes = [...excludeEntries, '.worktrees/', '.worktrees'];
  addExcludes(gitDir, allExcludes);
  console.log(chalk.green('✓') + ` Updated .git/info/exclude`);

  // Register in projects.yaml
  if (existing) {
    console.log(`  Project already registered — skipping`);
  } else {
    const entry = {
      name: projectName,
      path: projectPath,
      team: teamType,
      teamDir,
      onboarded: new Date().toISOString(),
    };
    projects.projects = projects.projects || [];
    projects.projects.push(entry);
    writeProjects(projects);
    console.log(chalk.green('✓') + ` Registered project: ${projectName} (${teamType} team)`);
  }
}
