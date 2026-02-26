#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { setup } from '../lib/setup.js';
import { onboard } from '../lib/onboard.js';
import { getStatus, formatStatus } from '../lib/status.js';
import { handleError, RallyError } from '../lib/errors.js';
import { assertTools } from '../lib/tools.js';
import { cleanupLock } from '../lib/active.js';

// Release lock on abrupt termination to avoid stale lock files
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    cleanupLock();
    process.exit(128 + (sig === 'SIGINT' ? 2 : 15));
  });
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

const program = new Command();

program
  .name('rally')
  .description('Dispatch Squad teams to GitHub issues and PR reviews via git worktrees')
  .version(pkg.version);

program
  .command('setup')
  .description('Initialize Squad team state and Rally directories')
  .option('--dir <path>', 'Where to create external team state')
  .action(async (options) => {
    try {
      await setup(options);
    } catch (err) {
      handleError(err);
    }
  });

const onboardCmd = program
  .command('onboard')
  .description('Onboard a repo to Rally (local path, GitHub URL, or owner/repo)')
  .argument('[path]', 'Path, GitHub URL, or owner/repo (defaults to current directory)')
  .option('--team <name>', 'Use a named team (skips interactive prompt)')
  .option('--fork <owner/repo>', 'Set origin to your fork and upstream to the main repo')
  .hook('preAction', () => assertTools())
  .action(async (pathArg, opts) => {
    try {
      await onboard({ path: pathArg, team: opts.team, fork: opts.fork });
    } catch (err) {
      handleError(err);
    }
  });

onboardCmd
  .command('remove')
  .description('Remove an onboarded project from Rally')
  .argument('[project]', 'Project name to remove (interactive picker if omitted)')
  .option('--yes', 'Skip confirmation prompt')
  .action(async (project, opts) => {
    try {
      const { onboardRemove } = await import('../lib/onboard-remove.js');
      await onboardRemove({ project, yes: opts.yes });
    } catch (err) {
      handleError(err);
    }
  });

program
  .command('status')
  .description('Show Rally configuration and active dispatches for debugging')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    try {
      const { refreshDispatchStatuses } = await import('../lib/dispatch-refresh.js');
      refreshDispatchStatuses();
    } catch { /* best-effort refresh */ }
    try {
      const status = getStatus();
      if (opts.json) {
        console.log(JSON.stringify(status, null, 2));
      } else {
        console.log(formatStatus(status));
      }
    } catch (err) {
      handleError(err);
    }
  });

const dashboard = program
  .command('dashboard')
  .description('Show active dispatch dashboard')
  .option('--json', 'Output as JSON instead of interactive UI')
  .option('--project <name>', 'Filter by project (repo name)')
  .action(async (opts) => {
    try {
      if (opts.json) {
        const { getDashboardData } = await import('../lib/ui/dashboard-data.js');
        const data = getDashboardData({ project: opts.project });
        console.log(JSON.stringify(data, null, 2));
      } else if (!process.stdout.isTTY) {
        const { renderPlainDashboard } = await import('../lib/ui/dashboard-data.js');
        console.log(renderPlainDashboard({ project: opts.project }));
      } else {
        const React = await import('react');
        const { render } = await import('ink');
        const { default: Dashboard } = await import('../lib/ui/Dashboard.js');
        let attachDispatch = null;
        let pendingDispatch = null;
        let pendingAddProject = false;
        const onAttachSession = (dispatch) => { attachDispatch = dispatch; };
        const onDispatchItem = (item) => { pendingDispatch = item; };
        const onAddProject = () => { pendingAddProject = true; };
        const app = render(
          React.createElement(Dashboard, { project: opts.project, onAttachSession, onDispatchItem, onAddProject }),
          { fullScreen: true }
        );
        await app.waitUntilExit();
        if (pendingDispatch) {
          const { resolveRepo } = await import('../lib/dispatch.js');
          const { getSettings, getConfigDir } = await import('../lib/config.js');
          const settings = getSettings();
          const sandbox = settings.docker_sandbox === 'always' ? true : undefined;
          const trust = settings.require_trust === 'never' ? true : undefined;
          const resolved = resolveRepo({ repo: pendingDispatch.repo });
          if (pendingDispatch.type === 'issue') {
            const { dispatchIssue } = await import('../lib/dispatch-issue.js');
            const result = await dispatchIssue({
              issueNumber: pendingDispatch.number,
              repo: resolved.fullName,
              repoPath: resolved.project.path,
              sandbox,
              trust,
              denyToolsCopilot: settings.deny_tools_copilot,
              denyToolsSandbox: settings.deny_tools_sandbox,
              disallowTempDir: settings.disallow_temp_dir,
            });
            if (!result.aborted) {
              console.log(`Dispatched issue #${pendingDispatch.number}: ${result.issue.title} → ${result.worktreePath}`);
            }
          } else {
            const { dispatchPr } = await import('../lib/dispatch-pr.js');
            const promptFile = settings.review_template ? join(getConfigDir(), settings.review_template) : undefined;
            const result = await dispatchPr({
              prNumber: pendingDispatch.number,
              repo: resolved.fullName,
              repoPath: resolved.project.path,
              sandbox,
              trust,
              promptFile,
              denyToolsCopilot: settings.deny_tools_copilot,
              denyToolsSandbox: settings.deny_tools_sandbox,
              disallowTempDir: settings.disallow_temp_dir,
            });
            if (!result.aborted) {
              console.log(`Dispatched PR #${pendingDispatch.number}: ${result.pr.title} → ${result.worktreePath}`);
            }
          }
        } else if (pendingAddProject) {
          console.log('To add a project, run: rally onboard <path-or-url>');
        } else if (attachDispatch) {
          const { dispatchContinue } = await import('../lib/dispatch-continue.js');
          await dispatchContinue(attachDispatch.number, { repo: attachDispatch.repo });
        }
      }
    } catch (err) {
      handleError(err);
    }
  });

