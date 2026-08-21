/**
 * Parse Copilot output stats from a log file's content.
 *
 * Two summary formats are supported.
 *
 * Copilot CLI <= 1.0.19 wrote a labelled block:
 *   Total code changes:     +164 -1
 *   Total session time:     3m 6s
 *   API time spent:         2m 48s
 *   Total usage est:        3 Premium requests
 *   Breakdown by AI model:
 *    claude-opus-4.5         1.6m in, 8.3k out, 1.5m cached (Est. 3 Premium requests)
 *
 * Copilot CLI >= 1.0.76 writes a compact block instead:
 *   Changes    +12 -3
 *   AI Credits 7.02 (7s)
 *   Tokens     ↑ 51.0k (25.4k cached, 25.6k written) • ↓ 118
 *   Resume     copilot --resume=76493370-a279-4bf6-8211-e8234c06d8c3
 *
 * The newer format reports AI credits (a fractional cost) rather than a count of
 * premium requests, and no longer breaks usage down per model.
 *
 * @param {string} logContent - Raw log file content
 * @returns {object|null} Parsed stats or null if no stats found
 */
export function parseCopilotStats(logContent) {
  if (!logContent || !logContent.trim()) return null;

  const stats = {
    premiumRequests: null,
    aiCredits: null,
    apiTime: null,
    sessionTime: null,
    codeChanges: null,
    models: [],
  };

  let found = false;

  const requestsMatch = logContent.match(/Total usage est:\s+(\d+)\s+Premium requests?/);
  if (requestsMatch) {
    stats.premiumRequests = Number(requestsMatch[1]);
    found = true;
  }

  const apiTimeMatch = logContent.match(/API time spent:\s+([^\r\n]+)/);
  if (apiTimeMatch) {
    const val = apiTimeMatch[1].trim();
    if (/^\d+[hms](\s+\d+[hms])*$/.test(val)) {
      stats.apiTime = val;
      found = true;
    }
  }

  const sessionTimeMatch = logContent.match(/Total session time:\s+([^\r\n]+)/);
  if (sessionTimeMatch) {
    const val = sessionTimeMatch[1].trim();
    if (/^\d+[hms](\s+\d+[hms])*$/.test(val)) {
      stats.sessionTime = val;
      found = true;
    }
  }

  const changesMatch = logContent.match(/Total code changes:\s+\+(\d+)\s+-(\d+)/);
  if (changesMatch) {
    stats.codeChanges = {
      additions: Number(changesMatch[1]),
      deletions: Number(changesMatch[2]),
    };
    found = true;
  }

  // Parse model breakdown entries
  const modelRegex = /^\s+(\S+)\s+.+\(Est\.\s+\d+\s+Premium requests?\)/gm;
  let modelMatch;
  while ((modelMatch = modelRegex.exec(logContent)) !== null) {
    stats.models.push({ name: modelMatch[1] });
    found = true;
  }

  // --- Copilot CLI >= 1.0.76 compact summary ---

  // "AI Credits 7.02 (7s)" — the parenthesised duration is the API time spent.
  const creditsMatch = logContent.match(/^AI Credits\s+([\d.]+)(?:\s+\(([^)]+)\))?/m);
  if (creditsMatch) {
    stats.aiCredits = Number(creditsMatch[1]);
    found = true;

    const val = creditsMatch[2] && creditsMatch[2].trim();
    if (val && /^\d+[hms](\s+\d+[hms])*$/.test(val) && !stats.apiTime) {
      stats.apiTime = val;
    }
  }

  // "Changes    +12 -3"
  if (!stats.codeChanges) {
    const compactChangesMatch = logContent.match(/^Changes\s+\+(\d+)\s+-(\d+)/m);
    if (compactChangesMatch) {
      stats.codeChanges = {
        additions: Number(compactChangesMatch[1]),
        deletions: Number(compactChangesMatch[2]),
      };
      found = true;
    }
  }

  return found ? stats : null;
}

/**
 * Format parsed stats into a summary string for display.
 *
 * @param {object|null} stats - Parsed stats from parseCopilotStats
 * @returns {string|null} Formatted summary, or null if no stats
 */
export function formatStatsSummary(stats) {
  if (!stats) return null;

  const parts = [];

  if (stats.codeChanges) {
    parts.push(`Changes: +${stats.codeChanges.additions} -${stats.codeChanges.deletions}`);
  }
  if (stats.sessionTime) {
    parts.push(`Session: ${stats.sessionTime}`);
  }
  if (stats.premiumRequests != null) {
    parts.push(`Premium requests: ${stats.premiumRequests}`);
  } else if (stats.aiCredits != null) {
    parts.push(`AI credits: ${stats.aiCredits}`);
  }

  return parts.length > 0 ? parts.join(' · ') : null;
}

