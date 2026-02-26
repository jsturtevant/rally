import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import yaml from 'js-yaml';
import { getStatus, formatStatus } from '../lib/status.js';
import { writeConfig, writeProjects } from '../lib/config.js';
import { withTempRallyHome } from './helpers/temp-env.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Acceptance Criteria: Shows all config paths ---

test('getStatus returns all config paths', (t) => {
  const tempDir = withTempRallyHome(t);

  const status = getStatus();

  assert.ok(status.configDir);
  assert.strictEqual(status.configDir, tempDir);

  assert.ok(status.configPaths.config.path.endsWith('config.yaml'));
  assert.ok(status.configPaths.projects.path.endsWith('projects.yaml'));
  assert.ok(status.configPaths.active.path.endsWith('active.yaml'));
});

test('getStatus reports config path existence correctly', (t) => {
  const tempDir = withTempRallyHome(t);

  // No files exist yet
  const before = getStatus();
  assert.strictEqual(before.configPaths.config.exists, false);
  assert.strictEqual(before.configPaths.projects.exists, false);
  assert.strictEqual(before.configPaths.active.exists, false);

  // Write config file
  writeConfig({ teamDir: '/tmp/team', version: '0.1.0' });
  const after = getStatus();
  assert.strictEqual(after.configPaths.config.exists, true);
  assert.strictEqual(after.configPaths.projects.exists, false);
});

test('getStatus returns directories from config', (t) => {
  withTempRallyHome(t);

  writeConfig({ teamDir: '/home/user/.rally/team', projectsDir: '/home/user/.rally/projects', version: '0.1.0' });
  const status = getStatus();
  assert.strictEqual(status.teamDir, '/home/user/.rally/team');
  assert.strictEqual(status.projectsDir, '/home/user/.rally/projects');
});

test('getStatus returns null directories when no config', (t) => {
  withTempRallyHome(t);

  const status = getStatus();
  assert.strictEqual(status.teamDir, null);
  assert.strictEqual(status.projectsDir, null);
});

// --- Acceptance Criteria: Shows onboarded projects ---

test('getStatus returns empty onboarded projects', (t) => {
  withTempRallyHome(t);

  const status = getStatus();
  assert.deepEqual(status.projects, []);
});

test('getStatus returns populated onboarded projects', (t) => {
  withTempRallyHome(t);

  const projects = {
    projects: [
      { name: 'app-one', path: '/home/user/projects/app-one', team: 'shared' },
      { name: 'app-two', path: '/home/user/projects/app-two', team: 'project' },
    ]
  };
  writeProjects(projects);
  const status = getStatus();
  assert.strictEqual(status.projects.length, 2);
  assert.strictEqual(status.projects[0].name, 'app-one');
  assert.strictEqual(status.projects[1].name, 'app-two');
});

// --- Acceptance Criteria: Shows active dispatches ---

test('getStatus returns empty active dispatches', (t) => {
  withTempRallyHome(t);

  const status = getStatus();
  assert.deepEqual(status.dispatches, []);
});

test('getStatus returns populated active dispatches', (t) => {
  const tempDir = withTempRallyHome(t);

  const active = {
    dispatches: [
      { id: 42, project: 'app-one', status: 'implementing' },
      { id: 51, project: 'app-one', status: 'planning' },
    ]
  };
  writeFileSync(join(tempDir, 'active.yaml'), yaml.dump(active), 'utf8');
  const status = getStatus();
  assert.strictEqual(status.dispatches.length, 2);
  assert.strictEqual(status.dispatches[0].id, 42);
  assert.strictEqual(status.dispatches[0].status, 'implementing');
  assert.strictEqual(status.dispatches[1].id, 51);
});

// --- Acceptance Criteria: --json flag works ---

test('getStatus outputs valid JSON via --json flag', (t) => {
  const tempDir = withTempRallyHome(t);

  writeConfig({ teamDir: '/tmp/team', version: '0.1.0' });
  const binPath = join(__dirname, '..', 'bin', 'rally.js');
  const output = execFileSync('node', [binPath, 'status', '--json'], {
    env: { ...process.env, RALLY_HOME: tempDir },
    encoding: 'utf8',
  });
  const parsed = JSON.parse(output);
  assert.ok(parsed.configDir);
  assert.ok(parsed.configPaths);
  assert.ok(Array.isArray(parsed.projects));
  assert.ok(Array.isArray(parsed.dispatches));
});

test('status --json outputs valid JSON', (t) => {
  const tempDir = withTempRallyHome(t);

  const binPath = join(__dirname, '..', 'bin', 'rally.js');
  const output = execFileSync('node', [binPath, 'status'], {
    env: { ...process.env, RALLY_HOME: tempDir },
    encoding: 'utf8',
  });
  assert.ok(output.includes('Rally Status'));
  assert.ok(output.includes('Config Paths:'));
  assert.ok(output.includes('Onboarded Projects'));
  assert.ok(output.includes('Active Dispatches'));
});

// --- Error handling / edge cases ---

test('formatStatus handles empty status correctly', () => {
  const status = {
    configDir: '/tmp/test',
    configPaths: {
      config: { path: '/tmp/test/config.yaml', exists: false },
      projects: { path: '/tmp/test/projects.yaml', exists: false },
      active: { path: '/tmp/test/active.yaml', exists: false },
    },
    teamDir: null,
    projectsDir: null,
    projects: [],
    dispatches: [],
  };
  const output = formatStatus(status);
  assert.ok(output.includes('(not configured)'));
  assert.ok(output.includes('(none)'));
  assert.ok(output.includes('✗ config:'));
});

test('formatStatus renders projects and dispatches', () => {
  const status = {
    configDir: '/tmp/test',
    configPaths: {
      config: { path: '/tmp/test/config.yaml', exists: true },
      projects: { path: '/tmp/test/projects.yaml', exists: true },
      active: { path: '/tmp/test/active.yaml', exists: true },
    },
    teamDir: '/tmp/team',
    projectsDir: '/tmp/projects',
    projects: [{ name: 'my-app', path: '/home/user/my-app' }],
    dispatches: [{ id: 'my-app-issue-42', number: 42, repo: 'owner/my-app', type: 'issue', status: 'implementing' }],
  };
  const output = formatStatus(status);
  assert.ok(output.includes('✓ config:'));
  assert.ok(output.includes('my-app'));
  assert.ok(output.includes('#42'));
  assert.ok(output.includes('[implementing]'));
});
