import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, rmSync, existsSync, readFileSync,
  mkdirSync, writeFileSync, symlinkSync, lstatSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import yaml from 'js-yaml';
import { onboardRemove } from '../lib/onboard-remove.js';

describe('onboard remove', () => {
  let tempDir;
  let originalEnv;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'rally-onboard-remove-test-'));
    originalEnv = process.env.RALLY_HOME;
    process.env.RALLY_HOME = join(tempDir, 'rally-home');
    mkdirSync(process.env.RALLY_HOME, { recursive: true });
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.RALLY_HOME = originalEnv;
    } else {
      delete process.env.RALLY_HOME;
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  const silentChalk = {
    green: (s) => s,
    red: (s) => s,
    yellow: (s) => s,
    dim: (s) => s,
  };

  function createRepo(repoPath) {
    mkdirSync(repoPath, { recursive: true });
    execFileSync('git', ['init', repoPath], { stdio: 'ignore' });
    return repoPath;
  }

  function writeProjectsYaml(projects) {
    const projectsPath = join(process.env.RALLY_HOME, 'projects.yaml');
    writeFileSync(projectsPath, yaml.dump({ projects }), 'utf8');
  }

  function readProjectsYaml() {
    const projectsPath = join(process.env.RALLY_HOME, 'projects.yaml');
    return yaml.load(readFileSync(projectsPath, 'utf8'), { schema: yaml.CORE_SCHEMA });
  }

  function setupOnboardedProject(name, repoPath, extra = {}) {
    const teamDir = join(tempDir, 'team');
    mkdirSync(join(teamDir, '.squad'), { recursive: true });
    mkdirSync(join(teamDir, '.squad-templates'), { recursive: true });

    // Create symlinks in the project
    symlinkSync(join(teamDir, '.squad'), join(repoPath, '.squad'));
    symlinkSync(join(teamDir, '.squad-templates'), join(repoPath, '.squad-templates'));

    return {
      name,
      repo: `owner/${name}`,
      path: repoPath,
      team: 'shared',
      teamDir,
      onboarded: new Date().toISOString(),
      ...extra,
    };
  }

  // --- Removes project from projects.yaml ---

  test('removes specified project from projects.yaml', async () => {
    const repoPath = createRepo(join(tempDir, 'my-repo'));
    const entry = setupOnboardedProject('my-repo', repoPath);
    writeProjectsYaml([entry]);

    const result = await onboardRemove({
      project: 'my-repo',
      yes: true,
      _chalk: silentChalk,
    });

    assert.strictEqual(result.name, 'my-repo');
    const data = readProjectsYaml();
    assert.strictEqual(data.projects.length, 0);
  });

  test('removes project matched by repo name (owner/repo)', async () => {
    const repoPath = createRepo(join(tempDir, 'my-repo'));
    const entry = setupOnboardedProject('my-repo', repoPath);
    writeProjectsYaml([entry]);

    const result = await onboardRemove({
      project: 'owner/my-repo',
      yes: true,
      _chalk: silentChalk,
    });

    assert.strictEqual(result.name, 'my-repo');
    const data = readProjectsYaml();
    assert.strictEqual(data.projects.length, 0);
  });

  // --- Keeps other projects intact ---

  test('only removes the specified project, keeps others', async () => {
    const repo1 = createRepo(join(tempDir, 'repo-a'));
    const repo2 = createRepo(join(tempDir, 'repo-b'));
    const entry1 = setupOnboardedProject('repo-a', repo1);
    const entry2 = setupOnboardedProject('repo-b', repo2);
    writeProjectsYaml([entry1, entry2]);

    await onboardRemove({
      project: 'repo-a',
      yes: true,
      _chalk: silentChalk,
    });

    const data = readProjectsYaml();
    assert.strictEqual(data.projects.length, 1);
    assert.strictEqual(data.projects[0].name, 'repo-b');
  });

  // --- Cleans up symlinks ---

  test('removes symlinks from project directory', async () => {
    const repoPath = createRepo(join(tempDir, 'my-repo'));
    const entry = setupOnboardedProject('my-repo', repoPath);
    writeProjectsYaml([entry]);

    assert.ok(existsSync(join(repoPath, '.squad')), '.squad should exist before removal');

    await onboardRemove({
      project: 'my-repo',
      yes: true,
      _chalk: silentChalk,
    });

    // lstatSync won't throw because the symlink itself is gone
    assert.ok(!existsSync(join(repoPath, '.squad')), '.squad should be removed');
    assert.ok(!existsSync(join(repoPath, '.squad-templates')), '.squad-templates should be removed');
  });

  // --- Error: project not found ---

  test('throws when project name not found', async () => {
    const repoPath = createRepo(join(tempDir, 'other-repo'));
    const entry = setupOnboardedProject('other-repo', repoPath);
    writeProjectsYaml([entry]);

    await assert.rejects(
      () => onboardRemove({ project: 'nonexistent', yes: true, _chalk: silentChalk }),
      /not found/
    );
  });

  // --- Error: no onboarded projects ---

  test('throws when no projects are onboarded', async () => {
    writeProjectsYaml([]);

    await assert.rejects(
      () => onboardRemove({ _chalk: silentChalk }),
      /No onboarded projects found/
    );
  });

  // --- Confirmation: cancelled ---

  test('returns null when user cancels confirmation', async () => {
    const repoPath = createRepo(join(tempDir, 'my-repo'));
    const entry = setupOnboardedProject('my-repo', repoPath);
    writeProjectsYaml([entry]);

    const result = await onboardRemove({
      project: 'my-repo',
      _confirm: async () => false,
      _chalk: silentChalk,
    });

    assert.strictEqual(result, null);
    const data = readProjectsYaml();
    assert.strictEqual(data.projects.length, 1, 'project should still exist');
  });

  // --- Confirmation: --yes skips prompt ---

  test('--yes skips confirmation prompt', async () => {
    const repoPath = createRepo(join(tempDir, 'my-repo'));
    const entry = setupOnboardedProject('my-repo', repoPath);
    writeProjectsYaml([entry]);

    // If _confirm were called without --yes, it would reject
    const result = await onboardRemove({
      project: 'my-repo',
      yes: true,
      _confirm: async () => { throw new Error('should not be called'); },
      _chalk: silentChalk,
    });

    assert.strictEqual(result.name, 'my-repo');
  });

  // --- Interactive picker ---

  test('uses interactive picker when no project name given', async () => {
    const repoPath = createRepo(join(tempDir, 'my-repo'));
    const entry = setupOnboardedProject('my-repo', repoPath);
    writeProjectsYaml([entry]);

    let selectCalled = false;
    const mockSelect = async ({ choices }) => {
      selectCalled = true;
      assert.ok(choices.length > 0, 'should have choices');
      return choices[0].value;
    };

    const result = await onboardRemove({
      _select: mockSelect,
      _confirm: async () => true,
      _chalk: silentChalk,
    });

    assert.ok(selectCalled, 'select should have been called');
    assert.strictEqual(result.name, 'my-repo');
  });

  // --- Interactive picker: cancel ---

  test('returns null when cancel is selected in interactive picker', async () => {
    const repoPath = createRepo(join(tempDir, 'my-repo'));
    const entry = setupOnboardedProject('my-repo', repoPath);
    writeProjectsYaml([entry]);

    const mockSelect = async ({ choices }) => {
      const cancel = choices[choices.length - 1];
      assert.strictEqual(cancel.name, '← Cancel');
      return cancel.value;
    };

    const result = await onboardRemove({
      _select: mockSelect,
      _chalk: silentChalk,
    });

    assert.strictEqual(result, null);
    const data = readProjectsYaml();
    assert.strictEqual(data.projects.length, 1, 'project should still exist');
  });

  // --- Handles missing project path gracefully ---

  test('succeeds even if project path no longer exists', async () => {
    const fakePath = join(tempDir, 'gone-repo');
    writeProjectsYaml([{
      name: 'gone-repo',
      repo: 'owner/gone-repo',
      path: fakePath,
      team: 'shared',
      onboarded: new Date().toISOString(),
    }]);

    const result = await onboardRemove({
      project: 'gone-repo',
      yes: true,
      _chalk: silentChalk,
    });

    assert.strictEqual(result.name, 'gone-repo');
    const data = readProjectsYaml();
    assert.strictEqual(data.projects.length, 0);
  });
});
