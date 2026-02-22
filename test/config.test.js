import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  getConfigDir,
  readConfig,
  writeConfig,
  readProjects,
  writeProjects,
  readActive,
  writeActive
} from '../lib/config.js';

test('getConfigDir returns default path', () => {
  const originalEnv = process.env.RALLY_HOME;
  delete process.env.RALLY_HOME;
  
  const configDir = getConfigDir();
  assert.ok(configDir.endsWith('.rally'));
  
  if (originalEnv) {
    process.env.RALLY_HOME = originalEnv;
  }
});

test('getConfigDir respects RALLY_HOME env var', () => {
  const originalEnv = process.env.RALLY_HOME;
  const tempDir = mkdtempSync(join(tmpdir(), 'rally-test-'));
  
  try {
    process.env.RALLY_HOME = tempDir;
    const configDir = getConfigDir();
    assert.strictEqual(configDir, tempDir);
  } finally {
    if (originalEnv) {
      process.env.RALLY_HOME = originalEnv;
    } else {
      delete process.env.RALLY_HOME;
    }
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('readConfig returns null when file missing', () => {
  const originalEnv = process.env.RALLY_HOME;
  const tempDir = mkdtempSync(join(tmpdir(), 'rally-test-'));
  
  try {
    process.env.RALLY_HOME = tempDir;
    const config = readConfig();
    assert.strictEqual(config, null);
  } finally {
    if (originalEnv) {
      process.env.RALLY_HOME = originalEnv;
    } else {
      delete process.env.RALLY_HOME;
    }
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('writeConfig creates directory if missing', () => {
  const originalEnv = process.env.RALLY_HOME;
  const tempDir = mkdtempSync(join(tmpdir(), 'rally-test-'));
  
  try {
    process.env.RALLY_HOME = tempDir;
    const data = {
      teamDir: '/home/user/.rally/team',
      projectsDir: '/home/user/.rally/projects',
      version: '0.1.0'
    };
    
    writeConfig(data);
    
    const configPath = join(tempDir, 'config.yaml');
    const content = readFileSync(configPath, 'utf8');
    assert.ok(content.includes('teamDir: /home/user/.rally/team'));
  } finally {
    if (originalEnv) {
      process.env.RALLY_HOME = originalEnv;
    } else {
      delete process.env.RALLY_HOME;
    }
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('writeConfig and readConfig roundtrip', () => {
  const originalEnv = process.env.RALLY_HOME;
  const tempDir = mkdtempSync(join(tmpdir(), 'rally-test-'));
  
  try {
    process.env.RALLY_HOME = tempDir;
    const data = {
      teamDir: '/home/user/.rally/team',
      projectsDir: '/home/user/.rally/projects',
      version: '0.1.0'
    };
    
    writeConfig(data);
    const result = readConfig();
    
    assert.deepEqual(result, data);
  } finally {
    if (originalEnv) {
      process.env.RALLY_HOME = originalEnv;
    } else {
      delete process.env.RALLY_HOME;
    }
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('readConfig throws on invalid YAML', () => {
  const originalEnv = process.env.RALLY_HOME;
  const tempDir = mkdtempSync(join(tmpdir(), 'rally-test-'));
  
  try {
    process.env.RALLY_HOME = tempDir;
    const configPath = join(tempDir, 'config.yaml');
    writeFileSync(configPath, 'invalid: yaml: content: [', 'utf8');
    
    assert.throws(() => {
      readConfig();
    }, /Failed to parse config.yaml/);
  } finally {
    if (originalEnv) {
      process.env.RALLY_HOME = originalEnv;
    } else {
      delete process.env.RALLY_HOME;
    }
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('readProjects returns default when file missing', () => {
  const originalEnv = process.env.RALLY_HOME;
  const tempDir = mkdtempSync(join(tmpdir(), 'rally-test-'));
  
  try {
    process.env.RALLY_HOME = tempDir;
    const projects = readProjects();
    assert.deepEqual(projects, { projects: [] });
  } finally {
    if (originalEnv) {
      process.env.RALLY_HOME = originalEnv;
    } else {
      delete process.env.RALLY_HOME;
    }
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('writeProjects and readProjects roundtrip', () => {
  const originalEnv = process.env.RALLY_HOME;
  const tempDir = mkdtempSync(join(tmpdir(), 'rally-test-'));
  
  try {
    process.env.RALLY_HOME = tempDir;
    const data = {
      projects: [
        { name: 'test-project', path: '/home/user/projects/test' }
      ]
    };
    
    writeProjects(data);
    const result = readProjects();
    
    assert.deepEqual(result, data);
  } finally {
    if (originalEnv) {
      process.env.RALLY_HOME = originalEnv;
    } else {
      delete process.env.RALLY_HOME;
    }
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('readActive returns default when file missing', () => {
  const originalEnv = process.env.RALLY_HOME;
  const tempDir = mkdtempSync(join(tmpdir(), 'rally-test-'));
  
  try {
    process.env.RALLY_HOME = tempDir;
    const active = readActive();
    assert.deepEqual(active, { dispatches: [] });
  } finally {
    if (originalEnv) {
      process.env.RALLY_HOME = originalEnv;
    } else {
      delete process.env.RALLY_HOME;
    }
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('writeActive and readActive roundtrip', () => {
  const originalEnv = process.env.RALLY_HOME;
  const tempDir = mkdtempSync(join(tmpdir(), 'rally-test-'));
  
  try {
    process.env.RALLY_HOME = tempDir;
    const data = {
      dispatches: [
        { id: 1, project: 'test-project', status: 'active' }
      ]
    };
    
    writeActive(data);
    const result = readActive();
    
    assert.deepEqual(result, data);
  } finally {
    if (originalEnv) {
      process.env.RALLY_HOME = originalEnv;
    } else {
      delete process.env.RALLY_HOME;
    }
    rmSync(tempDir, { recursive: true, force: true });
  }
});
