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
import { parseGithubUrl, onboard } from '../lib/onboard.js';
import { withTempRallyHome } from './helpers/temp-env.js';

// ─── parseGithubUrl unit tests ───────────────────────────────────────────────

describe('parseGithubUrl', () => {
  test('parses full https URL', () => {
    const result = parseGithubUrl('https://github.com/octocat/Hello-World');
    assert.deepStrictEqual(result, {
      owner: 'octocat',
      repo: 'Hello-World',
      cloneUrl: 'https://github.com/octocat/Hello-World.git',
    });
  });

  test('parses full https URL with .git suffix', () => {
    const result = parseGithubUrl('https://github.com/octocat/Hello-World.git');
    assert.deepStrictEqual(result, {
      owner: 'octocat',
      repo: 'Hello-World',
      cloneUrl: 'https://github.com/octocat/Hello-World.git',
    });
  });

  test('parses owner/repo shorthand', () => {
    const result = parseGithubUrl('octocat/Hello-World');
    assert.deepStrictEqual(result, {
      owner: 'octocat',
      repo: 'Hello-World',
      cloneUrl: 'https://github.com/octocat/Hello-World.git',
    });
  });

  test('handles dots and underscores in names', () => {
    const result = parseGithubUrl('my_org/my.repo');
    assert.deepStrictEqual(result, {
      owner: 'my_org',
      repo: 'my.repo',
      cloneUrl: 'https://github.com/my_org/my.repo.git',
    });
  });

  test('returns null for absolute path', () => {
    assert.strictEqual(parseGithubUrl('/home/user/my-repo'), null);
  });

  test('returns null for relative path with nested dirs', () => {
    assert.strictEqual(parseGithubUrl('./some/path/to/repo'), null);
  });

  test('returns null for plain directory name', () => {
    assert.strictEqual(parseGithubUrl('my-repo'), null);
  });

  test('returns null for null/undefined input', () => {
    assert.strictEqual(parseGithubUrl(null), null);
    assert.strictEqual(parseGithubUrl(undefined), null);
  });

  test('returns null for empty string', () => {
    assert.strictEqual(parseGithubUrl(''), null);
  });

  test('returns null for non-GitHub URL', () => {
    assert.strictEqual(parseGithubUrl('https://gitlab.com/owner/repo'), null);
  });

  test('returns null for path-traversal repo name with ..', () => {
    assert.strictEqual(parseGithubUrl('owner/..'), null);
    assert.strictEqual(parseGithubUrl('https://github.com/owner/..'), null);
  });

  test('parses full URL with trailing slash', () => {
    const result = parseGithubUrl('https://github.com/octocat/Hello-World/');
    assert.deepStrictEqual(result, {
      owner: 'octocat',
      repo: 'Hello-World',
      cloneUrl: 'https://github.com/octocat/Hello-World.git',
    });
  });

  test('parses SSH URL git@github.com:owner/repo', () => {
    const result = parseGithubUrl('git@github.com:octocat/Hello-World');
    assert.deepStrictEqual(result, {
      owner: 'octocat',
      repo: 'Hello-World',
      cloneUrl: 'git@github.com:octocat/Hello-World.git',
    });
  });

  test('parses SSH URL with .git suffix', () => {
    const result = parseGithubUrl('git@github.com:octocat/Hello-World.git');
    assert.deepStrictEqual(result, {
      owner: 'octocat',
      repo: 'Hello-World',
      cloneUrl: 'git@github.com:octocat/Hello-World.git',
    });
  });

  test('returns null for SSH path-traversal', () => {
    assert.strictEqual(parseGithubUrl('git@github.com:owner/..'), null);
  });
});

// ─── onboard with URL integration tests ──────────────────────────────────────

