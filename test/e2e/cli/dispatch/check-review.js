/**
 * Soft check for REVIEW.md existence.
 * Usage: node check-review.js <path-to-review-md>
 *
 * Exits 0 always — prints whether the file exists.
 * Copilot may not complete reviews on all platforms (e.g. Windows CI).
 */
import { existsSync } from 'node:fs';

const reviewPath = process.argv[2];
if (!reviewPath) {
  console.error('Usage: node check-review.js <path-to-review-md>');
  process.exit(1);
}

if (existsSync(reviewPath)) {
  console.log(`REVIEW.md found: ${reviewPath}`);
} else {
  console.log(`REVIEW.md not found (Copilot may not have completed review): ${reviewPath}`);
}
