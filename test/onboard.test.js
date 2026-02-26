import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, rmSync, existsSync, readFileSync,
  mkdirSync, writeFileSync, lstatSync, readlinkSync, symlinkSync,
} from 'node:fs';
import { join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import yaml from 'js-yaml';
import { onboard } from '../lib/onboard.js';
import { withTempRallyHome } from './helpers/temp-env.js';

describe('onboard', () => {
  let tempDir;

  beforeEach((t) => {
    tempDir = mkdtempSync(join(tmpdir(), 'rally-onboard-test-'));
    withTempRallyHome(t);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  // Mock select that picks "shared" team (used for tests that don't test team selection itself)
  const sharedSelect = async () => 'shared';

  /**
   * Helper: set up a fake team directory with Squad files and write config.yaml
   */
  function setupTeam() {
    const rallyHome = process.env.RALLY_HOME;
    const teamDir = join(rallyHome, 'team');
    mkdirSync(join(teamDir, '.squad'), { recursive: true });
    mkdirSync(join(teamDir, '.squad-templates'), { recursive: true });
    mkdirSync(join(teamDir, '.github', 'agents'), { recursive: true });
    writeFileSync(join(teamDir, '.github', 'agents', 'squad.agent.md'), '# Agent');

    // Write config.yaml
    mkdirSync(rallyHome, { recursive: true });
    const config = { teamDir, projectsDir: join(rallyHome, 'projects'), version: '0.1.0' };
    writeFileSync(join(rallyHome, 'config.yaml'), yaml.dump(config), 'utf8');

    return { rallyHome, teamDir };
  }

  /**
   * Helper: create a real git repo at the given path (needed for git rev-parse)
   */
  function createRepo(repoPath) {
    mkdirSync(repoPath, { recursive: true });
    execFileSync('git', ['init', repoPath], { stdio: 'ignore' });
    return repoPath;
  }

  // --- Acceptance Criteria: Creates all required symlinks ---

  test('creates .squad symlink pointing to team dir', async () => {
    const { teamDir } = setupTeam();
    const repoPath = createRepo(join(tempDir, 'my-repo'));

    await onboard({ path: repoPath, _select: sharedSelect });

    const squadLink = join(repoPath, '.squad');
    assert.ok(existsSync(squadLink), '.squad should exist');
    const stats = lstatSync(squadLink);
    assert.ok(stats.isSymbolicLink(), '.squad should be a symlink');
    assert.strictEqual(readlinkSync(squadLink).replace(/[\\/]+$/, ''), join(teamDir, '.squad'));
  });

  test('creates .github/agents/squad.agent.md symlink', async () => {
    const { teamDir } = setupTeam();
    const repoPath = createRepo(join(tempDir, 'my-repo'));

    await onboard({ path: repoPath, _select: sharedSelect });

    const agentLink = join(repoPath, '.github', 'agents', 'squad.agent.md');
    assert.ok(existsSync(agentLink), 'squad.agent.md should exist');
    const stats = lstatSync(agentLink);
    assert.ok(stats.isSymbolicLink(), 'squad.agent.md should be a symlink');
    assert.strictEqual(
      readlinkSync(agentLink),
      join(teamDir, '.github', 'agents', 'squad.agent.md')
    );
  });

  test('creates .github/agents/ parent directory if missing', async () => {
    setupTeam();
    const repoPath = createRepo(join(tempDir, 'my-repo'));

    await onboard({ path: repoPath, _select: sharedSelect });

    assert.ok(existsSync(join(repoPath, '.github', 'agents')), '.github/agents/ should exist');
  });

  // --- Acceptance Criteria: Adds exclude entries ---

  test('adds standard exclude entries to .git/info/exclude', async () => {
    setupTeam();
    const repoPath = createRepo(join(tempDir, 'my-repo'));

    await onboard({ path: repoPath, _select: sharedSelect });

    const excludePath = join(repoPath, '.git', 'info', 'exclude');
    assert.ok(existsSync(excludePath), 'exclude file should exist');
    const content = readFileSync(excludePath, 'utf8');

    assert.ok(content.includes('.squad'), 'should exclude .squad');
    assert.ok(content.includes('.squad/'), 'should exclude .squad/');
    assert.ok(content.includes('.github/agents/squad.agent.md'), 'should exclude squad.agent.md');
    assert.ok(content.includes('.worktrees/'), 'should exclude .worktrees/');
  });

  // --- Acceptance Criteria: Registers project in projects.yaml ---

  test('registers project in projects.yaml', async () => {
    const { teamDir } = setupTeam();
    const repoPath = createRepo(join(tempDir, 'my-repo'));

    await onboard({ path: repoPath, _select: sharedSelect });

    const projectsPath = join(process.env.RALLY_HOME, 'projects.yaml');
    assert.ok(existsSync(projectsPath), 'projects.yaml should exist');

    const projects = yaml.load(readFileSync(projectsPath, 'utf8'), { schema: yaml.CORE_SCHEMA });
    assert.strictEqual(projects.projects.length, 1);
    assert.strictEqual(projects.projects[0].name, 'my-repo');
    assert.strictEqual(projects.projects[0].path, repoPath);
    assert.strictEqual(projects.projects[0].team, 'shared');
    assert.strictEqual(projects.projects[0].teamDir, teamDir);
    assert.ok(projects.projects[0].onboarded, 'should have onboarded timestamp');
  });

  // --- Acceptance Criteria: Idempotent on re-run ---

  test('idempotent: re-run skips existing symlinks and project registration', async () => {
    setupTeam();
    const repoPath = createRepo(join(tempDir, 'my-repo'));

    await onboard({ path: repoPath, _select: sharedSelect });
    await onboard({ path: repoPath, _select: sharedSelect });

    const projectsPath = join(process.env.RALLY_HOME, 'projects.yaml');
    const projects = yaml.load(readFileSync(projectsPath, 'utf8'), { schema: yaml.CORE_SCHEMA });
    assert.strictEqual(projects.projects.length, 1, 'should not duplicate project entry');
  });

  test('idempotent: re-run does not throw', async () => {
    setupTeam();
    const repoPath = createRepo(join(tempDir, 'my-repo'));

    await onboard({ path: repoPath, _select: sharedSelect });
    await assert.doesNotReject(() => onboard({ path: repoPath, _select: sharedSelect }));
  });

  // --- Error Cases ---

  test('error: not a git repo', async () => {
    setupTeam();
    const notARepo = join(tempDir, 'not-a-repo');
    mkdirSync(notARepo, { recursive: true });

    await assert.rejects(
      () => onboard({ path: notARepo }),
      (err) => {
        assert.ok(err.message.includes('Not a git repository'));
        return true;
      }
    );
  });

  test('error: shared team directory missing (no setup)', async () => {
    const repoPath = createRepo(join(tempDir, 'my-repo'));

    await assert.rejects(
      () => onboard({ path: repoPath, _select: sharedSelect }),
      (err) => {
        assert.ok(err.message.includes('Shared team directory not found'));
        return true;
      }
    );
  });

  test('error: shared team directory does not exist on disk', async () => {
    const rallyHome = process.env.RALLY_HOME;
    mkdirSync(rallyHome, { recursive: true });
    const config = {
      teamDir: join(rallyHome, 'nonexistent-team'),
      projectsDir: join(rallyHome, 'projects'),
    };
    writeFileSync(join(rallyHome, 'config.yaml'), yaml.dump(config), 'utf8');

    const repoPath = createRepo(join(tempDir, 'my-repo'));

    await assert.rejects(
      () => onboard({ path: repoPath, _select: sharedSelect }),
      (err) => {
        assert.ok(err.message.includes('Shared team directory not found'));
        return true;
      }
    );
  });

  // --- Default path (cwd) behavior ---

  test('defaults to cwd when no path argument given', async () => {
    setupTeam();
    const repoPath = createRepo(join(tempDir, 'cwd-repo'));

    const originalCwd = process.cwd();
    process.chdir(repoPath);
    try {
      await onboard({ _select: sharedSelect });

      const squadLink = join(repoPath, '.squad');
      assert.ok(existsSync(squadLink), '.squad symlink should exist');
    } finally {
      process.chdir(originalCwd);
    }
  });

  // --- .squad-templates/ symlink (review issue #1/#5) ---

  test('creates .squad-templates symlink pointing to team dir', async () => {
    const { teamDir } = setupTeam();
    const repoPath = createRepo(join(tempDir, 'my-repo'));

    await onboard({ path: repoPath, _select: sharedSelect });

    const templatesLink = join(repoPath, '.squad-templates');
    assert.ok(existsSync(templatesLink), '.squad-templates should exist');
    const stats = lstatSync(templatesLink);
    assert.ok(stats.isSymbolicLink(), '.squad-templates should be a symlink');
    assert.strictEqual(readlinkSync(templatesLink).replace(/[\\/]+$/, ''), join(teamDir, '.squad-templates'));
  });

  // --- Empty projects.yaml (review issue #3) ---

  test('handles empty projects.yaml without crashing', async () => {
    const { rallyHome } = setupTeam();
    const repoPath = createRepo(join(tempDir, 'my-repo'));

    // Write an empty projects.yaml (js-yaml.load returns undefined)
    writeFileSync(join(rallyHome, 'projects.yaml'), '', 'utf8');

    await assert.doesNotReject(() => onboard({ path: repoPath, _select: sharedSelect }));

    const projectsPath = join(rallyHome, 'projects.yaml');
    const projects = yaml.load(readFileSync(projectsPath, 'utf8'), { schema: yaml.CORE_SCHEMA });
    assert.strictEqual(projects.projects.length, 1);
  });

  // --- Stale project paths (review issue #4) ---

  test('handles stale project paths in projects.yaml without crashing', async () => {
    const { rallyHome, teamDir } = setupTeam();
    const repoPath = createRepo(join(tempDir, 'my-repo'));

    // Pre-register a project with a path that no longer exists
    const staleProjects = {
      projects: [
        { name: 'gone-repo', path: '/tmp/nonexistent-rally-path-12345', team: 'shared', teamDir },
      ],
    };
    writeFileSync(join(rallyHome, 'projects.yaml'), yaml.dump(staleProjects), 'utf8');

    await assert.doesNotReject(() => onboard({ path: repoPath, _select: sharedSelect }));

    const projectsPath = join(rallyHome, 'projects.yaml');
    const projects = yaml.load(readFileSync(projectsPath, 'utf8'), { schema: yaml.CORE_SCHEMA });
    assert.strictEqual(projects.projects.length, 2, 'should add new project alongside stale one');
  });

  // --- Existing path validation (review issue #7) ---

  test('warns when existing path is not a symlink', async () => {
    setupTeam();
    const repoPath = createRepo(join(tempDir, 'my-repo'));

    // Create a real directory where .squad symlink should go
    mkdirSync(join(repoPath, '.squad'), { recursive: true });

    const warnings = [];
    const origError = console.error;
    console.error = (msg) => warnings.push(msg);
    try {
      await onboard({ path: repoPath, _select: sharedSelect });
    } finally {
      console.error = origError;
    }

    assert.ok(
      warnings.some((w) => w.includes('exists but is not a symlink')),
      'should warn about non-symlink .squad'
    );
  });

  test('warns when symlink points to wrong target', async () => {
    const { teamDir } = setupTeam();
    const repoPath = createRepo(join(tempDir, 'my-repo'));

    // Create a symlink pointing to wrong target
    const wrongTarget = join(tempDir, 'wrong-target');
    mkdirSync(wrongTarget, { recursive: true });
    symlinkSync(wrongTarget, join(repoPath, '.squad'));

    const warnings = [];
    const origError = console.error;
    console.error = (msg) => warnings.push(msg);
    try {
      await onboard({ path: repoPath, _select: sharedSelect });
    } finally {
      console.error = origError;
    }

    assert.ok(
      warnings.some((w) => w.includes('expected') && w.includes(join(teamDir, '.squad'))),
      'should warn about wrong symlink target'
    );
  });

  // --- Interactive prompt reachability (review issue PR#34) ---

  test('onboard without --team calls selectTeam interactive prompt', async () => {
    const { teamDir } = setupTeam();
    const repoPath = createRepo(join(tempDir, 'my-repo'));

    let selectCalled = false;
    await onboard({
      path: repoPath,
      _select: async () => { selectCalled = true; return 'shared'; },
    });

    assert.ok(selectCalled, 'selectTeam should invoke the interactive prompt when no --team flag');
    const projectsPath = join(process.env.RALLY_HOME, 'projects.yaml');
    const projects = yaml.load(readFileSync(projectsPath, 'utf8'), { schema: yaml.CORE_SCHEMA });
    assert.strictEqual(projects.projects[0].team, 'shared');
    assert.strictEqual(projects.projects[0].teamDir, teamDir);
  });
});
