/**
 * Create a URL-safe slug from a title.
 * Lowercase, replace non-alphanumeric with hyphens, collapse, trim, cap at 50 chars.
 * @param {string} title
 * @returns {string}
 */
export function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 50)
    .replace(/^-+|-+$/g, '') || 'untitled';
}
