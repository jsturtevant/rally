import { getActiveDispatches, updateDispatchStatus } from './active.js';

/**
 * Check if a process with the given PID is still running.
 * Uses process.kill(pid, 0) which sends no signal but checks existence.
 *
 * @param {number} pid
 * @returns {boolean}
 */
export function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Refresh dispatch statuses by checking whether Copilot PIDs are still alive.
 * Dispatches in "planning" or "implementing" whose PID has exited get moved to "reviewing".
 *
 * @param {object} [opts]
 * @param {Function} [opts._getActiveDispatches] - Injectable for testing
 * @param {Function} [opts._updateDispatchStatus] - Injectable for testing
 * @param {Function} [opts._isProcessRunning] - Injectable for testing
 * @returns {object[]} List of dispatches that were updated
 */
export function refreshDispatchStatuses(opts = {}) {
  const getDispatches = opts._getActiveDispatches || getActiveDispatches;
  const updateStatus = opts._updateDispatchStatus || updateDispatchStatus;
  const checkRunning = opts._isProcessRunning || isProcessRunning;

  const dispatches = getDispatches();
  const updated = [];

  for (const d of dispatches) {
    if (d.status !== 'planning' && d.status !== 'implementing') {
      continue;
    }

    const pid = Number(d.session_id);
    if (!Number.isFinite(pid) || pid <= 0) {
      continue;
    }

    if (!checkRunning(pid)) {
      try {
        updateStatus(d.id, 'reviewing');
        updated.push({ ...d, status: 'reviewing' });
      } catch {
        // Best-effort — don't crash if update fails
      }
    }
  }

  return updated;
}
