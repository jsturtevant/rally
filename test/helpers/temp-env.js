import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export function withTempRallyHome(t) {
  const dir = mkdtempSync(join(tmpdir(), 'rally-test-'));
  const original = process.env.RALLY_HOME;
  process.env.RALLY_HOME = dir;
  t.after(() => {
    if (original !== undefined) {
      process.env.RALLY_HOME = original;
    } else {
      delete process.env.RALLY_HOME;
    }
    rmSync(dir, { recursive: true, force: true });
  });
  return dir;
}

/**
 * Sets HOME and USERPROFILE to a temp dir and deletes RALLY_HOME so
 * getConfigDir() falls back to home-directory resolution. Restores
 * all three env vars via t.after().
 */
export function withTempHome(t) {
  const dir = mkdtempSync(join(tmpdir(), 'rally-test-home-'));
  const originalHome = process.env.HOME;
  const originalUserProfile = process.env.USERPROFILE;
  const originalRallyHome = process.env.RALLY_HOME;

  delete process.env.RALLY_HOME;
  process.env.HOME = dir;
  process.env.USERPROFILE = dir;

  t.after(() => {
    if (originalHome !== undefined) {
      process.env.HOME = originalHome;
    } else {
      delete process.env.HOME;
    }
    if (originalUserProfile !== undefined) {
      process.env.USERPROFILE = originalUserProfile;
    } else {
      delete process.env.USERPROFILE;
    }
    if (originalRallyHome !== undefined) {
      process.env.RALLY_HOME = originalRallyHome;
    } else {
      delete process.env.RALLY_HOME;
    }
    rmSync(dir, { recursive: true, force: true });
  });

  return dir;
}

/**
 * Isolates the Squad SDK's global squad path (`resolveGlobalSquadPath()`).
 *
 * The SDK resolves that path differently per platform — `XDG_CONFIG_HOME` on
 * Linux, `%APPDATA%` on Windows, and `~/Library/Application Support` on macOS —
 * so every backing variable is redirected at once. Restores them via t.after().
 */
export function withTempSquadHome(t) {
  const dir = mkdtempSync(join(tmpdir(), 'rally-test-squad-'));
  const keys = ['XDG_CONFIG_HOME', 'APPDATA', 'LOCALAPPDATA', 'HOME', 'USERPROFILE'];
  const originals = {};

  for (const key of keys) {
    originals[key] = process.env[key];
    process.env[key] = dir;
  }

  t.after(() => {
    for (const key of keys) {
      if (originals[key] !== undefined) {
        process.env[key] = originals[key];
      } else {
        delete process.env[key];
      }
    }
    rmSync(dir, { recursive: true, force: true });
  });

  return dir;
}