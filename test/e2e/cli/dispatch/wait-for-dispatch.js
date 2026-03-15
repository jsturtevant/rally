/**
 * Poll rally dispatch refresh until a dispatch completes.
 * Usage: node wait-for-dispatch.js <dispatch-id> [timeout_secs] [--expect-file <path>]
 *
 * Reads RALLY_HOME from env. Runs rally dispatch refresh, then checks active.yaml.
 * Exits 0 when:
 *   - The dispatch status changes from "implementing" (e.g. to "reviewing" or "upstream"), OR
 *   - The Copilot PID is no longer alive (process exited before status was updated).
 * If --expect-file is given, waits until that file also exists before exiting 0.
 * This handles Windows where gh.exe exits but the copilot child process is still writing.
 * Exits 1 on timeout.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { isPidAlive } from '../../../../lib/utils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RALLY_BIN = join(__dirname, '..', '..', '..', '..', 'bin', 'rally.js');

// Parse args: <dispatch-id> [timeout_secs] [--expect-file <path>]
const args = process.argv.slice(2);
let dispatchId = null;
let timeoutSecs = 120;
let expectFile = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--expect-file' && args[i + 1]) {
    expectFile = args[++i];
  } else if (!dispatchId) {
    dispatchId = args[i];
  } else {
    timeoutSecs = parseInt(args[i], 10);
  }
}

const rallyHome = process.env.RALLY_HOME;

if (!dispatchId || !rallyHome) {
  console.error('Usage: node wait-for-dispatch.js <dispatch-id> [timeout_secs] [--expect-file <path>]');
  console.error('RALLY_HOME must be set');
  process.exit(1);
}

if (!Number.isFinite(timeoutSecs) || timeoutSecs <= 0) {
  console.error('Invalid timeout: must be a positive number');
  process.exit(1);
}

const interval = 3000;
const deadline = Date.now() + (timeoutSecs * 1000);
let lastError = null;

while (Date.now() < deadline) {
  // Run rally dispatch refresh to update statuses
  try {
    execFileSync(process.execPath, [RALLY_BIN, 'dispatch', 'refresh'], {
      encoding: 'utf8',
      timeout: 10000,
      env: { ...process.env, NO_COLOR: '1' },
    });
  } catch (err) {
    lastError = err;
    // refresh might fail if no dispatches — continue
  }

  // Read active.yaml and check status
  try {
    const activeYaml = readFileSync(join(rallyHome, 'active.yaml'), 'utf8');
    const active = yaml.load(activeYaml, { schema: yaml.CORE_SCHEMA });
    const raw = active?.dispatches || active;
    const dispatches = Array.isArray(raw) ? raw : [];
    const dispatch = dispatches.find(d => d.id === dispatchId);

    if (!dispatch) {
      console.log('cleaned');
      process.exit(0);
    }

    // Both issue and PR dispatches start as 'implementing'.
    // dispatch refresh moves them to 'reviewing' (then 'upstream') when the Copilot PID exits.
    if (dispatch.status !== 'implementing') {
      // If --expect-file given, don't exit until the file exists.
      // On Windows, gh.exe (tracked PID) exits before copilot.exe (child) finishes writing.
      if (!expectFile || existsSync(expectFile)) {
        console.log(dispatch.status);
        process.exit(0);
      }
    }

    const pid = Number(dispatch.pid ?? dispatch.session_id);
    if (Number.isFinite(pid) && pid > 0 && !isPidAlive(pid)) {
      if (!expectFile || existsSync(expectFile)) {
        console.log(dispatch.status);
        process.exit(0);
      }
    }
  } catch (err) {
    lastError = err;
    // active.yaml might not exist yet
  }

  await new Promise(r => setTimeout(r, interval));
}

console.error(`Timed out after ${timeoutSecs}s waiting for ${dispatchId}`);
if (lastError) console.error(`Last error: ${lastError.message}`);
process.exit(1);
