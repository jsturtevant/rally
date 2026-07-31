import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseCopilotStats, formatStatsSummary } from '../lib/copilot-stats.js';

describe('parseCopilotStats', () => {
  test('parseCopilotStats returns null for undefined input', () => {
    assert.strictEqual(parseCopilotStats(undefined), null);
  });

  test('parseCopilotStats returns null for null input', () => {
    assert.strictEqual(parseCopilotStats(null), null);
  });

  test('parseCopilotStats returns null for empty string', () => {
    assert.strictEqual(parseCopilotStats(''), null);
  });

  test('parseCopilotStats returns null for content with no stats block', () => {
    assert.strictEqual(parseCopilotStats('Just some random output.'), null);
  });

  test('parseCopilotStats handles malformed stats gracefully with garbled values', () => {
    const input = [
      'Total usage est:        not-a-number',
      'API time spent:         xyz',
      'Total session time:     abc',
      'Total code changes:     nope',
    ].join('\n');

    const result = parseCopilotStats(input);
    // Should not throw — returns null since no valid fields parsed
    assert.strictEqual(result, null);
  });

  test('parseCopilotStats extracts only premium requests when other fields missing', () => {
    const input = 'Total usage est:        5 Premium requests\n';
    const result = parseCopilotStats(input);
    assert.notStrictEqual(result, null);
    assert.strictEqual(result.premiumRequests, 5);
    assert.strictEqual(result.apiTime, null);
    assert.strictEqual(result.sessionTime, null);
    assert.strictEqual(result.codeChanges, null);
  });

  test('extracts only code changes when other fields missing', () => {
    const input = 'Total code changes:     +42 -7\n';
    const result = parseCopilotStats(input);
    assert.notStrictEqual(result, null);
    assert.deepStrictEqual(result.codeChanges, { additions: 42, deletions: 7 });
    assert.strictEqual(result.premiumRequests, null);
  });

  test('extracts only time fields when code changes missing', () => {
    const input = [
      'API time spent:         2m 48s',
      'Total session time:     3m 6s',
    ].join('\n');
    const result = parseCopilotStats(input);
    assert.notStrictEqual(result, null);
    assert.strictEqual(result.apiTime, '2m 48s');
    assert.strictEqual(result.sessionTime, '3m 6s');
  });

  test('parses full stats block with all fields', () => {
    const input = [
      'Total usage est:        3 Premium requests',
      'API time spent:         2m 48s',
      'Total session time:     3m 6s',
      'Total code changes:     +164 -1',
      'Breakdown by AI model:',
      ' claude-opus-4.5         1.6m in, 8.3k out, 1.5m cached (Est. 3 Premium requests)',
    ].join('\n');
    const result = parseCopilotStats(input);
    assert.strictEqual(result.premiumRequests, 3);
    assert.strictEqual(result.apiTime, '2m 48s');
    assert.strictEqual(result.sessionTime, '3m 6s');
    assert.deepStrictEqual(result.codeChanges, { additions: 164, deletions: 1 });
  });

  test('parses model breakdown entries', () => {
    const input = [
      'Total usage est:        3 Premium requests',
      'Breakdown by AI model:',
      ' claude-opus-4.5         1.6m in, 8.3k out, 1.5m cached (Est. 3 Premium requests)',
    ].join('\n');
    const result = parseCopilotStats(input);
    assert.ok(Array.isArray(result.models));
    assert.strictEqual(result.models.length, 1);
    assert.strictEqual(result.models[0].name, 'claude-opus-4.5');
  });

  test('handles 1 Premium request (singular)', () => {
    const input = 'Total usage est:        1 Premium request\n';
    const result = parseCopilotStats(input);
    assert.strictEqual(result.premiumRequests, 1);
  });

  test('extracts stats from output with surrounding text', () => {
    const input = [
      'Some copilot preamble...',
      '',
      'Total usage est:        7 Premium requests',
      'API time spent:         5m 12s',
      'Total session time:     8m 30s',
      'Total code changes:     +250 -80',
      '',
      'Session ended.',
    ].join('\n');
    const result = parseCopilotStats(input);
    assert.strictEqual(result.premiumRequests, 7);
    assert.deepStrictEqual(result.codeChanges, { additions: 250, deletions: 80 });
  });
});

describe('formatStatsSummary', () => {
  test('formats all stats', () => {
    const stats = {
      premiumRequests: 3,
      apiTime: '2m 48s',
      sessionTime: '3m 6s',
      codeChanges: { additions: 164, deletions: 1 },
      models: [],
    };
    const summary = formatStatsSummary(stats);
    assert.strictEqual(summary, 'Changes: +164 -1 · Session: 3m 6s · Premium requests: 3');
  });

  test('returns null for null stats', () => {
    assert.strictEqual(formatStatsSummary(null), null);
  });

  test('formats partial stats', () => {
    const stats = {
      premiumRequests: null,
      apiTime: null,
      sessionTime: null,
      codeChanges: { additions: 10, deletions: 5 },
      models: [],
    };
    assert.strictEqual(formatStatsSummary(stats), 'Changes: +10 -5');
  });
});

describe('parseCopilotStats — Copilot CLI >= 1.0.76 compact format', () => {
  // Captured verbatim from `@github/copilot@1.0.76`, the version this repo pins.
  const COMPACT_SUMMARY = [
    'Changes    +12 -3',
    'AI Credits 7.02 (7s)',
    'Tokens     ↑ 51.0k (25.4k cached, 25.6k written) • ↓ 118',
    'Resume     copilot --resume=76493370-a279-4bf6-8211-e8234c06d8c3',
  ].join('\n');

  test('parses the compact summary block', () => {
    const result = parseCopilotStats(COMPACT_SUMMARY);
    assert.notStrictEqual(result, null);
    assert.strictEqual(result.aiCredits, 7.02);
    assert.strictEqual(result.apiTime, '7s');
    assert.deepStrictEqual(result.codeChanges, { additions: 12, deletions: 3 });
  });

  test('reports no premium requests, since the newer CLI does not emit them', () => {
    const result = parseCopilotStats(COMPACT_SUMMARY);
    assert.strictEqual(result.premiumRequests, null);
    assert.deepStrictEqual(result.models, []);
  });

  test('parses a zero-change session', () => {
    const result = parseCopilotStats('Changes    +0 -0\nAI Credits 11.2 (7s)\n');
    assert.deepStrictEqual(result.codeChanges, { additions: 0, deletions: 0 });
    assert.strictEqual(result.aiCredits, 11.2);
  });

  test('parses AI credits without a parenthesised duration', () => {
    const result = parseCopilotStats('AI Credits 3\n');
    assert.strictEqual(result.aiCredits, 3);
    assert.strictEqual(result.apiTime, null);
  });

  test('formatStatsSummary falls back to AI credits', () => {
    const summary = formatStatsSummary(parseCopilotStats(COMPACT_SUMMARY));
    assert.strictEqual(summary, 'Changes: +12 -3 · AI credits: 7.02');
  });

  test('prefers premium requests over AI credits when both are present', () => {
    const input = `Total usage est:        3 Premium requests\n${COMPACT_SUMMARY}`;
    const summary = formatStatsSummary(parseCopilotStats(input));
    assert.ok(summary.includes('Premium requests: 3'));
    assert.ok(!summary.includes('AI credits'));
  });
});
