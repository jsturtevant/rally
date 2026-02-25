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
