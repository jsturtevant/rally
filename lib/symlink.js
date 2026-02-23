import { symlinkSync, existsSync, lstatSync, statSync, unlinkSync, readlinkSync, mkdtempSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';
import { platform, tmpdir } from 'node:os';

export function createSymlink(target, linkPath) {
  if (!existsSync(target)) {
    throw new Error(`Symlink target does not exist: ${target}`);
  }
  
  if (existsSync(linkPath)) {
    try {
      const stats = lstatSync(linkPath);
      if (stats.isSymbolicLink()) {
        const currentTarget = readlinkSync(linkPath);
        if (currentTarget === target) {
          return;
        }
      }
    } catch (err) {
      // If we can't read the symlink, proceed to try creating
    }
  }
  
  let type;
  if (platform() === 'win32') {
    const isFile = statSync(target).isFile();
    type = isFile ? 'file' : 'junction';
  }
  symlinkSync(target, linkPath, type);
}

// Planned for offboard command
export function validateSymlink(linkPath) {
  if (!existsSync(linkPath)) {
    return false;
  }
  
  try {
    const stats = lstatSync(linkPath);
    if (!stats.isSymbolicLink()) {
      return false;
    }
    
    const target = readlinkSync(linkPath);
    return existsSync(target);
  } catch (err) {
    return false;
  }
}

// Planned for offboard command
export function removeSymlink(linkPath) {
  if (!existsSync(linkPath)) {
    return;
  }
  
  try {
    const stats = lstatSync(linkPath);
    if (stats.isSymbolicLink()) {
      unlinkSync(linkPath);
    }
  } catch (err) {
    // Already removed or not a symlink
  }
}

export function checkSymlinkSupport() {
  if (platform() !== 'win32') {
    return;
  }
  
  const tempDir = mkdtempSync(join(tmpdir(), 'rally-symlink-test-'));
  const testTarget = join(tempDir, 'target');
  const testLink = join(tempDir, 'link');
  
  try {
    mkdtempSync(testTarget);
    symlinkSync(testTarget, testLink, 'junction');
    unlinkSync(testLink);
    rmdirSync(testTarget);
    rmdirSync(tempDir);
  } catch (err) {
    try {
      rmdirSync(testTarget);
    } catch {}
    try {
      rmdirSync(tempDir);
    } catch {}
    throw new Error('Enable Windows Developer Mode to use Rally. See: https://docs.microsoft.com/en-us/windows/apps/get-started/enable-your-device-for-development');
  }
}
