import { existsSync, readFileSync } from 'node:fs';
import { parseCopilotStats } from './copilot-stats.js';

/**
 * Check worktree health by verifying paths exist on disk.
 */
export function checkWorktreeHealth(dispatches) {
  return dispatches.map(d => ({
    ...d,
    healthy: d.worktreePath ? existsSync(d.worktreePath) : false,
  }));
}

/**
 * Enrich dispatches with parsed copilot stats from log files.
 */
export function enrichWithStats(dispatches, _readFile) {
  const readFile = _readFile || readFileSync;
  const terminalStatuses = new Set(['reviewing', 'upstream']);
  return dispatches.map(d => {
    if (!terminalStatuses.has(d.status) || !d.logPath || !existsSync(d.logPath)) return d;
    try {
      const content = readFile(d.logPath, 'utf8');
      const stats = parseCopilotStats(content);
      const changes = stats?.codeChanges
        ? `+${stats.codeChanges.additions} -${stats.codeChanges.deletions}`
        : null;
      return { ...d, changes };
    } catch {
      return d;
    }
  });
}
