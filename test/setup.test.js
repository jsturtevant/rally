import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import yaml from 'js-yaml';
import { setup } from '../lib/setup.js';

describe('setup', () => {
  let tempDir;
  let originalEnv;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'rally-setup-test-'));
    originalEnv = process.env.RALLY_HOME;
    process.env.RALLY_HOME = tempDir;
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.RALLY_HOME = originalEnv;
    } else {
      delete process.env.RALLY_HOME;
    }
    rmSync(tempDir, { recursive: true, force: true });
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
    assert.deepStrictEqual(execArgs.args, ['github:bradygaster/squad@v0.5.2']);
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

    const config = yaml.load(readFileSync(configPath, 'utf8'));
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
    const config = yaml.load(readFileSync(configPath, 'utf8'));
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
    const firstConfig = yaml.load(readFileSync(configPath, 'utf8'));

    // Second run — should not throw
    await setup();
    const secondConfig = yaml.load(readFileSync(configPath, 'utf8'));

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

  test('error: npx not found (ENOENT) throws descriptive error', async () => {
    const fakeExec = () => {
      const err = new Error('spawn npx ENOENT');
      err.code = 'ENOENT';
      throw err;
    };

    await assert.rejects(
      () => setup({ _exec: fakeExec }),
      (err) => {
        assert.ok(err.message.includes('npx not found'), `Expected npx not found, got: ${err.message}`);
        return true;
      }
    );
  });

  test('error: Squad init fails throws descriptive error', async () => {
    const fakeExec = () => {
      throw new Error('Command failed with exit code 1');
    };

    await assert.rejects(
      () => setup({ _exec: fakeExec }),
      (err) => {
        assert.ok(err.message.includes('Squad init failed'), `Expected Squad init failed, got: ${err.message}`);
        return true;
      }
    );
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
});
