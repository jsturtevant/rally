/**
 * Run `rally dispatch log` and verify the output contains the completion marker.
 * Usage: node check-log.js <number> [--repo owner/repo]
 *
 * This exercises the real CLI command, not the log file directly.
 */
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RALLY_BIN = join(__dirname, '..', '..', '..', '..', 'bin', 'rally.js');

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node check-log.js <number> [--repo owner/repo]');
  process.exit(1);
}

try {
  const output = execFileSync(process.execPath, [RALLY_BIN, 'dispatch', 'log', ...args], {
    encoding: 'utf8',
    timeout: 10000,
    env: { ...process.env, NO_COLOR: '1' },
  });

  if (output.includes('Total session time:')) {
    console.log('log complete');
  } else {
    console.error('rally dispatch log ran but completion marker not found in output');
    process.exit(1);
  }
} catch (err) {
  console.error(`rally dispatch log failed: ${err.message}`);
  process.exit(1);
}
