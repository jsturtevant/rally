import { existsSync, readFileSync } from 'node:fs';
import { getActiveDispatches, updateDispatchStatus, updateDispatchField } from './active.js';
import { parseSessionIdFromLog } from './copilot.js';
import { isPidAlive } from './utils.js';

/**
 * Markers that terminate a Copilot session summary block.
 *
 * Copilot CLI 1.0.76 replaced the old labelled summary ("Total session time:")
 * with a compact block ending in a `Resume` line. Both are matched so logs from
 * either CLI generation — including dispatches already in flight — are detected.
 */
const LOG_COMPLETE_MARKERS = [
  /Total session time:/,
  /^Resume\s+copilot --resume=/m,
  /^AI Credits\s+[\d.]+/m,
];

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
 * Check whether a Copilot log contains a deterministic completion marker.
 * Copilot writes a summary block when the session finishes, which avoids
 * timing-dependent mtime heuristics.
 *
 * @param {string} logPath
 * @param {object} [opts]
 * @param {Function} [opts._exists] - Injectable for testing
 * @param {Function} [opts._readFile] - Injectable for testing
 * @returns {boolean}
 */
export function isLogComplete(logPath, opts = {}) {
  const exists = opts._exists || existsSync;
  const readFile = opts._readFile || ((path) => readFileSync(path, 'utf8'));

  if (!logPath || !exists(logPath)) return false;

  try {
    const content = readFile(logPath);
    if (!content) return false;
    return LOG_COMPLETE_MARKERS.some((marker) => marker.test(String(content)));
  } catch {
    return false;
  }
}

/**
 * Refresh dispatch statuses by checking whether Copilot PIDs are still alive.
 * Dispatches in "implementing" whose PID has exited get moved to "reviewing"
 * only after their output log contains Copilot's completion summary marker.
 *
 * @param {object} [opts]
 * @param {Function} [opts._getActiveDispatches] - Injectable for testing
 * @param {Function} [opts._updateDispatchStatus] - Injectable for testing
 * @param {Function} [opts._isProcessRunning] - Injectable for testing
 * @param {Function} [opts._isLogComplete] - Injectable for testing
 * @param {Function} [opts._isLogFileActive] - Backward-compatible alias for testing
 * @param {Function} [opts._updateDispatchField] - Injectable for testing
 * @param {Function} [opts._parseSessionIdFromLog] - Injectable for testing
 * @returns {object[]} List of dispatches that were updated
 */
export function refreshDispatchStatuses(opts = {}) {
  const getDispatches = opts._getActiveDispatches || getActiveDispatches;
  const updateStatus = opts._updateDispatchStatus || updateDispatchStatus;
  const updateField = opts._updateDispatchField || updateDispatchField;
  const checkRunning = opts._isProcessRunning || isProcessRunning;
  const checkLog = opts._isLogComplete || opts._isLogFileActive || isLogComplete;
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

    if (!checkRunning(pid) && checkLog(d.logPath)) {
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
