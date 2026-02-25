import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import yaml from 'js-yaml';
import {
  getConfigDir,
  readConfig,
  writeConfig,
  readProjects,
  writeProjects,
  readActive,
  validateOnboarded,
  ensureConfigDir,
  atomicWrite,
} from '../lib/config.js';
import { withTempRallyHome, withTempHome } from './helpers/temp-env.js';

test('getConfigDir returns ~/rally by default on fresh install', (t) => {
  const tempHome = withTempHome(t);
  // Neither ~/rally nor ~/.rally exists — should return ~/rally
  const configDir = getConfigDir();
  assert.strictEqual(configDir, join(tempHome, 'rally'));
});

test('getConfigDir falls back to ~/.rally when it exists and ~/rally does not', (t) => {
  const tempHome = withTempHome(t);
  // Create only ~/.rally (legacy)
  mkdirSync(join(tempHome, '.rally'), { recursive: true });
  const configDir = getConfigDir();
  assert.strictEqual(configDir, join(tempHome, '.rally'));
});

test('getConfigDir prefers ~/rally over ~/.rally when both exist', (t) => {
  const tempHome = withTempHome(t);
  // Create both
  mkdirSync(join(tempHome, 'rally'), { recursive: true });
  mkdirSync(join(tempHome, '.rally'), { recursive: true });
  const configDir = getConfigDir();
  assert.strictEqual(configDir, join(tempHome, 'rally'));
});

test('getConfigDir respects RALLY_HOME env var', (t) => {
  const tempDir = withTempRallyHome(t);
  const configDir = getConfigDir();
  assert.strictEqual(configDir, tempDir);
});

test('getConfigDir throws when RALLY_HOME is a relative path', (t) => {
  const original = process.env.RALLY_HOME;
  process.env.RALLY_HOME = 'relative/path';
  t.after(() => {
    if (original !== undefined) process.env.RALLY_HOME = original;
    else delete process.env.RALLY_HOME;
  });
  assert.throws(() => getConfigDir(), /RALLY_HOME must be an absolute path/);
});

test('readConfig returns null when file missing', (t) => {
  withTempRallyHome(t);
  const config = readConfig();
  assert.strictEqual(config, null);
});

test('writeConfig creates directory if missing', (t) => {
  const tempDir = withTempRallyHome(t);
  const data = {
    teamDir: '/home/user/.rally/team',
    projectsDir: '/home/user/.rally/projects',
    version: '0.1.0'
  };

  writeConfig(data);

  const configPath = join(tempDir, 'config.yaml');
  const content = readFileSync(configPath, 'utf8');
  assert.ok(content.includes('teamDir: /home/user/.rally/team'));
});

test('writeConfig and readConfig roundtrip', (t) => {
  withTempRallyHome(t);
  const data = {
    teamDir: '/home/user/.rally/team',
    projectsDir: '/home/user/.rally/projects',
    version: '0.1.0'
  };

  writeConfig(data);
  const result = readConfig();

  assert.deepEqual(result, data);
});

test('readConfig throws on invalid YAML', (t) => {
  const tempDir = withTempRallyHome(t);
  const configPath = join(tempDir, 'config.yaml');
  writeFileSync(configPath, 'invalid: yaml: content: [', 'utf8');

  assert.throws(() => {
    readConfig();
  }, /Failed to parse config.yaml/);
});

test('readProjects returns default when file missing', (t) => {
  withTempRallyHome(t);
  const projects = readProjects();
  assert.deepEqual(projects, { projects: [] });
});

test('writeProjects and readProjects roundtrip', (t) => {
  withTempRallyHome(t);
  const data = {
    projects: [
      { name: 'test-project', path: '/home/user/projects/test' }
    ]
  };

  writeProjects(data);
  const result = readProjects();

  assert.deepEqual(result, data);
});

test('readActive returns default when file missing', (t) => {
  withTempRallyHome(t);
  const active = readActive();
  assert.deepEqual(active, { dispatches: [] });
});

