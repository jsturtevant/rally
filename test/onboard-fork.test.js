import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, rmSync, readFileSync,
  mkdirSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import yaml from 'js-yaml';
import { parseForkArg, configureForkRemotes, onboard } from '../lib/onboard.js';
import { withTempRallyHome } from './helpers/temp-env.js';

// ─── parseForkArg unit tests ─────────────────────────────────────────────────

describe('parseForkArg', () => {
  test('parses valid owner/repo', () => {
    const result = parseForkArg('myuser/myrepo');
    assert.deepStrictEqual(result, { owner: 'myuser', repo: 'myrepo' });
  });

  test('parses owner/repo with dots and underscores', () => {
    const result = parseForkArg('my_org/my.repo');
    assert.deepStrictEqual(result, { owner: 'my_org', repo: 'my.repo' });
  });

  test('returns null for null/undefined', () => {
    assert.strictEqual(parseForkArg(null), null);
    assert.strictEqual(parseForkArg(undefined), null);
  });

  test('throws on invalid format (plain name)', () => {
    assert.throws(() => parseForkArg('justarepo'), /Invalid --fork format/);
  });

  test('throws on invalid format (full URL)', () => {
    assert.throws(() => parseForkArg('https://github.com/owner/repo'), /Invalid --fork format/);
  });

  test('throws on invalid format (three segments)', () => {
    assert.throws(() => parseForkArg('a/b/c'), /Invalid --fork format/);
  });

  test('rejects path traversal in owner or repo', () => {
    assert.throws(() => parseForkArg('../evil'), /Invalid --fork/);
    assert.throws(() => parseForkArg('owner/..'), /Invalid --fork/);
    assert.throws(() => parseForkArg('./repo'), /Invalid --fork/);
  });
});

// ─── configureForkRemotes unit tests ─────────────────────────────────────────

