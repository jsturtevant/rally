import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  addExcludes,
  removeExcludes,
  hasExcludes,
  getExcludeEntries
} from '../lib/exclude.js';

test('getExcludeEntries returns standard entries', () => {
  const entries = getExcludeEntries();
  assert.deepEqual(entries, [
    '.squad',
    '.squad/',
    '.squad-templates',
    '.squad-templates/',
    '.github/agents/squad.agent.md'
  ]);
});

test('addExcludes creates exclude file with header', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'rally-test-'));
  
  try {
    const gitDir = join(tempDir, '.git');
    const entries = ['.squad', '.squad/'];
    
    addExcludes(gitDir, entries);
    
    const excludePath = join(gitDir, 'info', 'exclude');
    const content = readFileSync(excludePath, 'utf8');
    
    assert.ok(content.includes('# Rally — Squad symlinks'));
    assert.ok(content.includes('.squad'));
    assert.ok(content.includes('.squad/'));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('addExcludes adds entries to existing file', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'rally-test-'));
  
  try {
    const gitDir = join(tempDir, '.git');
    const infoDir = join(gitDir, 'info');
    const excludePath = join(infoDir, 'exclude');
    
    mkdirSync(infoDir, { recursive: true });
    writeFileSync(excludePath, '# Existing content\n*.log\n', 'utf8');
    
    const entries = ['.squad', '.squad/'];
    addExcludes(gitDir, entries);
    
    const content = readFileSync(excludePath, 'utf8');
    assert.ok(content.includes('*.log'));
    assert.ok(content.includes('# Rally — Squad symlinks'));
    assert.ok(content.includes('.squad'));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('addExcludes is idempotent - skips duplicates', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'rally-test-'));
  
  try {
    const gitDir = join(tempDir, '.git');
    const entries = ['.squad', '.squad/'];
    
    addExcludes(gitDir, entries);
    addExcludes(gitDir, entries);
    
    const excludePath = join(gitDir, 'info', 'exclude');
    const content = readFileSync(excludePath, 'utf8');
    const lines = content.split('\n').filter(l => l === '.squad');
    
    assert.strictEqual(lines.length, 1);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('removeExcludes removes entries and header', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'rally-test-'));
  
  try {
    const gitDir = join(tempDir, '.git');
    const entries = ['.squad', '.squad/'];
    
    addExcludes(gitDir, entries);
    removeExcludes(gitDir, entries);
    
    const excludePath = join(gitDir, 'info', 'exclude');
    const content = readFileSync(excludePath, 'utf8');
    
    assert.ok(!content.includes('# Rally — Squad symlinks'));
    assert.ok(!content.includes('.squad'));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('removeExcludes handles missing file gracefully', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'rally-test-'));
  
  try {
    const gitDir = join(tempDir, '.git');
    const entries = ['.squad', '.squad/'];
    
    assert.doesNotThrow(() => {
      removeExcludes(gitDir, entries);
    });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('hasExcludes returns true when all entries present', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'rally-test-'));
  
  try {
    const gitDir = join(tempDir, '.git');
    const entries = ['.squad', '.squad/'];
    
    addExcludes(gitDir, entries);
    assert.strictEqual(hasExcludes(gitDir, entries), true);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('hasExcludes returns false when entries missing', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'rally-test-'));
  
  try {
    const gitDir = join(tempDir, '.git');
    const entries = ['.squad', '.squad/'];
    
    assert.strictEqual(hasExcludes(gitDir, entries), false);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('hasExcludes returns false when only some entries present', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'rally-test-'));
  
  try {
    const gitDir = join(tempDir, '.git');
    const infoDir = join(gitDir, 'info');
    const excludePath = join(infoDir, 'exclude');
    
    mkdirSync(infoDir, { recursive: true });
    writeFileSync(excludePath, '.squad\n', 'utf8');
    
    const entries = ['.squad', '.squad/'];
    assert.strictEqual(hasExcludes(gitDir, entries), false);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('hasExcludes handles missing .git/info directory', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'rally-test-'));
  
  try {
    const gitDir = join(tempDir, '.git');
    const entries = ['.squad', '.squad/'];
    
    assert.strictEqual(hasExcludes(gitDir, entries), false);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
