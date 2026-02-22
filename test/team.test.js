import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, rmSync, existsSync, readFileSync,
  mkdirSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import yaml from 'js-yaml';
import { selectTeam } from '../lib/team.js';
import { onboard } from '../lib/onboard.js';

describe('team selection', () => {
  let tempDir;
  let originalEnv;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'rally-team-test-'));
    originalEnv = process.env.RALLY_HOME;
    process.env.RALLY_HOME = join(tempDir, 'rally-home');
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.RALLY_HOME = originalEnv;
    } else {
      delete process.env.RALLY_HOME;
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  function setupRallyHome() {
    const rallyHome = process.env.RALLY_HOME;
    mkdirSync(rallyHome, { recursive: true });

    // Set up shared team
    const teamDir = join(rallyHome, 'team');
    mkdirSync(join(teamDir, '.squad'), { recursive: true });
    mkdirSync(join(teamDir, '.squad-templates'), { recursive: true });
    mkdirSync(join(teamDir, '.github', 'agents'), { recursive: true });
    writeFileSync(join(teamDir, '.github', 'agents', 'squad.agent.md'), '# Agent');

    // Write config.yaml
    const config = { teamDir, projectsDir: join(rallyHome, 'projects'), version: '0.1.0' };
    writeFileSync(join(rallyHome, 'config.yaml'), yaml.dump(config), 'utf8');

    return { rallyHome, teamDir };
  }

  function createRepo(repoPath) {
    mkdirSync(repoPath, { recursive: true });
    execFileSync('git', ['init', repoPath], { stdio: 'ignore' });
    return repoPath;
  }

  // Fake exec that simulates npx squad init by creating .squad/
  function fakeExec(cmd, args, opts) {
    if (cmd === 'npx') {
      mkdirSync(join(opts.cwd, '.squad'), { recursive: true });
      mkdirSync(join(opts.cwd, '.squad-templates'), { recursive: true });
      mkdirSync(join(opts.cwd, '.github', 'agents'), { recursive: true });
      writeFileSync(join(opts.cwd, '.github', 'agents', 'squad.agent.md'), '# Agent');
    }
  }

  // --- selectTeam unit tests ---

  describe('selectTeam', () => {
    test('--team flag skips prompt and creates team directory', async () => {
      setupRallyHome();

      const result = await selectTeam({
        team: 'my-project',
        _exec: fakeExec,
      });

      const expectedDir = join(process.env.RALLY_HOME, 'teams', 'my-project');
      assert.strictEqual(result.teamDir, expectedDir);
      assert.strictEqual(result.teamType, 'project');
      assert.ok(existsSync(expectedDir), 'team directory should be created');
      assert.ok(existsSync(join(expectedDir, '.squad')), '.squad should be initialized');
    });

    test('--team flag reuses existing team directory', async () => {
      const { rallyHome } = setupRallyHome();
      const teamDir = join(rallyHome, 'teams', 'existing-team');
      mkdirSync(join(teamDir, '.squad'), { recursive: true });

      let execCalled = false;
      const result = await selectTeam({
        team: 'existing-team',
        _exec: () => { execCalled = true; },
      });

      assert.strictEqual(result.teamDir, teamDir);
      assert.strictEqual(result.teamType, 'project');
      assert.ok(!execCalled, 'should not run exec for existing team');
    });

    test('error on invalid team name', async () => {
      setupRallyHome();

      await assert.rejects(
        () => selectTeam({ team: 'bad name!' }),
        (err) => {
          assert.ok(err.message.includes('Invalid team name'));
          return true;
        }
      );
    });

    test('error on team name with spaces', async () => {
      setupRallyHome();

      await assert.rejects(
        () => selectTeam({ team: 'has spaces' }),
        (err) => {
          assert.ok(err.message.includes('Invalid team name'));
          return true;
        }
      );
    });

    test('interactive select: shared team returns config team dir', async () => {
      const { teamDir } = setupRallyHome();

      const result = await selectTeam({
        _select: async () => 'shared',
        _input: async () => '',
      });

      assert.strictEqual(result.teamDir, teamDir);
      assert.strictEqual(result.teamType, 'shared');
    });

    test('interactive select: new project team creates directory', async () => {
      setupRallyHome();

      const result = await selectTeam({
        _select: async () => 'project',
        _input: async () => 'new-team',
        _exec: fakeExec,
      });

      const expectedDir = join(process.env.RALLY_HOME, 'teams', 'new-team');
      assert.strictEqual(result.teamDir, expectedDir);
      assert.strictEqual(result.teamType, 'project');
      assert.ok(existsSync(expectedDir), 'team directory should be created');
    });
  });

  // --- Integration with onboard ---

  describe('onboard with --team', () => {
    test('--team flag creates project team and records in projects.yaml', async () => {
      setupRallyHome();
      const repoPath = createRepo(join(tempDir, 'my-repo'));

      await onboard({
        path: repoPath,
        team: 'my-team',
        _exec: fakeExec,
      });

      // Verify projects.yaml records team type
      const projectsPath = join(process.env.RALLY_HOME, 'projects.yaml');
      const projects = yaml.load(readFileSync(projectsPath, 'utf8'));
      assert.strictEqual(projects.projects.length, 1);
      assert.strictEqual(projects.projects[0].team, 'project');
      assert.ok(projects.projects[0].teamDir.includes('my-team'));
    });

    test('--team flag creates symlinks pointing to project team dir', async () => {
      setupRallyHome();
      const repoPath = createRepo(join(tempDir, 'my-repo'));

      await onboard({
        path: repoPath,
        team: 'link-team',
        _exec: fakeExec,
      });

      const expectedTeamDir = join(process.env.RALLY_HOME, 'teams', 'link-team');
      const { lstatSync, readlinkSync } = await import('node:fs');
      const squadLink = join(repoPath, '.squad');
      assert.ok(existsSync(squadLink), '.squad should exist');
      assert.ok(lstatSync(squadLink).isSymbolicLink(), '.squad should be a symlink');
      assert.strictEqual(
        readlinkSync(squadLink),
        join(expectedTeamDir, '.squad')
      );
    });

    test('onboard without --team uses selectTeam interactive prompt', async () => {
      const { teamDir } = setupRallyHome();
      const repoPath = createRepo(join(tempDir, 'my-repo'));

      await onboard({ path: repoPath, _select: async () => 'shared' });

      const projectsPath = join(process.env.RALLY_HOME, 'projects.yaml');
      const projects = yaml.load(readFileSync(projectsPath, 'utf8'));
      assert.strictEqual(projects.projects[0].team, 'shared');
      assert.strictEqual(projects.projects[0].teamDir, teamDir);
    });

    test('--team with invalid name errors before touching filesystem', async () => {
      setupRallyHome();
      const repoPath = createRepo(join(tempDir, 'my-repo'));

      await assert.rejects(
        () => onboard({ path: repoPath, team: 'bad name!' }),
        (err) => {
          assert.ok(err.message.includes('Invalid team name'));
          return true;
        }
      );

      // No projects.yaml should be created
      const projectsPath = join(process.env.RALLY_HOME, 'projects.yaml');
      assert.ok(!existsSync(projectsPath) || yaml.load(readFileSync(projectsPath, 'utf8'))?.projects?.length === 0 || !existsSync(projectsPath));
    });
  });

  // --- Partial team dir recovery (review issue PR#34) ---

  describe('partial team dir recovery', () => {
    test('--team re-inits when dir exists but .squad/ is missing', async () => {
      setupRallyHome();
      const teamsDir = join(process.env.RALLY_HOME, 'teams');
      const partialDir = join(teamsDir, 'broken-team');
      mkdirSync(partialDir, { recursive: true });
      // Dir exists but no .squad inside

      let execCalled = false;
      const result = await selectTeam({
        team: 'broken-team',
        _exec: (cmd, args, opts) => {
          execCalled = true;
          fakeExec(cmd, args, opts);
        },
      });

      assert.ok(execCalled, 'should re-run init for partial team dir');
      assert.strictEqual(result.teamDir, partialDir);
      assert.ok(existsSync(join(partialDir, '.squad')), '.squad should now exist');
    });

    test('interactive re-inits when dir exists but .squad/ is missing', async () => {
      setupRallyHome();
      const teamsDir = join(process.env.RALLY_HOME, 'teams');
      const partialDir = join(teamsDir, 'half-done');
      mkdirSync(partialDir, { recursive: true });

      let execCalled = false;
      const result = await selectTeam({
        _select: async () => 'project',
        _input: async () => 'half-done',
        _exec: (cmd, args, opts) => {
          execCalled = true;
          fakeExec(cmd, args, opts);
        },
      });

      assert.ok(execCalled, 'should re-run init for partial team dir');
      assert.strictEqual(result.teamDir, partialDir);
      assert.ok(existsSync(join(partialDir, '.squad')), '.squad should now exist');
    });

    test('failed squad init cleans up team directory', async () => {
      setupRallyHome();

      const failingExec = () => { throw new Error('squad init exploded'); };

      await assert.rejects(
        () => selectTeam({ team: 'doomed-team', _exec: failingExec }),
        (err) => {
          assert.ok(err.message.includes('Squad init failed'));
          return true;
        }
      );

      const teamDir = join(process.env.RALLY_HOME, 'teams', 'doomed-team');
      assert.ok(!existsSync(teamDir), 'team dir should be cleaned up after failed init');
    });
  });
});
