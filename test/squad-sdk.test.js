import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  migrateLegacyPersonalSquad,
  personalSquadExists,
  resolveGlobalSquadPath,
  getPersonalSquadRoot,
} from '../lib/squad-sdk.js';
import { withTempSquadHome } from './helpers/temp-env.js';

/** Guards against a platform where the SDK path isn't env-overridable. */
function isolatedGlobalSquadPath(tempDir) {
  const globalPath = resolveGlobalSquadPath();
  assert.ok(
    globalPath.startsWith(tempDir),
    `expected the global squad path to be isolated under ${tempDir}, got ${globalPath}`
  );
  return globalPath;
}

function writeLegacySquad(globalPath) {
  const legacyPath = join(globalPath, '.squad');
  mkdirSync(join(legacyPath, 'agents', 'lead'), { recursive: true });
  writeFileSync(join(legacyPath, 'config.json'), '{}');
  writeFileSync(join(legacyPath, 'agents', 'lead', 'charter.md'), '# Lead');
  return legacyPath;
}

describe('migrateLegacyPersonalSquad', () => {
  let globalPath;

  beforeEach((t) => {
    globalPath = isolatedGlobalSquadPath(withTempSquadHome(t));
  });

  test('moves a pre-0.11 squad to the personal-squad directory', () => {
    const legacyPath = writeLegacySquad(globalPath);

    const result = migrateLegacyPersonalSquad({ quiet: true });

    assert.equal(result.migrated, true);
    assert.equal(result.from, legacyPath);
    assert.equal(result.to, getPersonalSquadRoot());
    assert.ok(!existsSync(legacyPath), 'legacy directory should be gone');
    assert.ok(existsSync(join(getPersonalSquadRoot(), 'agents', 'lead', 'charter.md')));
  });

  test('is a no-op when the squad is already at the new location', () => {
    mkdirSync(join(getPersonalSquadRoot(), 'agents'), { recursive: true });

    const result = migrateLegacyPersonalSquad({ quiet: true });

    assert.equal(result.migrated, false);
    assert.equal(result.reason, 'already-current');
  });

  test('leaves a legacy directory alone when the new location already exists', () => {
    const legacyPath = writeLegacySquad(globalPath);
    mkdirSync(getPersonalSquadRoot(), { recursive: true });

    migrateLegacyPersonalSquad({ quiet: true });

    assert.ok(existsSync(legacyPath), 'legacy directory should not be removed');
  });

  test('is a no-op when no squad exists at all', () => {
    const result = migrateLegacyPersonalSquad({ quiet: true });

    assert.equal(result.migrated, false);
    assert.equal(result.reason, 'no-legacy');
  });

  test('is idempotent across repeated calls', () => {
    writeLegacySquad(globalPath);

    assert.equal(migrateLegacyPersonalSquad({ quiet: true }).migrated, true);
    assert.equal(migrateLegacyPersonalSquad({ quiet: true }).migrated, false);
    assert.ok(existsSync(getPersonalSquadRoot()));
  });
});

describe('personalSquadExists', () => {
  let globalPath;

  beforeEach((t) => {
    globalPath = isolatedGlobalSquadPath(withTempSquadHome(t));
  });

  test('returns false when no squad exists', () => {
    assert.equal(personalSquadExists({ quiet: true }), false);
  });

  test('migrates a legacy squad and reports it as existing', () => {
    mkdirSync(join(globalPath, '.squad', 'agents'), { recursive: true });

    assert.equal(personalSquadExists({ quiet: true }), true);
    assert.ok(existsSync(getPersonalSquadRoot()));
  });
});
