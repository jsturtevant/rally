import { statSync } from 'node:fs';
import { getActiveDispatches, updateDispatchStatus, updateDispatchField } from './active.js';
import { parseSessionIdFromLog } from './copilot.js';
import { isPidAlive } from './utils.js';

const LOG_ACTIVITY_THRESHOLD_MS = 30_000;

/**
 * Check if a process with the given PID is still running.
 * Delegates to the shared isPidAlive which correctly handles EPERM.
 *
 * @param {number} pid
 * @returns {boolean}
 */
export function isProcessRunning(pid) {
  return isPidAlive(pid);
}

/**
 * Check if a log file has been modified within the given threshold.
 * Detached Copilot processes may still be writing to the log after the
 * parent shell PID exits, so a recent mtime means the process is likely
 * still active.
 *
 * @param {string} logPath
 * @param {object} [opts]
 * @param {number} [opts.thresholdMs] - Max age in ms to consider "active" (default 30 000)
 * @param {Function} [opts._statSync] - Injectable for testing
 * @param {Function} [opts._now] - Injectable Date.now for testing
 * @returns {boolean}
 */
export function isLogFileActive(logPath, opts = {}) {
  const threshold = opts.thresholdMs ?? LOG_ACTIVITY_THRESHOLD_MS;
  const stat = opts._statSync || statSync;
  const now = opts._now || Date.now;

  if (!logPath) return false;

  try {
    const { mtimeMs } = stat(logPath);
    return (now() - mtimeMs) < threshold;
  } catch {
    return false;
  }
}

/**
 * Refresh dispatch statuses by checking whether Copilot PIDs are still alive.
 * Dispatches in "implementing" whose PID has exited get moved
 * to "reviewing" only when the log file is also no longer being written to.
 *
 * @param {object} [opts]
 * @param {Function} [opts._getActiveDispatches] - Injectable for testing
 * @param {Function} [opts._updateDispatchStatus] - Injectable for testing
 * @param {Function} [opts._isProcessRunning] - Injectable for testing
 * @param {Function} [opts._isLogFileActive] - Injectable for testing
 * @param {Function} [opts._updateDispatchField] - Injectable for testing
 * @param {Function} [opts._parseSessionIdFromLog] - Injectable for testing
 * @returns {object[]} List of dispatches that were updated
 */
export function refreshDispatchStatuses(opts = {}) {
  const getDispatches = opts._getActiveDispatches || getActiveDispatches;
  const updateStatus = opts._updateDispatchStatus || updateDispatchStatus;
  const updateField = opts._updateDispatchField || updateDispatchField;
  const checkRunning = opts._isProcessRunning || isProcessRunning;
  const checkLog = opts._isLogFileActive || isLogFileActive;
  const parseSession = opts._parseSessionIdFromLog || parseSessionIdFromLog;

  const dispatches = getDispatches();
  const updated = [];

  for (const d of dispatches) {
    if (d.status !== 'implementing') {
      continue;
    }

    const pid = Number(d.session_id);
    if (!Number.isFinite(pid) || pid <= 0) {
      continue;
    }

    if (!checkRunning(pid) && !checkLog(d.logPath)) {
      try {
        updateStatus(d.id, 'reviewing');

        // Auto-resolve PID-style session_id to real UUID from log
        if (/^\d+$/.test(d.session_id)) {
          const realSessionId = parseSession(d.logPath);
          if (realSessionId) {
            try {
              updateField(d.id, 'session_id', realSessionId);
            } catch {
              // Best-effort — don't crash if field update fails
            }
          }
        }

        updated.push({ ...d, status: 'reviewing' });
      } catch {
        // Best-effort — don't crash if update fails
      }
    }
  }

  return updated;
}
