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

  return { dispatches };
}

/**
 * Group dispatches by project (repo name), using "(unknown)" for null/empty repos.
 * Returns an array of { project, dispatches } in encounter order.
 */
export function groupByProject(dispatches) {
  const map = new Map();
  for (const d of dispatches) {
    const key = d.repo || '(unknown)';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(d);
  }
  return Array.from(map, ([project, dispatches]) => ({ project, dispatches }));
}

/**
 * Render a plain text dashboard (no ANSI escape codes) for non-TTY environments.
 */
export function renderPlainDashboard({ project } = {}) {
  const { dispatches } = getDashboardData({ project });

  const lines = [];
  lines.push('Rally Dashboard');
  lines.push('');

  const colWidths = { issueRef: 30, branch: 28, folder: 30, status: 20, changes: 10, age: 6 };
  const header = [
    '  ' + 'Issue/PR'.padEnd(colWidths.issueRef),
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
    const groups = groupByProject(dispatches);
    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi];
      if (gi > 0) lines.push('');
      lines.push(group.project);
      for (const d of group.dispatches) {
        const prefix = d.type === 'pr' ? '   PR' : 'Issue';
        let issueRef = `${prefix} #${d.number}`;
        if (d.title) {
          const titleSpace = colWidths.issueRef - issueRef.length - 2;
          if (titleSpace > 3) {
            const title = d.title.length > titleSpace
              ? d.title.slice(0, titleSpace - 1) + '…'
              : d.title;
            issueRef = `${issueRef}  ${title}`;
          }
        }
        const age = formatAge(d.created ?? d.created_at);
        const folderPath = d.worktreePath ?? '';
        const truncatedFolder = folderPath.length > colWidths.folder
          ? '…' + folderPath.slice(-(colWidths.folder - 1))
          : folderPath;
        const row = [
          '  ' + issueRef.padEnd(colWidths.issueRef),
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

  return lines.join('\n');
}