const dispatch = program
  .command('dispatch')
  .description('Dispatch Squad to a GitHub issue or PR')
  .hook('preAction', () => assertTools())
  .action(() => {
    console.log('Usage: rally dispatch <issue|pr|remove|continue|log|sessions> <number> [options]\n');
    console.log('Examples:');
    console.log('  rally dispatch issue 42          Dispatch to GitHub issue #42');
    console.log('  rally dispatch pr 15             Dispatch to GitHub PR #15');
    console.log('  rally dispatch remove 42         Remove dispatch for issue/PR #42');
    console.log('  rally dispatch continue 42       Reconnect to Copilot session for #42');
    console.log('  rally dispatch log 42            View Copilot output log for #42');
    console.log('  rally dispatch clean             Clean done dispatches');
    console.log('  rally dispatch sessions          List active dispatches with session info');
    console.log('  rally dispatch issue 42 --repo owner/repo');
    dispatch.help();
  });

dispatch
  .command('issue')
  .description('Dispatch Squad to a GitHub issue')
  .argument('[number]', 'GitHub issue number (interactive picker if omitted)', (v) => {
    const n = parseInt(v, 10);
    if (isNaN(n) || n <= 0) throw new Error('Must be a positive integer');
    return n;
  })
  .option('--repo <owner/repo>', 'Target repository (owner/repo)')
  .option('--repo-path <path>', 'Path to local repo clone')
  .option('--team-dir <path>', 'Path to custom squad directory')
  .option('--sandbox', 'Run Copilot inside a Docker sandbox microVM for host isolation')
  .option('--trust', 'Skip author/org trust warnings (for automation)')
  .action(async (number, opts) => {
    try {
      const { resolveRepo } = await import('../lib/dispatch.js');
      const { dispatchIssue } = await import('../lib/dispatch-issue.js');
      const { getSettings } = await import('../lib/config.js');
      const settings = getSettings();
      let resolved;
      if (!number) {
        const { pickRepo, pickIssue } = await import('../lib/picker.js');
        const project = opts.repo ? null : await pickRepo();
        if (!opts.repo && !project) return;
        const repo = opts.repo || project.repo;
        resolved = resolveRepo({ repo });
        number = await pickIssue(repo);
        if (!number) return;
      } else {
        resolved = resolveRepo({ repo: opts.repo });
      }
      const sandbox = opts.sandbox ? true : (settings.docker_sandbox === 'always' ? true : undefined);
      const trust = opts.trust ? true : (settings.require_trust === 'never' ? true : undefined);
      const result = await dispatchIssue({
        issueNumber: number,
        repo: resolved.fullName,
        repoPath: opts.repoPath || resolved.project.path,
        teamDir: opts.teamDir,
        sandbox,
        trust,
        denyToolsCopilot: settings.deny_tools_copilot,
        denyToolsSandbox: settings.deny_tools_sandbox,
        disallowTempDir: settings.disallow_temp_dir,
      });
      if (result.aborted) return;
      console.log(`Dispatched issue #${number}: ${result.issue.title} → ${result.worktreePath}`);
    } catch (err) {
      handleError(err);
    }
  });

