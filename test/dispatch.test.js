import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, rmSync, mkdirSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import yaml from 'js-yaml';
import { resolveRepo, parseRepoFlag, getRemoteRepo } from '../lib/dispatch.js';
import { withTempRallyHome } from './helpers/temp-env.js';

describe('parseRepoFlag', () => {
  test('parses valid owner/repo', () => {
    const result = parseRepoFlag('jsturtevant/rally');
    assert.deepStrictEqual(result, { owner: 'jsturtevant', repo: 'rally' });
  });

  test('parses owner with dots and hyphens', () => {
    const result = parseRepoFlag('my-org.io/my-repo.js');
    assert.deepStrictEqual(result, { owner: 'my-org.io', repo: 'my-repo.js' });
  });

  test('rejects bare repo name', () => {
    assert.throws(
      () => parseRepoFlag('rally'),
      (err) => err.message.includes('Invalid repo format')
    );
  });

  test('rejects paths with extra slashes', () => {
    assert.throws(
      () => parseRepoFlag('a/b/c'),
      (err) => err.message.includes('Invalid repo format')
    );
  });

  test('rejects empty string', () => {
    assert.throws(
      () => parseRepoFlag(''),
      (err) => err.message.includes('Invalid repo format')
    );
  });
});

describe('getRemoteRepo', () => {
  test('parses owner/repo from https remote', () => {
    const _exec = () => 'https://github.com/jsturtevant/rally.git\n';
    const result = getRemoteRepo('/fake', { _exec });
    assert.deepStrictEqual(result, { owner: 'jsturtevant', repo: 'rally' });
  });

  test('parses owner/repo from https remote without .git', () => {
    const _exec = () => 'https://github.com/jsturtevant/rally\n';
    const result = getRemoteRepo('/fake', { _exec });
    assert.deepStrictEqual(result, { owner: 'jsturtevant', repo: 'rally' });
  });

  test('parses owner/repo from ssh remote', () => {
    const _exec = () => 'git@github.com:jsturtevant/rally.git\n';
    const result = getRemoteRepo('/fake', { _exec });
    assert.deepStrictEqual(result, { owner: 'jsturtevant', repo: 'rally' });
  });

  test('throws on unparseable remote URL', () => {
    const _exec = () => 'https://gitlab.com/foo/bar.git\n';
    assert.throws(
      () => getRemoteRepo('/fake', { _exec }),
      (err) => err.message.includes('Cannot parse owner/repo')
    );
  });

  test('throws when no remote origin', () => {
    const _exec = () => { throw new Error('fatal: no remote'); };
    assert.throws(
      () => getRemoteRepo('/fake', { _exec }),
      (err) => err.message.includes('no git remote "origin"')
    );
  });
});

