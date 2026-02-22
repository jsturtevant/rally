import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { getStatus, formatStatus } from '../lib/status.js';
import { writeConfig, writeProjects, writeActive } from '../lib/config.js';

function withTempHome(fn) {
  const originalEnv = process.env.RALLY_HOME;
  const tempDir = mkdtempSync(join(tmpdir(), 'rally-status-test-'));
  try {
    process.env.RALLY_HOME = tempDir;
    return fn(tempDir);
  } finally {
    if (originalEnv) {
      process.env.RALLY_HOME = originalEnv;
    } else {
      delete process.env.RALLY_HOME;
    }
    rmSync(tempDir, { recursive: true, force: true });
  }
}

// --- Acceptance Criteria: Shows all config paths ---

test('status: shows all config paths', () => {
  withTempHome((tempDir) => {
    const status = getStatus();

    assert.ok(status.configDir);
    assert.strictEqual(status.configDir, tempDir);

    assert.ok(status.configPaths.config.path.endsWith('config.yaml'));
    assert.ok(status.configPaths.projects.path.endsWith('projects.yaml'));
    assert.ok(status.configPaths.active.path.endsWith('active.yaml'));
  });
});

test('status: config paths report existence correctly', () => {
  withTempHome((tempDir) => {
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
});

test('status: directories from config', () => {
  withTempHome(() => {
    writeConfig({ teamDir: '/home/user/.rally/team', projectsDir: '/home/user/.rally/projects', version: '0.1.0' });
    const status = getStatus();
    assert.strictEqual(status.teamDir, '/home/user/.rally/team');
    assert.strictEqual(status.projectsDir, '/home/user/.rally/projects');
  });
});

test('status: directories null when no config', () => {
  withTempHome(() => {
    const status = getStatus();
    assert.strictEqual(status.teamDir, null);
    assert.strictEqual(status.projectsDir, null);
  });
});

// --- Acceptance Criteria: Shows onboarded projects ---

test('status: shows onboarded projects (empty)', () => {
  withTempHome(() => {
    const status = getStatus();
    assert.deepEqual(status.projects, []);
  });
});

test('status: shows onboarded projects (populated)', () => {
  withTempHome(() => {
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
});

// --- Acceptance Criteria: Shows active dispatches ---

test('status: shows active dispatches (empty)', () => {
  withTempHome(() => {
    const status = getStatus();
    assert.deepEqual(status.dispatches, []);
  });
});

test('status: shows active dispatches (populated)', () => {
  withTempHome(() => {
    const active = {
      dispatches: [
        { id: 42, project: 'app-one', status: 'implementing' },
        { id: 51, project: 'app-one', status: 'planning' },
      ]
    };
    writeActive(active);
    const status = getStatus();
    assert.strictEqual(status.dispatches.length, 2);
    assert.strictEqual(status.dispatches[0].id, 42);
    assert.strictEqual(status.dispatches[0].status, 'implementing');
    assert.strictEqual(status.dispatches[1].id, 51);
  });
});

// --- Acceptance Criteria: --json flag works ---

test('status: --json flag outputs valid JSON via CLI', () => {
  withTempHome((tempDir) => {
    writeConfig({ teamDir: '/tmp/team', version: '0.1.0' });
    const binPath = join(import.meta.dirname, '..', 'bin', 'rally.js');
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
});

test('status: CLI text output includes key sections', () => {
  withTempHome((tempDir) => {
    const binPath = join(import.meta.dirname, '..', 'bin', 'rally.js');
    const output = execFileSync('node', [binPath, 'status'], {
      env: { ...process.env, RALLY_HOME: tempDir },
      encoding: 'utf8',
    });
    assert.ok(output.includes('Rally Status'));
    assert.ok(output.includes('Config Paths:'));
    assert.ok(output.includes('Onboarded Projects'));
    assert.ok(output.includes('Active Dispatches'));
  });
});

// --- Error handling / edge cases ---

test('status: formatStatus handles empty status correctly', () => {
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

test('status: formatStatus renders projects and dispatches', () => {
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
    dispatches: [{ id: 42, project: 'my-app', status: 'implementing' }],
  };
  const output = formatStatus(status);
  assert.ok(output.includes('✓ config:'));
  assert.ok(output.includes('my-app'));
  assert.ok(output.includes('#42'));
  assert.ok(output.includes('[implementing]'));
});
