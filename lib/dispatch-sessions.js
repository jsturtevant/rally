import { getActiveDispatches } from './active.js';

/**
 * List all active dispatches with their session info.
 *
 * @param {object} [opts]
 * @param {Function} [opts._getActiveDispatches] - Injectable for testing
 * @returns {object[]} Array of { id, session_id, status }
 */
export function listDispatchSessions(opts = {}) {
  const getDispatches = opts._getActiveDispatches || getActiveDispatches;
  const dispatches = getDispatches();

  return dispatches.map((d) => ({
    id: d.id,
    session_id: d.session_id,
    status: d.status,
  }));
}

/**
 * Format dispatch sessions into a human-readable table string.
 *
 * @param {object[]} sessions - Array from listDispatchSessions
 * @returns {string}
 */
export function formatDispatchSessions(sessions) {
  if (sessions.length === 0) {
    return 'No active dispatches.';
  }

  const header = `${'Dispatch'.padEnd(18)}${'Session'.padEnd(40)}Status`;
  const rows = sessions.map((s) => {
    const displaySession = (!s.session_id || s.session_id === 'pending' || /^\d+$/.test(s.session_id))
      ? '(no session)'
      : s.session_id;
    return `${s.id.padEnd(18)}${displaySession.padEnd(40)}${s.status}`;
  });

  return [header, ...rows].join('\n');
}