describe('configureForkRemotes', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'rally-fork-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function createRepoWithOrigin(name, originUrl) {
    const repoPath = join(tempDir, name);
    mkdirSync(repoPath, { recursive: true });
    execFileSync('git', ['init', repoPath], { stdio: 'ignore' });
    execFileSync('git', ['-C', repoPath, 'config', 'user.email', 'test@test.com'], { stdio: 'ignore' });
    execFileSync('git', ['-C', repoPath, 'config', 'user.name', 'Test'], { stdio: 'ignore' });
    writeFileSync(join(repoPath, 'README.md'), '# test');
    execFileSync('git', ['-C', repoPath, 'add', '.'], { stdio: 'ignore' });
    execFileSync('git', ['-C', repoPath, 'commit', '-m', 'init'], { stdio: 'ignore' });
    if (originUrl) {
      execFileSync('git', ['-C', repoPath, 'remote', 'add', 'origin', originUrl], { stdio: 'ignore' });
    }
    return repoPath;
  }

  // Skip fetch for tests (no network), uses execFileSync signature
  function makeExecNoFetch(repoPath) {
    return (cmd, args, opts) => {
      if (cmd === 'gh') return '';
      if (args.includes('fetch')) return '';
      return execFileSync(cmd, args, { ...opts, cwd: repoPath, encoding: 'utf8', stdio: 'pipe' });
    };
  }

  test('configureForkRemotes renames origin to upstream and adds fork as origin', () => {
    const repoPath = createRepoWithOrigin('test-repo', 'https://github.com/upstream-org/project.git');
    const exec = makeExecNoFetch(repoPath);

    configureForkRemotes(repoPath, 'myuser/project', exec);

    const upstream = execFileSync('git', ['-C', repoPath, 'remote', 'get-url', 'upstream'], { encoding: 'utf8' }).trim();
    assert.strictEqual(upstream, 'https://github.com/upstream-org/project.git');

    const origin = execFileSync('git', ['-C', repoPath, 'remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim();
    assert.strictEqual(origin, 'https://github.com/myuser/project.git');
  });

  test('preserves existing upstream and sets origin to fork', () => {
    const repoPath = createRepoWithOrigin('test-repo2', 'https://github.com/old-origin/project.git');
    execFileSync('git', ['-C', repoPath, 'remote', 'add', 'upstream', 'https://github.com/upstream-org/project.git'], { stdio: 'ignore' });
    const exec = makeExecNoFetch(repoPath);

    configureForkRemotes(repoPath, 'myuser/project', exec);

    // upstream should be unchanged
    const upstream = execFileSync('git', ['-C', repoPath, 'remote', 'get-url', 'upstream'], { encoding: 'utf8' }).trim();
    assert.strictEqual(upstream, 'https://github.com/upstream-org/project.git');

    // origin should be updated to fork
    const origin = execFileSync('git', ['-C', repoPath, 'remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim();
    assert.strictEqual(origin, 'https://github.com/myuser/project.git');
  });

  test('throws when no origin remote exists and no upstream', () => {
    const repoPath = join(tempDir, 'no-remotes');
    mkdirSync(repoPath, { recursive: true });
    execFileSync('git', ['init', repoPath], { stdio: 'ignore' });
    execFileSync('git', ['-C', repoPath, 'config', 'user.email', 'test@test.com'], { stdio: 'ignore' });
    execFileSync('git', ['-C', repoPath, 'config', 'user.name', 'Test'], { stdio: 'ignore' });
    writeFileSync(join(repoPath, 'README.md'), '# test');
    execFileSync('git', ['-C', repoPath, 'add', '.'], { stdio: 'ignore' });
    execFileSync('git', ['-C', repoPath, 'commit', '-m', 'init'], { stdio: 'ignore' });
    const exec = makeExecNoFetch(repoPath);

    assert.throws(
      () => configureForkRemotes(repoPath, 'myuser/project', exec),
      /Failed to rename origin to upstream/
    );
  });

  test('returns parsed fork info', () => {
    const repoPath = createRepoWithOrigin('test-return', 'https://github.com/upstream/project.git');
    const exec = makeExecNoFetch(repoPath);

    const result = configureForkRemotes(repoPath, 'myuser/project', exec);
    assert.deepStrictEqual(result, { owner: 'myuser', repo: 'project' });
  });
});

// ─── onboard --fork integration tests ────────────────────────────────────────

describe('onboard --fork integration', () => {
  let tempDir;

  const sharedSelect = async () => 'shared';

  beforeEach((t) => {
    tempDir = mkdtempSync(join(tmpdir(), 'rally-fork-integ-'));
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

  function createRepoWithOrigin(name, originUrl) {
    const repoPath = join(tempDir, name);
    mkdirSync(repoPath, { recursive: true });
    execFileSync('git', ['init', repoPath], { stdio: 'ignore' });
    execFileSync('git', ['-C', repoPath, 'config', 'user.email', 'test@test.com'], { stdio: 'ignore' });
    execFileSync('git', ['-C', repoPath, 'config', 'user.name', 'Test'], { stdio: 'ignore' });
    writeFileSync(join(repoPath, 'README.md'), '# test');
    execFileSync('git', ['-C', repoPath, 'add', '.'], { stdio: 'ignore' });
    execFileSync('git', ['-C', repoPath, 'commit', '-m', 'init'], { stdio: 'ignore' });
    if (originUrl) {
      execFileSync('git', ['-C', repoPath, 'remote', 'add', 'origin', originUrl], { stdio: 'ignore' });
    }
    return repoPath;
  }

  test('--fork stores fork in projects.yaml', async () => {
    const { rallyHome } = setupTeam();
    const repoPath = createRepoWithOrigin('my-repo', 'https://github.com/upstream-org/my-repo.git');

    // Injectable _exec that skips fetch but delegates other commands
    const _exec = (cmd, args, opts) => {
      if (cmd === 'gh') return '';
      if (args.includes('fetch')) return '';
      return execFileSync(cmd, args, { ...opts, cwd: repoPath, encoding: 'utf8', stdio: 'pipe' });
    };

    await onboard({ path: repoPath, fork: 'myuser/my-repo', _select: sharedSelect, _exec });

    const projectsPath = join(rallyHome, 'projects.yaml');
    const projects = yaml.load(readFileSync(projectsPath, 'utf8'), { schema: yaml.CORE_SCHEMA });
    assert.strictEqual(projects.projects[0].fork, 'myuser/my-repo');
  });

  test('--fork configures remotes correctly', async () => {
    setupTeam();
    const repoPath = createRepoWithOrigin('fork-remotes', 'https://github.com/upstream-org/fork-remotes.git');

    const _exec = (cmd, args, opts) => {
      if (cmd === 'gh') return '';
      if (args.includes('fetch')) return '';
      return execFileSync(cmd, args, { ...opts, cwd: repoPath, encoding: 'utf8', stdio: 'pipe' });
    };

    await onboard({ path: repoPath, fork: 'myuser/fork-remotes', _select: sharedSelect, _exec });

    const upstream = execFileSync('git', ['-C', repoPath, 'remote', 'get-url', 'upstream'], { encoding: 'utf8' }).trim();
    assert.strictEqual(upstream, 'https://github.com/upstream-org/fork-remotes.git');

    const origin = execFileSync('git', ['-C', repoPath, 'remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim();
    assert.strictEqual(origin, 'https://github.com/myuser/fork-remotes.git');
  });

  test('--fork not provided leaves remotes unchanged', async () => {
    setupTeam();
    const repoPath = createRepoWithOrigin('no-fork', 'https://github.com/upstream-org/no-fork.git');

    await onboard({ path: repoPath, _select: sharedSelect });

    const origin = execFileSync('git', ['-C', repoPath, 'remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim();
    assert.strictEqual(origin, 'https://github.com/upstream-org/no-fork.git');

    // upstream should NOT exist
    assert.throws(
      () => execFileSync('git', ['-C', repoPath, 'remote', 'get-url', 'upstream'], { encoding: 'utf8', stdio: 'pipe' }),
    );
  });

  test('--fork does not store fork field when not provided', async () => {
    const { rallyHome } = setupTeam();
    const repoPath = createRepoWithOrigin('no-fork-field', 'https://github.com/upstream-org/no-fork-field.git');

    await onboard({ path: repoPath, _select: sharedSelect });

    const projectsPath = join(rallyHome, 'projects.yaml');
    const projects = yaml.load(readFileSync(projectsPath, 'utf8'), { schema: yaml.CORE_SCHEMA });
    assert.strictEqual(projects.projects[0].fork, undefined);
  });

  test('--fork with invalid format throws error', async () => {
    setupTeam();
    const repoPath = createRepoWithOrigin('bad-fork', 'https://github.com/upstream-org/bad-fork.git');

    await assert.rejects(
      () => onboard({ path: repoPath, fork: 'not-valid', _select: sharedSelect }),
      /Invalid --fork format/
    );
  });

  test('--fork with existing upstream preserves it', async () => {
    setupTeam();
    const repoPath = createRepoWithOrigin('has-upstream', 'https://github.com/old-origin/has-upstream.git');
    execFileSync('git', ['-C', repoPath, 'remote', 'add', 'upstream', 'https://github.com/upstream-org/has-upstream.git'], { stdio: 'ignore' });

    const _exec = (cmd, args, opts) => {
      if (cmd === 'gh') return '';
      if (args.includes('fetch')) return '';
      return execFileSync(cmd, args, { ...opts, cwd: repoPath, encoding: 'utf8', stdio: 'pipe' });
    };

    await onboard({ path: repoPath, fork: 'myuser/has-upstream', _select: sharedSelect, _exec });

    const upstream = execFileSync('git', ['-C', repoPath, 'remote', 'get-url', 'upstream'], { encoding: 'utf8' }).trim();
    assert.strictEqual(upstream, 'https://github.com/upstream-org/has-upstream.git');

    const origin = execFileSync('git', ['-C', repoPath, 'remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim();
    assert.strictEqual(origin, 'https://github.com/myuser/has-upstream.git');
  });

  test('--fork without path clones upstream and sets up fork remotes (#210)', async () => {
    const { rallyHome } = setupTeam();

    // Simulate: rally onboard --fork upstream-org/my-project (no path argument)
    // _clone creates a real git repo to simulate the clone
    let clonedUrl, clonedTarget;
    const _clone = (url, target) => {
      clonedUrl = url;
      clonedTarget = target;
      mkdirSync(target, { recursive: true });
      execFileSync('git', ['init', target], { stdio: 'ignore' });
      execFileSync('git', ['-C', target, 'config', 'user.email', 'test@test.com'], { stdio: 'ignore' });
      execFileSync('git', ['-C', target, 'config', 'user.name', 'Test'], { stdio: 'ignore' });
      writeFileSync(join(target, 'README.md'), '# test');
      execFileSync('git', ['-C', target, 'add', '.'], { stdio: 'ignore' });
      execFileSync('git', ['-C', target, 'commit', '-m', 'init'], { stdio: 'ignore' });
      execFileSync('git', ['-C', target, 'remote', 'add', 'origin', url], { stdio: 'ignore' });
    };

    const _exec = (cmd, args, opts) => {
      // Mock gh api user to return a test username
      if (cmd === 'gh' && args[0] === 'api' && args[1] === 'user') {
        return 'testuser\n';
      }
      if (cmd === 'gh') return '';
      if (args.includes('fetch')) return '';
      return execFileSync(cmd, args, { ...opts, encoding: 'utf8', stdio: 'pipe' });
    };

    await onboard({
      fork: 'upstream-org/my-project',
      _clone,
      _exec,
      _select: sharedSelect,
    });

    // Should have cloned the upstream repo
    assert.strictEqual(clonedUrl, 'https://github.com/upstream-org/my-project.git');
    assert.ok(clonedTarget.endsWith('my-project'));

    // Remotes: origin → user's fork, upstream → upstream repo
    const upstream = execFileSync('git', ['-C', clonedTarget, 'remote', 'get-url', 'upstream'], { encoding: 'utf8' }).trim();
    assert.strictEqual(upstream, 'https://github.com/upstream-org/my-project.git');

    const origin = execFileSync('git', ['-C', clonedTarget, 'remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim();
    assert.strictEqual(origin, 'https://github.com/testuser/my-project.git');

    // Project should be registered with fork info
    const projectsPath = join(rallyHome, 'projects.yaml');
    const projects = yaml.load(readFileSync(projectsPath, 'utf8'), { schema: yaml.CORE_SCHEMA });
    assert.strictEqual(projects.projects[0].repo, 'upstream-org/my-project');
    assert.strictEqual(projects.projects[0].fork, 'testuser/my-project');
  });

  test('--fork without path works with owner/repo shorthand (#210)', async () => {
    setupTeam();

    let clonedUrl;
    const _clone = (url, target) => {
      clonedUrl = url;
      mkdirSync(target, { recursive: true });
      execFileSync('git', ['init', target], { stdio: 'ignore' });
      execFileSync('git', ['-C', target, 'config', 'user.email', 'test@test.com'], { stdio: 'ignore' });
      execFileSync('git', ['-C', target, 'config', 'user.name', 'Test'], { stdio: 'ignore' });
      writeFileSync(join(target, 'README.md'), '# test');
      execFileSync('git', ['-C', target, 'add', '.'], { stdio: 'ignore' });
      execFileSync('git', ['-C', target, 'commit', '-m', 'init'], { stdio: 'ignore' });
      execFileSync('git', ['-C', target, 'remote', 'add', 'origin', url], { stdio: 'ignore' });
    };

    const _exec = (cmd, args, opts) => {
      if (cmd === 'gh' && args[0] === 'api' && args[1] === 'user') {
        return 'jsturtevant\n';
      }
      if (cmd === 'gh') return '';
      if (args.includes('fetch')) return '';
      return execFileSync(cmd, args, { ...opts, encoding: 'utf8', stdio: 'pipe' });
    };

    await onboard({
      fork: 'hyperlight-dev/hyperlight-wasm',
      _clone,
      _exec,
      _select: sharedSelect,
    });

    assert.strictEqual(clonedUrl, 'https://github.com/hyperlight-dev/hyperlight-wasm.git');
  });
});
