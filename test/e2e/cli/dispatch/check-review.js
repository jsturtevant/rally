/**
 * Verify a file exists after dispatch completes.
 * Usage: node check-review.js <path-to-file>
 *
 * Exits 0 and prints the path if the file exists.
 * Exits 1 with an error if it does not.
 */
import { existsSync } from 'node:fs';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node check-review.js <path>');
  process.exit(1);
}

if (existsSync(filePath)) {
  console.log(filePath);
} else {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}
