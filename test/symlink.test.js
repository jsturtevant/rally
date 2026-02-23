import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, existsSync, symlinkSync, readlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  createSymlink,
  validateSymlink,
  removeSymlink,
  checkSymlinkSupport
} from '../lib/symlink.js';

test('createSymlink creates valid symlink', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'rally-test-'));
  
  try {
    const target = join(tempDir, 'target');
    const linkPath = join(tempDir, 'link');
    
    mkdirSync(target);
    createSymlink(target, linkPath);
    
    assert.ok(existsSync(linkPath));
    const actualTarget = readlinkSync(linkPath);
    assert.strictEqual(actualTarget, target);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('validateSymlink returns true for valid symlink', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'rally-test-'));
  
  try {
    const target = join(tempDir, 'target');
    const linkPath = join(tempDir, 'link');
    
    mkdirSync(target);
    createSymlink(target, linkPath);
    
    assert.strictEqual(validateSymlink(linkPath), true);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('validateSymlink returns false for missing symlink', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'rally-test-'));
  
  try {
    const linkPath = join(tempDir, 'nonexistent');
    assert.strictEqual(validateSymlink(linkPath), false);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('validateSymlink returns false for broken symlink', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'rally-test-'));
  
  try {
    const target = join(tempDir, 'target');
    const linkPath = join(tempDir, 'link');
    
    mkdirSync(target);
    createSymlink(target, linkPath);
    rmSync(target, { recursive: true });
    
    assert.strictEqual(validateSymlink(linkPath), false);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('removeSymlink removes existing symlink', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'rally-test-'));
  
  try {
    const target = join(tempDir, 'target');
    const linkPath = join(tempDir, 'link');
    
    mkdirSync(target);
    createSymlink(target, linkPath);
    assert.ok(existsSync(linkPath));
    
    removeSymlink(linkPath);
    assert.ok(!existsSync(linkPath));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('removeSymlink is idempotent when symlink missing', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'rally-test-'));
  
  try {
    const linkPath = join(tempDir, 'nonexistent');
    removeSymlink(linkPath);
    assert.ok(!existsSync(linkPath));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('createSymlink throws when target does not exist', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'rally-test-'));
  
  try {
    const target = join(tempDir, 'nonexistent');
    const linkPath = join(tempDir, 'link');
    
    assert.throws(() => {
      createSymlink(target, linkPath);
    }, /Symlink target does not exist/);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('createSymlink is idempotent when symlink exists with correct target', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'rally-test-'));
  
  try {
    const target = join(tempDir, 'target');
    const linkPath = join(tempDir, 'link');
    
    mkdirSync(target);
    createSymlink(target, linkPath);
    createSymlink(target, linkPath);
    
    assert.ok(existsSync(linkPath));
    const actualTarget = readlinkSync(linkPath);
    assert.strictEqual(actualTarget, target);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('checkSymlinkSupport runs without error on supported platforms', () => {
  assert.doesNotThrow(() => {
    checkSymlinkSupport();
  });
});

test('createSymlink replaces symlink pointing to different target', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'rally-test-'));
  
  try {
    const target1 = join(tempDir, 'target1');
    const target2 = join(tempDir, 'target2');
    const linkPath = join(tempDir, 'link');
    
    mkdirSync(target1);
    mkdirSync(target2);
    createSymlink(target1, linkPath);
    assert.strictEqual(readlinkSync(linkPath), target1);
    
    createSymlink(target2, linkPath);
    assert.strictEqual(readlinkSync(linkPath), target2);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
