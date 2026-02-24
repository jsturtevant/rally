import { existsSync, readFileSync } from 'node:fs';
import { getActiveDispatches } from '../active.js';
import { refreshDispatchStatuses } from '../dispatch-refresh.js';
import { parseCopilotStats } from '../copilot-stats.js';

/**
 * Format a timestamp into a human-readable age string.
 */
export function formatAge(createdAt) {
  if (!createdAt) return '—';
  const ts = new Date(createdAt).getTime();
  if (Number.isNaN(ts)) return '—';
  const ms = Date.now() - ts;
  if (ms < 0) return '0m';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

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
 * Compute summary counts from dispatches.
 */
export function computeSummary(dispatches) {
  let active = 0;
  let done = 0;
  let orphaned = 0;

  for (const d of dispatches) {
    if (d.status === 'done' || d.status === 'cleaned' || d.status === 'reviewing') {
      done++;
    } else if (!d.healthy) {
      orphaned++;
    } else {
      active++;
    }
  }

  return { active, done, orphaned };
}

/**
 * Enrich dispatches with parsed copilot stats from log files.
 */
export function enrichWithStats(dispatches, _readFile) {
  const readFile = _readFile || readFileSync;
  const terminalStatuses = new Set(['reviewing', 'done', 'cleaned']);
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

/**
 * Load and process dashboard data.
 */
export function getDashboardData({ project, _refreshDispatchStatuses } = {}) {
  const refresh = _refreshDispatchStatuses || refreshDispatchStatuses;
  refresh();
  const raw = getActiveDispatches();
  let dispatches = checkWorktreeHealth(raw);
  dispatches = enrichWithStats(dispatches);

  if (project) {
    dispatches = dispatches.filter(d => d.repo && (d.repo.endsWith('/' + project) || d.repo === project));
  }

  const summary = computeSummary(dispatches);
  return { dispatches, summary };
}

/**
 * Render a plain text dashboard (no ANSI escape codes) for non-TTY environments.
 */
export function renderPlainDashboard({ project } = {}) {
  const { dispatches, summary } = getDashboardData({ project });

  const lines = [];
  lines.push('Rally Dashboard');
  lines.push('');

  const colWidths = { project: 20, issueRef: 12, branch: 28, folder: 30, status: 20, changes: 10, age: 6 };
  const header = [
    'Project'.padEnd(colWidths.project),
    'Issue/PR'.padEnd(colWidths.issueRef),
    'Branch'.padEnd(colWidths.branch),
    'Folder'.padEnd(colWidths.folder),
    'Status'.padEnd(colWidths.status),
    'Changes'.padEnd(colWidths.changes),
    'Age'.padEnd(colWidths.age),
  ].join(' ');
  lines.push(header);

  if (dispatches.length === 0) {
    lines.push('No active dispatches');
  } else {
    for (const d of dispatches) {
      const issueRef = d.type === 'pr' ? `PR #${d.number}` : `Issue #${d.number}`;
      const age = formatAge(d.created ?? d.created_at);
      const folderPath = d.worktreePath ?? '';
      const truncatedFolder = folderPath.length > colWidths.folder
        ? '…' + folderPath.slice(-(colWidths.folder - 1))
        : folderPath;
      const row = [
        (d.repo ?? '').padEnd(colWidths.project),
        issueRef.padEnd(colWidths.issueRef),
        (d.branch ?? '').padEnd(colWidths.branch),
        truncatedFolder.padEnd(colWidths.folder),
        (d.status ?? '').padEnd(colWidths.status),
        (d.changes ?? '').padEnd(colWidths.changes),
        age.padEnd(colWidths.age),
      ].join(' ');
      lines.push(row);
    }
  }

  lines.push('');
  lines.push(`${summary.active} active · ${summary.done} done · ${summary.orphaned} orphaned`);

  return lines.join('\n');
}
