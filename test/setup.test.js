import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { setup } from '../lib/setup.js';
import { DEFAULT_DENY_TOOLS } from '../lib/copilot.js';
import { withTempRallyHome } from './helpers/temp-env.js';

describe('setup', () => {
  let tempDir;

  beforeEach((t) => {
    tempDir = withTempRallyHome(t);
  });

  // --- Acceptance Criteria: Creates Rally directories ---

  test('creates team directory', async () => {
    const teamDir = join(tempDir, 'team');
    // Pre-create .squad so we skip npx
    mkdirSync(teamDir, { recursive: true });
    mkdirSync(join(teamDir, '.squad'), { recursive: true });

    await setup();

    assert.ok(existsSync(teamDir), 'team directory should exist');
  });

  test('creates projects directory', async () => {
    const teamDir = join(tempDir, 'team');
    mkdirSync(teamDir, { recursive: true });
    mkdirSync(join(teamDir, '.squad'), { recursive: true });

    await setup();

    const projectsDir = join(tempDir, 'projects');
    assert.ok(existsSync(projectsDir), 'projects directory should exist');
  });

  // --- Acceptance Criteria: Runs Squad init in team dir ---

  test('runs Squad init when .squad/ does not exist', async () => {
    let execCalled = false;
    let execArgs = null;
    const fakeExec = (cmd, args, opts) => {
      execCalled = true;
      execArgs = { cmd, args, cwd: opts.cwd };
      // Simulate npx creating .squad/
      mkdirSync(join(opts.cwd, '.squad'), { recursive: true });
    };

    await setup({ _exec: fakeExec });

    assert.ok(execCalled, 'exec should have been called');
    assert.strictEqual(execArgs.cmd, 'npx');
    assert.deepStrictEqual(execArgs.args, ['github:bradygaster/squad#v0.5.2']);
    assert.strictEqual(execArgs.cwd, join(tempDir, 'team'));
  });

  test('skips Squad init when .squad/ already exists', async () => {
    const teamDir = join(tempDir, 'team');
    mkdirSync(teamDir, { recursive: true });
    mkdirSync(join(teamDir, '.squad'), { recursive: true });

    let execCalled = false;
    const fakeExec = () => { execCalled = true; };

    await setup({ _exec: fakeExec });

    assert.ok(!execCalled, 'exec should NOT have been called when .squad/ exists');
  });

  // --- Acceptance Criteria: Writes config.yaml ---

  test('writes config.yaml with correct structure', async () => {
    const teamDir = join(tempDir, 'team');
    mkdirSync(teamDir, { recursive: true });
    mkdirSync(join(teamDir, '.squad'), { recursive: true });

    await setup();

    const configPath = join(tempDir, 'config.yaml');
    assert.ok(existsSync(configPath), 'config.yaml should exist');

    const config = yaml.load(readFileSync(configPath, 'utf8'), { schema: yaml.CORE_SCHEMA });
    assert.strictEqual(config.teamDir, teamDir);
    assert.strictEqual(config.projectsDir, join(tempDir, 'projects'));
    assert.strictEqual(config.version, '0.1.0');
  });

  test('writes config.yaml with custom --dir', async () => {
    const customDir = join(tempDir, 'custom-team');
    mkdirSync(customDir, { recursive: true });
    mkdirSync(join(customDir, '.squad'), { recursive: true });

    await setup({ dir: customDir });

    const configPath = join(tempDir, 'config.yaml');
    const config = yaml.load(readFileSync(configPath, 'utf8'), { schema: yaml.CORE_SCHEMA });
    assert.strictEqual(config.teamDir, customDir);
  });

  // --- Acceptance Criteria: Idempotent on re-run ---

  test('idempotent: re-run skips existing directories and squad', async () => {
    const teamDir = join(tempDir, 'team');
    mkdirSync(teamDir, { recursive: true });
    mkdirSync(join(teamDir, '.squad'), { recursive: true });

    // First run
    await setup();

    const configPath = join(tempDir, 'config.yaml');
    const firstConfig = yaml.load(readFileSync(configPath, 'utf8'), { schema: yaml.CORE_SCHEMA });

    // Second run — should not throw
    await setup();
    const secondConfig = yaml.load(readFileSync(configPath, 'utf8'), { schema: yaml.CORE_SCHEMA });

    assert.deepStrictEqual(firstConfig, secondConfig);
    assert.ok(existsSync(teamDir));
    assert.ok(existsSync(join(tempDir, 'projects')));
  });

  test('idempotent: full re-run completes without error', async () => {
    const teamDir = join(tempDir, 'team');
    mkdirSync(teamDir, { recursive: true });
    mkdirSync(join(teamDir, '.squad'), { recursive: true });

    await setup();
    await assert.doesNotReject(() => setup());
  });

  // --- Error Cases ---

  test('squad init failure is non-fatal (npx ENOENT)', async () => {
    const fakeExec = () => {
      const err = new Error('spawn npx ENOENT');
      err.code = 'ENOENT';
      throw err;
    };

    // Should NOT reject — squad failure is a warning, not an error
    await assert.doesNotReject(() => setup({ _exec: fakeExec }));

    // Config should still be written
    const configPath = join(tempDir, 'config.yaml');
    assert.ok(existsSync(configPath), 'config.yaml should still be written when squad init fails');
  });

  test('squad init failure is non-fatal (exit code 128)', async () => {
    const fakeExec = () => {
      throw new Error('Command failed with exit code 128');
    };

    // Should NOT reject — squad failure is a warning, not an error
    await assert.doesNotReject(() => setup({ _exec: fakeExec }));

    // Config should still be written
    const configPath = join(tempDir, 'config.yaml');
    assert.ok(existsSync(configPath), 'config.yaml should still be written when squad init fails');
  });

  test('error: permission denied on directory creation', async () => {
    const fakeExec = () => {};
    // Use a file as a "directory" parent — mkdir inside a file always fails
    const blocker = join(tempDir, 'blocker');
    writeFileSync(blocker, 'not-a-dir');
    const impossibleDir = join(blocker, 'subdir');

    await assert.rejects(
      () => setup({ dir: impossibleDir, _exec: fakeExec }),
      (err) => {
        assert.ok(err.message.length > 0, 'Should have an error message');
        return true;
      }
    );
  });

  // --- Acceptance Criteria: Writes deny_tools defaults to config.yaml ---

  test('writes deny_tools defaults to config.yaml', async () => {
    const teamDir = join(tempDir, 'team');
    mkdirSync(teamDir, { recursive: true });
    mkdirSync(join(teamDir, '.squad'), { recursive: true });

    await setup();

    const configPath = join(tempDir, 'config.yaml');
    const config = yaml.load(readFileSync(configPath, 'utf8'), { schema: yaml.CORE_SCHEMA });
    assert.deepEqual(config.settings.deny_tools_copilot, DEFAULT_DENY_TOOLS);
    assert.deepEqual(config.settings.deny_tools_sandbox, DEFAULT_DENY_TOOLS);
  });

  test('preserves existing deny_tools on re-run', async () => {
    const teamDir = join(tempDir, 'team');
    mkdirSync(teamDir, { recursive: true });
    mkdirSync(join(teamDir, '.squad'), { recursive: true });

    // Write config with custom deny_tools
    const configPath = join(tempDir, 'config.yaml');
    const customTools = ['shell(rm)'];
    writeFileSync(configPath, yaml.dump({
      teamDir,
      projectsDir: join(tempDir, 'projects'),
      version: '0.1.0',
      settings: { deny_tools_copilot: customTools },
    }), 'utf8');

    await setup();

    const config = yaml.load(readFileSync(configPath, 'utf8'), { schema: yaml.CORE_SCHEMA });
    assert.deepEqual(config.settings.deny_tools_copilot, customTools);
    // deny_tools_sandbox was missing, so it gets the default
    assert.deepEqual(config.settings.deny_tools_sandbox, DEFAULT_DENY_TOOLS);
  });
});
