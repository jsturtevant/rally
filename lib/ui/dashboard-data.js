import { getActiveDispatches } from '../active.js';
import { refreshDispatchStatuses } from '../dispatch-refresh.js';
import { checkWorktreeHealth, enrichWithStats } from '../dispatch-stats.js';

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
 * Compute summary counts from dispatches.
 */
export function computeSummary(dispatches) {
  let active = 0;
  let done = 0;
  let orphaned = 0;

  for (const d of dispatches) {
    if (d.status === 'done' || d.status === 'cleaned' || d.status === 'reviewing' || d.status === 'pushed') {
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
 * Group dispatches by project (repo name), preserving original order.
 */
export function groupByProject(dispatches) {
  const groups = new Map();
  for (const d of dispatches) {
    const project = d.repo ?? 'unknown';
    if (!groups.has(project)) {
      groups.set(project, []);
    }
    groups.get(project).push(d);
  }
  return Array.from(groups.entries()).map(([project, items]) => ({ project, dispatches: items }));
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

  if (dispatches.length === 0) {
    lines.push('No active dispatches');
  } else {
    const groups = groupByProject(dispatches);
    const colWidths = { issueRef: 12, branch: 28, folder: 30, status: 20, changes: 10, age: 6 };

    for (const group of groups) {
      lines.push(group.project);
      for (const d of group.dispatches) {
        const issueRef = d.type === 'pr' ? `PR #${d.number}` : `Issue #${d.number}`;
        const age = formatAge(d.created ?? d.created_at);
        const folderPath = d.worktreePath ?? '';
        const truncatedFolder = folderPath.length > colWidths.folder
          ? '\u2026' + folderPath.slice(-(colWidths.folder - 1))
          : folderPath;
        const row = [
          '  ',
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
  }

  lines.push('');
  lines.push(`${summary.active} active \u00b7 ${summary.done} done \u00b7 ${summary.orphaned} orphaned`);

  return lines.join('\n');
}