describe('onboard URL cloning', () => {
  let tempDir;

  // Mock select that picks "shared" team (used for tests that don't test team selection itself)
  

  beforeEach((t) => {
    tempDir = mkdtempSync(join(tmpdir(), 'rally-url-test-'));
    withTempRallyHome(t);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function setupTeam() {
    const rallyHome = process.env.RALLY_HOME;
    const teamDir = join(rallyHome, 'team');
    mkdirSync(join(teamDir, '.squad'), { recursive: true });
    mkdirSync(join(teamDir, '.squad-templates'), { recursive: true });
    mkdirSync(join(teamDir, '.github', 'agents'), { recursive: true });
    writeFileSync(join(teamDir, '.github', 'agents', 'squad.agent.md'), '# Agent');

    mkdirSync(rallyHome, { recursive: true });
    const config = { teamDir, projectsDir: join(rallyHome, 'projects'), version: '0.1.0' };
    writeFileSync(join(rallyHome, 'config.yaml'), yaml.dump(config), 'utf8');

    return { rallyHome, teamDir };
  }

  /**
   * Create a local bare repo that can be cloned without network access.
   * Returns the file:// URL and the repo name.
   */
  function createBareRepo(name) {
    const barePath = join(tempDir, `${name}.git`);
    mkdirSync(barePath, { recursive: true });
    execFileSync('git', ['init', '--bare', barePath], { stdio: 'ignore' });

    // Push an initial commit so clone has something to work with
    const scratchDir = join(tempDir, `${name}-scratch`);
    mkdirSync(scratchDir, { recursive: true });
    execFileSync('git', ['init', scratchDir], { stdio: 'ignore' });
    execFileSync('git', ['-C', scratchDir, 'config', 'user.email', 'test@test.com'], { stdio: 'ignore' });
    execFileSync('git', ['-C', scratchDir, 'config', 'user.name', 'Test'], { stdio: 'ignore' });
    writeFileSync(join(scratchDir, 'README.md'), '# test');
    execFileSync('git', ['-C', scratchDir, 'add', '.'], { stdio: 'ignore' });
    execFileSync('git', ['-C', scratchDir, 'commit', '-m', 'init'], { stdio: 'ignore' });
    execFileSync('git', ['-C', scratchDir, 'remote', 'add', 'origin', barePath], { stdio: 'ignore' });
    execFileSync('git', ['-C', scratchDir, 'push', 'origin', 'HEAD'], { stdio: 'ignore' });
    rmSync(scratchDir, { recursive: true, force: true });

    return barePath;
  }

  test('clones from owner/repo shorthand (using local bare repo)', async () => {
    const { rallyHome, teamDir } = setupTeam();
    const barePath = createBareRepo('my-project');

    // Monkey-patch: onboard will call `git clone <url> <target>`. We can't use
    // real GitHub URLs in tests, so we test the parseGithubUrl function separately
    // and here we test the clone-skip-if-exists path by pre-cloning.
    const projectsDir = join(rallyHome, 'projects');
    mkdirSync(projectsDir, { recursive: true });
    execFileSync('git', ['clone', barePath, join(projectsDir, 'my-project')], { stdio: 'ignore' });

    // Now onboard with a "shorthand" — it should detect the existing clone and skip
    await onboard({ path: 'octocat/my-project', _selectTeam: () => ({ teamDir, teamType: 'shared' }), _ensurePersonalSquad: async () => true });

    const projectsPath = join(rallyHome, 'projects.yaml');
    const projects = yaml.load(readFileSync(projectsPath, 'utf8'), { schema: yaml.CORE_SCHEMA });
    assert.strictEqual(projects.projects.length, 1);
    assert.strictEqual(projects.projects[0].name, 'my-project');
  });

  test('skips clone when target directory already exists', async () => {
    const { rallyHome, teamDir } = setupTeam();
    const barePath = createBareRepo('existing-repo');

    // Pre-create the clone target
    const projectsDir = join(rallyHome, 'projects');
    mkdirSync(projectsDir, { recursive: true });
    execFileSync('git', ['clone', barePath, join(projectsDir, 'existing-repo')], { stdio: 'ignore' });

    // Should not throw or attempt a second clone
    await onboard({ path: 'someone/existing-repo', _selectTeam: () => ({ teamDir, teamType: 'shared' }), _ensurePersonalSquad: async () => true });

    assert.ok(existsSync(join(projectsDir, 'existing-repo', '.squad')), '.squad symlink should exist');
  });

  test('onboard proceeds with normal onboard flow after clone', async () => {
    const { rallyHome, teamDir } = setupTeam();
    const barePath = createBareRepo('flow-test');

    // Pre-clone to avoid network calls
    const projectsDir = join(rallyHome, 'projects');
    mkdirSync(projectsDir, { recursive: true });
    execFileSync('git', ['clone', barePath, join(projectsDir, 'flow-test')], { stdio: 'ignore' });

    await onboard({ path: 'user/flow-test', _selectTeam: () => ({ teamDir, teamType: 'shared' }), _ensurePersonalSquad: async () => true });

    const clonedPath = join(projectsDir, 'flow-test');
    // Verify symlinks created
    assert.ok(existsSync(join(clonedPath, '.squad')), '.squad should exist');
    assert.ok(existsSync(join(clonedPath, '.squad-templates')), '.squad-templates should exist');

    // Verify registered in projects.yaml
    const projectsPath = join(rallyHome, 'projects.yaml');
    const projects = yaml.load(readFileSync(projectsPath, 'utf8'), { schema: yaml.CORE_SCHEMA });
    assert.strictEqual(projects.projects[0].name, 'flow-test');
    assert.ok(projects.projects[0].onboarded, 'should have onboarded timestamp');
  });

  test('clone failure throws descriptive error', async () => {
    const { teamDir } = setupTeam();

    const _clone = () => {
      const err = new Error('fatal: repository not found');
      err.stderr = Buffer.from('fatal: repository \'https://github.com/nonexistent-owner-xyz/nonexistent-repo-xyz.git\' not found');
      throw err;
    };

    await assert.rejects(
      () => onboard({ path: 'https://github.com/nonexistent-owner-xyz/nonexistent-repo-xyz', _clone }),
      (err) => {
        assert.ok(err.message.includes('Clone failed'), `Expected "Clone failed" but got: ${err.message}`);
        return true;
      }
    );
  });

  test('rejects collision when directory exists with different owner', async () => {
    const { rallyHome, teamDir } = setupTeam();
    const projectsDir = join(rallyHome, 'projects');
    mkdirSync(projectsDir, { recursive: true });

    // Create a mock repo with ownerA/my-repo as its remote
    const targetDir = join(projectsDir, 'my-repo');
    mkdirSync(targetDir, { recursive: true });
    execFileSync('git', ['init', targetDir], { stdio: 'ignore' });
    execFileSync('git', ['-C', targetDir, 'config', 'user.email', 'test@test.com'], { stdio: 'ignore' });
    execFileSync('git', ['-C', targetDir, 'config', 'user.name', 'Test'], { stdio: 'ignore' });
    execFileSync('git', ['-C', targetDir, 'remote', 'add', 'origin', 'https://github.com/ownerA/my-repo.git'], { stdio: 'ignore' });

    // Now try to onboard ownerB/my-repo — should throw collision error
    await assert.rejects(
      () => onboard({ path: 'ownerB/my-repo', _selectTeam: () => ({ teamDir, teamType: 'shared' }), _ensurePersonalSquad: async () => true }),
      (err) => {
        assert.ok(
          err.message.includes('already exists but belongs to a different repository'),
          `Expected collision error but got: ${err.message}`
        );
        assert.ok(err.message.includes('ownerB/my-repo'), 'Error should mention expected owner/repo');
        assert.ok(err.message.includes('ownerA/my-repo'), 'Error should mention found owner/repo');
        return true;
      }
    );
  });

  test('onboard allows reuse when directory exists with matching owner (HTTPS)', async () => {
    const { rallyHome, teamDir } = setupTeam();
    const projectsDir = join(rallyHome, 'projects');
    mkdirSync(projectsDir, { recursive: true });

    // Create a mock repo with correct owner/repo as its remote
    const targetDir = join(projectsDir, 'my-repo');
    mkdirSync(targetDir, { recursive: true });
    execFileSync('git', ['init', targetDir], { stdio: 'ignore' });
    execFileSync('git', ['-C', targetDir, 'config', 'user.email', 'test@test.com'], { stdio: 'ignore' });
    execFileSync('git', ['-C', targetDir, 'config', 'user.name', 'Test'], { stdio: 'ignore' });
    execFileSync('git', ['-C', targetDir, 'remote', 'add', 'origin', 'https://github.com/octocat/my-repo.git'], { stdio: 'ignore' });

    // Try to onboard octocat/my-repo — should succeed (reuse existing directory)
    await onboard({ path: 'octocat/my-repo', _selectTeam: () => ({ teamDir, teamType: 'shared' }), _ensurePersonalSquad: async () => true });

    assert.ok(existsSync(join(targetDir, '.squad')), '.squad symlink should exist after onboard');
  });

  test('onboard allows reuse when directory exists with matching owner (SSH)', async () => {
    const { rallyHome, teamDir } = setupTeam();
    const projectsDir = join(rallyHome, 'projects');
    mkdirSync(projectsDir, { recursive: true });

    // Create a mock repo with SSH remote URL
    const targetDir = join(projectsDir, 'my-repo');
    mkdirSync(targetDir, { recursive: true });
    execFileSync('git', ['init', targetDir], { stdio: 'ignore' });
    execFileSync('git', ['-C', targetDir, 'config', 'user.email', 'test@test.com'], { stdio: 'ignore' });
    execFileSync('git', ['-C', targetDir, 'config', 'user.name', 'Test'], { stdio: 'ignore' });
    execFileSync('git', ['-C', targetDir, 'remote', 'add', 'origin', 'git@github.com:octocat/my-repo.git'], { stdio: 'ignore' });

    // Try to onboard octocat/my-repo — should succeed (reuse existing directory)
    await onboard({ path: 'octocat/my-repo', _selectTeam: () => ({ teamDir, teamType: 'shared' }), _ensurePersonalSquad: async () => true });

    assert.ok(existsSync(join(targetDir, '.squad')), '.squad symlink should exist after onboard');
  });

  test('onboard passes local path unchanged', async () => {
    const { teamDir } = setupTeam();
    const repoPath = join(tempDir, 'local-repo');
    mkdirSync(repoPath, { recursive: true });
    execFileSync('git', ['init', repoPath], { stdio: 'ignore' });

    await onboard({ path: repoPath, _selectTeam: () => ({ teamDir, teamType: 'shared' }), _ensurePersonalSquad: async () => true });

    assert.ok(existsSync(join(repoPath, '.squad')), '.squad should exist for local path');
  });
});
