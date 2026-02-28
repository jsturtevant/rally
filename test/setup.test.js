import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { ensureSetup } from '../lib/setup.js';
import { DEFAULT_DENY_TOOLS } from '../lib/copilot.js';
import { withTempRallyHome } from './helpers/temp-env.js';

describe('ensureSetup', () => {
  let tempDir;

  beforeEach((t) => {
    tempDir = withTempRallyHome(t);
  });

  // --- Acceptance Criteria: Creates Rally directories ---

  test('creates projects directory when missing', () => {
    ensureSetup();

    const projectsDir = join(tempDir, 'projects');
    assert.ok(existsSync(projectsDir), 'projects directory should exist');
  });

  test('writes config.yaml with correct structure', () => {
    ensureSetup();

    const configPath = join(tempDir, 'config.yaml');
    assert.ok(existsSync(configPath), 'config.yaml should exist');

    const config = yaml.load(readFileSync(configPath, 'utf8'), { schema: yaml.CORE_SCHEMA });
    assert.strictEqual(config.projectsDir, join(tempDir, 'projects'));
    assert.strictEqual(config.version, '0.1.0');
  });

  // --- Acceptance Criteria: Returns true if setup was needed ---

  test('returns true when setup was needed', () => {
    const result = ensureSetup();
    assert.strictEqual(result, true, 'should return true when setup was performed');
  });

  test('returns false when already set up', () => {
    // First setup
    ensureSetup();

    // Second call should return false
    const result = ensureSetup();
    assert.strictEqual(result, false, 'should return false when already set up');
  });

  // --- Acceptance Criteria: Idempotent on re-run ---

  test('skips setup when projectsDir exists in config', () => {
    // First run
    ensureSetup();

    const configPath = join(tempDir, 'config.yaml');
    const firstConfig = yaml.load(readFileSync(configPath, 'utf8'), { schema: yaml.CORE_SCHEMA });

    // Second run — should not modify config
    ensureSetup();
    const secondConfig = yaml.load(readFileSync(configPath, 'utf8'), { schema: yaml.CORE_SCHEMA });

    assert.deepStrictEqual(firstConfig, secondConfig);
  });

  // --- Acceptance Criteria: Writes deny_tools defaults to config.yaml ---

  test('writes deny_tools defaults to config.yaml', () => {
    ensureSetup();

    const configPath = join(tempDir, 'config.yaml');
    const config = yaml.load(readFileSync(configPath, 'utf8'), { schema: yaml.CORE_SCHEMA });
    assert.deepEqual(config.settings.deny_tools_copilot, DEFAULT_DENY_TOOLS);
    assert.deepEqual(config.settings.deny_tools_sandbox, DEFAULT_DENY_TOOLS);
  });

  test('preserves existing deny_tools when already configured', () => {
    // Write config with custom deny_tools
    const configPath = join(tempDir, 'config.yaml');
    const projectsDir = join(tempDir, 'projects');
    mkdirSync(projectsDir, { recursive: true });
    const customTools = ['shell(rm)'];
    writeFileSync(configPath, yaml.dump({
      projectsDir,
      version: '0.1.0',
      settings: { deny_tools_copilot: customTools, deny_tools_sandbox: customTools },
    }), 'utf8');

    // ensureSetup should skip (already set up)
    const result = ensureSetup();
    assert.strictEqual(result, false, 'should skip when already configured');

    const config = yaml.load(readFileSync(configPath, 'utf8'), { schema: yaml.CORE_SCHEMA });
    assert.deepEqual(config.settings.deny_tools_copilot, customTools);
    assert.deepEqual(config.settings.deny_tools_sandbox, customTools);
  });

  test('replaces empty deny_tools arrays with defaults when config is incomplete', () => {
    // Write partial config without projectsDir
    const configPath = join(tempDir, 'config.yaml');
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(configPath, yaml.dump({
      version: '0.1.0',
      settings: { deny_tools_copilot: [], deny_tools_sandbox: [] },
    }), 'utf8');

    ensureSetup();

    const config = yaml.load(readFileSync(configPath, 'utf8'), { schema: yaml.CORE_SCHEMA });
    // Empty arrays should be replaced with defaults
    assert.deepEqual(config.settings.deny_tools_copilot, DEFAULT_DENY_TOOLS);
    assert.deepEqual(config.settings.deny_tools_sandbox, DEFAULT_DENY_TOOLS);
  });
});