dispatch
  .command('pr')
  .description('Dispatch Squad to a GitHub PR review')
  .argument('[number]', 'GitHub PR number (interactive picker if omitted)', (v) => {
    const n = parseInt(v, 10);
    if (isNaN(n) || n <= 0) throw new Error('Must be a positive integer');
    return n;
  })
  .option('--repo <owner/repo>', 'Target repository (owner/repo)')
  .option('--repo-path <path>', 'Path to local repo clone')
  .option('--team-dir <path>', 'Path to custom squad directory')
  .option('--sandbox', 'Run Copilot inside a Docker sandbox microVM for host isolation')
  .option('--prompt <path>', 'Path to a custom review prompt file')
  .option('--trust', 'Skip author/org trust warnings (for automation)')
  .action(async (number, opts) => {
    try {
      const { resolveRepo } = await import('../lib/dispatch.js');
      const { dispatchPr } = await import('../lib/dispatch-pr.js');
      const { getSettings, getConfigDir } = await import('../lib/config.js');
      const settings = getSettings();
      let resolved;
      if (!number) {
        const { pickRepo, pickPr } = await import('../lib/picker.js');
        const project = opts.repo ? null : await pickRepo();
        if (!opts.repo && !project) return;
        const repo = opts.repo || project.repo;
        resolved = resolveRepo({ repo });
        number = await pickPr(repo);
        if (!number) return;
      } else {
        resolved = resolveRepo({ repo: opts.repo });
      }
      const sandbox = opts.sandbox ? true : (settings.docker_sandbox === 'always' ? true : undefined);
      const trust = opts.trust ? true : (settings.require_trust === 'never' ? true : undefined);
      const promptFile = opts.prompt || (settings.review_template ? join(getConfigDir(), settings.review_template) : undefined);
      const result = await dispatchPr({
        prNumber: number,
        repo: resolved.fullName,
        repoPath: opts.repoPath || resolved.project.path,
        teamDir: opts.teamDir,
        sandbox,
        promptFile,
        trust,
        denyToolsCopilot: settings.deny_tools_copilot,
        denyToolsSandbox: settings.deny_tools_sandbox,
        disallowTempDir: settings.disallow_temp_dir,
      });
      if (result.aborted) return;
      console.log(`Dispatched PR #${number}: ${result.pr.title} → ${result.worktreePath}`);
      console.log(`Review output → ${result.worktreePath}/REVIEW.md`);
    } catch (err) {
      handleError(err);
    }
  });

dispatch
  .command('remove')
  .description('Remove an active dispatch')
  .argument('<number>', 'Issue or PR number', (v) => {
    const n = parseInt(v, 10);
    if (isNaN(n) || n <= 0) throw new Error('Must be a positive integer');
    return n;
  })
  .option('--repo <owner/repo>', 'Target repository (owner/repo)')
  .action(async (number, opts) => {
    try {
      const { dispatchRemove } = await import('../lib/dispatch-remove.js');
      await dispatchRemove(number, { repo: opts.repo });
    } catch (err) {
      handleError(err);
    }
  });

dispatch
  .command('refresh')
  .description('Refresh dispatch statuses by checking if Copilot processes have exited')
  .action(async () => {
    try {
      const { refreshDispatchStatuses } = await import('../lib/dispatch-refresh.js');
      const updated = refreshDispatchStatuses();
      if (updated.length === 0) {
        console.log('All dispatch statuses are up to date.');
      } else {
        for (const d of updated) {
          console.log(`Updated ${d.id}: → done`);
        }
        console.log(`${updated.length} dispatch(es) updated.`);
      }
    } catch (err) {
      handleError(err);
    }
  });

dispatch
  .command('log')
  .description('View Copilot output log for a dispatch')
  .argument('<number>', 'Issue or PR number', (v) => {
    const n = parseInt(v, 10);
    if (isNaN(n) || n <= 0) throw new Error('Must be a positive integer');
    return n;
  })
  .option('--repo <owner/repo>', 'Target repository (owner/repo)')
  .option('-f, --follow', 'Follow log output (tail -f style)')
  .action(async (number, opts) => {
    try {
      const { dispatchLog } = await import('../lib/dispatch-log.js');
      await dispatchLog(number, { repo: opts.repo, follow: opts.follow });
    } catch (err) {
      handleError(err);
    }
  });

dispatch
  .command('clean')
  .description('Clean done dispatches (remove worktrees and branches)')
  .option('--all', 'Clean all dispatches, not just done ones')
  .option('--yes', 'Skip confirmation prompt for --all')
  .action(async (opts) => {
    try {
      const { dispatchClean } = await import('../lib/dispatch-clean.js');
      await dispatchClean({ all: opts.all, yes: opts.yes });
    } catch (err) {
      handleError(err);
    }
  });

dispatch
  .command('continue')
  .description('Reconnect to Copilot session for an active dispatch')
  .argument('<number>', 'Issue or PR number', (v) => {
    const n = parseInt(v, 10);
    if (isNaN(n) || n <= 0) throw new Error('Must be a positive integer');
    return n;
  })
  .option('--repo <owner/repo>', 'Target repository (owner/repo)')
  .option('-m, --message <text>', 'Additional instructions for Copilot on reconnect')
  .action(async (number, opts) => {
    try {
      const { dispatchContinue } = await import('../lib/dispatch-continue.js');
      await dispatchContinue(number, { repo: opts.repo, message: opts.message });
    } catch (err) {
      handleError(err);
    }
  });

dispatch
  .command('sessions')
  .description('List active dispatches with session info')
  .action(async () => {
    try {
      const { refreshDispatchStatuses } = await import('../lib/dispatch-refresh.js');
      refreshDispatchStatuses();
    } catch { /* best-effort refresh */ }
    try {
      const { listDispatchSessions, formatDispatchSessions } = await import('../lib/dispatch-sessions.js');
      const sessions = listDispatchSessions();
      console.log(formatDispatchSessions(sessions));
    } catch (err) {
      handleError(err);
    }
  });

try {
  program.parse();
} catch (err) {
  if (err instanceof RallyError) {
    console.error(`Error: ${err.message}`);
    process.exit(err.exitCode);
  }
  throw err;
}