describe('resolveRepo', () => {
  let tempDir;
  let originalCwd;

  beforeEach((t) => {
    tempDir = mkdtempSync(join(tmpdir(), 'rally-dispatch-test-'));
    originalCwd = process.cwd();
    withTempRallyHome(t);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
  });

  function writeProjects(projectList) {
    const data = { projects: projectList };
    writeFileSync(
      join(process.env.RALLY_HOME, 'projects.yaml'),
      yaml.dump(data),
      'utf8'
    );
  }

  function createGitRepo(name) {
    const repoPath = join(tempDir, name);
    mkdirSync(repoPath, { recursive: true });
    execFileSync('git', ['init', repoPath], { stdio: 'ignore' });
    execFileSync('git', ['remote', 'add', 'origin', `https://github.com/testowner/${name}.git`], {
      cwd: repoPath,
      stdio: 'ignore',
    });
    return repoPath;
  }

  // --- Acceptance Criteria: Resolves repo from --repo flag ---

  test('resolves repo from --repo flag', () => {
    const repoPath = createGitRepo('rally');
    writeProjects([{ name: 'rally', path: repoPath }]);

    const result = resolveRepo({ repo: 'jsturtevant/rally' });
    assert.strictEqual(result.owner, 'jsturtevant');
    assert.strictEqual(result.repo, 'rally');
    assert.strictEqual(result.fullName, 'jsturtevant/rally');
    assert.strictEqual(result.project.name, 'rally');
  });

  test('--repo flag uses owner from flag, not remote', () => {
    const repoPath = createGitRepo('rally');
    writeProjects([{ name: 'rally', path: repoPath }]);

    // Flag says 'someuser/rally' — we trust the flag for owner
    const result = resolveRepo({ repo: 'someuser/rally' });
    assert.strictEqual(result.owner, 'someuser');
    assert.strictEqual(result.fullName, 'someuser/rally');
  });

  test('--repo flag errors when repo not onboarded', () => {
    writeProjects([]);

    assert.throws(
      () => resolveRepo({ repo: 'jsturtevant/rally' }),
      (err) => {
        assert.ok(err.message.includes('not onboarded'));
        assert.ok(err.message.includes('rally onboard'));
        return true;
      }
    );
  });

  test('--repo flag errors on invalid format', () => {
    assert.throws(
      () => resolveRepo({ repo: 'just-a-name' }),
      (err) => err.message.includes('Invalid repo format')
    );
  });

  // --- Acceptance Criteria: Resolves repo from cwd ---

  test('resolves repo from cwd when inside project root', () => {
    const repoPath = createGitRepo('my-project');
    writeProjects([{ name: 'my-project', path: repoPath }]);
    process.chdir(repoPath);

    const result = resolveRepo();
    assert.strictEqual(result.owner, 'testowner');
    assert.strictEqual(result.repo, 'my-project');
    assert.strictEqual(result.fullName, 'testowner/my-project');
  });

  test('resolves repo from cwd when inside subdirectory', () => {
    const repoPath = createGitRepo('my-project');
    const subDir = join(repoPath, 'src', 'lib');
    mkdirSync(subDir, { recursive: true });
    writeProjects([{ name: 'my-project', path: repoPath }]);
    process.chdir(subDir);

    const result = resolveRepo();
    assert.strictEqual(result.repo, 'my-project');
    assert.strictEqual(result.project.path, repoPath);
  });

  // --- Acceptance Criteria: Falls back to single registered project ---

  test('falls back to single registered project', () => {
    const repoPath = createGitRepo('only-project');
    writeProjects([{ name: 'only-project', path: repoPath }]);

    // cwd is NOT inside the project
    process.chdir(tempDir);

    const result = resolveRepo();
    assert.strictEqual(result.repo, 'only-project');
    assert.strictEqual(result.fullName, 'testowner/only-project');
  });

  // --- Acceptance Criteria: Clear error on ambiguous repo ---

  test('errors on ambiguous repo with multiple projects', () => {
    const repo1 = createGitRepo('project-a');
    const repo2 = createGitRepo('project-b');
    writeProjects([
      { name: 'project-a', path: repo1 },
      { name: 'project-b', path: repo2 },
    ]);

    // cwd is NOT inside either project
    process.chdir(tempDir);

    assert.throws(
      () => resolveRepo(),
      (err) => {
        assert.ok(err.message.includes('Multiple projects'));
        assert.ok(err.message.includes('--repo'));
        assert.ok(err.message.includes('project-a'));
        assert.ok(err.message.includes('project-b'));
        return true;
      }
    );
  });

  test('errors when no projects onboarded', () => {
    writeProjects([]);
    process.chdir(tempDir);

    assert.throws(
      () => resolveRepo(),
      (err) => {
        assert.ok(err.message.includes('No projects onboarded'));
        assert.ok(err.message.includes('rally onboard'));
        return true;
      }
    );
  });

  test('errors when no projects.yaml exists', () => {
    // No projects.yaml written
    process.chdir(tempDir);

    assert.throws(
      () => resolveRepo(),
      (err) => err.message.includes('No projects onboarded')
    );
  });

  // --- Edge cases ---

  test('--repo flag takes priority over cwd', () => {
    const repoA = createGitRepo('repo-a');
    const repoB = createGitRepo('repo-b');
    writeProjects([
      { name: 'repo-a', path: repoA },
      { name: 'repo-b', path: repoB },
    ]);

    // cwd is inside repo-a, but flag says repo-b
    process.chdir(repoA);
    const result = resolveRepo({ repo: 'someowner/repo-b' });
    assert.strictEqual(result.repo, 'repo-b');
    assert.strictEqual(result.owner, 'someowner');
  });

  test('cwd detection with injectable _exec for remote', () => {
    const repoPath = createGitRepo('injected-project');
    writeProjects([{ name: 'injected-project', path: repoPath }]);
    process.chdir(repoPath);

    const _exec = () => 'https://github.com/custom-owner/injected-project.git\n';
    const result = resolveRepo({ _exec });
    assert.strictEqual(result.owner, 'custom-owner');
    assert.strictEqual(result.repo, 'injected-project');
  });

  test('--repo flag matches full owner/repo before name-only', () => {
    const repoA = createGitRepo('utils');
    const repoB = createGitRepo('utils-b');
    writeProjects([
      { name: 'utils', repo: 'alice/utils', path: repoA },
      { name: 'utils', repo: 'bob/utils', path: repoB },
    ]);

    const result = resolveRepo({ repo: 'bob/utils' });
    assert.strictEqual(result.project.repo, 'bob/utils');
    assert.strictEqual(result.project.path, repoB);
  });

  test('--repo flag falls back to name-only for legacy entries without repo field', () => {
    const repoPath = createGitRepo('legacy-repo');
    writeProjects([{ name: 'legacy-repo', path: repoPath }]);

    const result = resolveRepo({ repo: 'any-owner/legacy-repo' });
    assert.strictEqual(result.project.name, 'legacy-repo');
    assert.strictEqual(result.project.path, repoPath);
  });

  // --- Fork scenarios: uses upstream repo field, not fork remote ---

  test('cwd detection uses project.repo (upstream) instead of git remote for fork projects', () => {
    const repoPath = createGitRepo('hyperlight-wasm');
    // git remote origin = testowner/hyperlight-wasm (set by createGitRepo),
    // but project.repo is the upstream (hyperlight-dev) — resolveProjectRepo should prefer it
    writeProjects([{
      name: 'hyperlight-wasm',
      repo: 'hyperlight-dev/hyperlight-wasm',
      path: repoPath,
      fork: 'jsturtevant/hyperlight-wasm',
    }]);
    process.chdir(repoPath);

    const result = resolveRepo();
    assert.strictEqual(result.owner, 'hyperlight-dev');
    assert.strictEqual(result.repo, 'hyperlight-wasm');
    assert.strictEqual(result.fullName, 'hyperlight-dev/hyperlight-wasm');
  });

  test('single-project fallback uses project.repo (upstream) for fork projects', () => {
    const repoPath = createGitRepo('hyperlight-wasm');
    writeProjects([{
      name: 'hyperlight-wasm',
      repo: 'hyperlight-dev/hyperlight-wasm',
      path: repoPath,
      fork: 'jsturtevant/hyperlight-wasm',
    }]);
    process.chdir(tempDir);

    const result = resolveRepo();
    assert.strictEqual(result.owner, 'hyperlight-dev');
    assert.strictEqual(result.repo, 'hyperlight-wasm');
    assert.strictEqual(result.fullName, 'hyperlight-dev/hyperlight-wasm');
  });

  test('fork project: git remote origin is NOT used when project.repo exists', () => {
    const repoPath = createGitRepo('my-fork-project');
    // git remote origin = testowner/my-fork-project (set by createGitRepo)
    // project.repo = upstream-org/my-fork-project (the upstream)
    writeProjects([{
      name: 'my-fork-project',
      repo: 'upstream-org/my-fork-project',
      path: repoPath,
      fork: 'testowner/my-fork-project',
    }]);
    process.chdir(repoPath);

    const result = resolveRepo();
    // Must resolve to upstream, NOT to testowner from git remote
    assert.strictEqual(result.owner, 'upstream-org');
    assert.strictEqual(result.repo, 'my-fork-project');
  });

  test('non-fork project with repo field still uses project.repo', () => {
    const repoPath = createGitRepo('normal-project');
    writeProjects([{
      name: 'normal-project',
      repo: 'org/normal-project',
      path: repoPath,
    }]);
    process.chdir(repoPath);

    const result = resolveRepo();
    assert.strictEqual(result.owner, 'org');
    assert.strictEqual(result.repo, 'normal-project');
  });

  test('legacy project without repo field falls back to git remote', () => {
    const repoPath = createGitRepo('old-project');
    writeProjects([{ name: 'old-project', path: repoPath }]);
    process.chdir(repoPath);

    const result = resolveRepo();
    assert.strictEqual(result.owner, 'testowner');
    assert.strictEqual(result.repo, 'old-project');
  });

  test('malformed project.repo throws descriptive error', () => {
    const repoPath = createGitRepo('bad-repo-format');
    writeProjects([{
      name: 'bad-repo-format',
      repo: 'not-a-valid-repo-format',
      path: repoPath,
    }]);
    process.chdir(repoPath);

    assert.throws(() => resolveRepo(), {
      message: /Invalid repo format.*not-a-valid-repo-format.*projects\.yaml/,
    });
  });
});