test('readProjects returns default when file is empty', (t) => {
  const tempDir = withTempRallyHome(t);
  writeFileSync(join(tempDir, 'projects.yaml'), '', 'utf8');
  const projects = readProjects();
  assert.deepEqual(projects, { projects: [] });
});

test('readActive returns default when file is empty', (t) => {
  const tempDir = withTempRallyHome(t);
  writeFileSync(join(tempDir, 'active.yaml'), '', 'utf8');
  const active = readActive();
  assert.deepEqual(active, { dispatches: [] });
});

test('readActive reads YAML written directly', (t) => {
  const tempDir = withTempRallyHome(t);
  const data = {
    dispatches: [
      { id: 1, project: 'test-project', status: 'active' }
    ]
  };

  writeFileSync(join(tempDir, 'active.yaml'), yaml.dump(data), 'utf8');
  const result = readActive();

  assert.deepEqual(result, data);
});

describe('validateOnboarded', () => {
  let tempDir;

  beforeEach((t) => {
    tempDir = withTempRallyHome(t);
  });

  test('matches by full owner/repo field', () => {
    const data = { projects: [
      { name: 'utils', repo: 'alice/utils', path: '/a' },
      { name: 'utils', repo: 'bob/utils', path: '/b' },
    ]};
    writeFileSync(join(tempDir, 'projects.yaml'), yaml.dump(data), 'utf8');
    assert.doesNotThrow(() => validateOnboarded('bob/utils'));
  });

  test('falls back to name-only for legacy entries', () => {
    const data = { projects: [{ name: 'rally', path: '/r' }] };
    writeFileSync(join(tempDir, 'projects.yaml'), yaml.dump(data), 'utf8');
    assert.doesNotThrow(() => validateOnboarded('any-owner/rally'));
  });

  test('throws when repo not onboarded', () => {
    const data = { projects: [] };
    writeFileSync(join(tempDir, 'projects.yaml'), yaml.dump(data), 'utf8');
    assert.throws(() => validateOnboarded('owner/missing'), /not onboarded/);
  });
});

describe('ensureConfigDir', () => {
  let tempDir;

  beforeEach((t) => {
    tempDir = mkdtempSync(join(tmpdir(), 'rally-ensure-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test('creates directory with 0o700 permissions', (t) => {
    const dir = join(tempDir, 'newdir');
    const saved = process.env.RALLY_HOME;
    process.env.RALLY_HOME = dir;
    t.after(() => {
      if (saved !== undefined) process.env.RALLY_HOME = saved;
      else delete process.env.RALLY_HOME;
    });
    ensureConfigDir();
    assert.ok(existsSync(dir));
    if (process.platform !== 'win32') {
      const mode = statSync(dir).mode & 0o777;
      assert.equal(mode, 0o700);
    }
  });

  test('tightens permissions on existing directory', (t) => {
    if (process.platform === 'win32') return;
    const dir = join(tempDir, 'existing');
    mkdirSync(dir, { mode: 0o755 });
    const saved = process.env.RALLY_HOME;
    process.env.RALLY_HOME = dir;
    t.after(() => {
      if (saved !== undefined) process.env.RALLY_HOME = saved;
      else delete process.env.RALLY_HOME;
    });
    ensureConfigDir();
    const mode = statSync(dir).mode & 0o777;
    assert.equal(mode, 0o700);
  });
});

describe('atomicWrite', () => {
  let tempDir;
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'rally-atomic-'));
  });
  afterEach(() => rmSync(tempDir, { recursive: true, force: true }));

  test('writes file with restricted permissions', () => {
    const fp = join(tempDir, 'secret.yaml');
    atomicWrite(fp, 'hello');
    assert.equal(readFileSync(fp, 'utf8'), 'hello');
    if (process.platform !== 'win32') {
      const mode = statSync(fp).mode & 0o777;
      assert.equal(mode, 0o600);
    }
  });

  test('cleans up temp file on write failure', () => {
    const badDir = join(tempDir, 'noexist', 'deep');
    assert.throws(() => atomicWrite(join(badDir, 'file'), 'x'));
    const tmps = readdirSync(tempDir).filter(f => f.endsWith('.tmp'));
    assert.equal(tmps.length, 0);
  });
});
