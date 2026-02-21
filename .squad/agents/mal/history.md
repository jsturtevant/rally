# Project Context

- **Owner:** James Sturtevant
- **Project:** Dispatcher — a CLI tool that dispatches Squad teams to GitHub issues and PR reviews via git worktrees
- **Stack:** Node.js (zero dependencies, node:test)
- **Created:** 2026-02-21

## Project Description

Dispatcher is a command line tool that works with Squad. Key commands:
- **setup** — Sets up Squad outside of a repo
- **onboard** — Onboards a new team to a repo without committing the files
- **dispatch** — Takes a GitHub issue, creates a worktree, adds the Squad, has them plan, iterate, add tests, and do code reviews
- **PR review** — Similar dispatch flow for PR reviews
- **dashboard** — Shows all active projects with worktrees and active teams

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### 2026-02-21 — PRD Draft

- **PRD location:** `docs/PRD.md` — comprehensive, covers all 5 commands with CLI examples, error cases, state layout, and open questions.
- **Architecture decision:** Three JSON config files under `~/.dispatcher/` — `config.json` (global setup), `projects.json` (onboarded repos), `active.json` (active dispatches). Simple, zero-dep, file-based state.
- **Module structure:** `bin/dispatcher.js` entry point + `lib/` modules per command + shared utilities (`config.js`, `symlink.js`, `exclude.js`, `worktree.js`, `github.js`, `ui.js`).
- **Core pattern:** Tamir Dresher's symlink + `.git/info/exclude` technique is the foundation of `onboard`. Exclude entries apply to all worktrees — set up once.
- **Worktree convention:** `.worktrees/dispatcher-<issue>/` inside the repo. Branch naming: `dispatcher/<issue>-<slug>`.
- **Open questions logged in PRD §8:** Squad invocation method, per-project vs shared team, worktree location, Windows symlink fallback, Squad export/import integration.
- **User preference:** James wants zero dependencies, `node:test`, Windows/macOS/Linux support — same constraints as Squad itself.

### 2026-02-21 — PRD Target User & CI/CD Corrections

- **Target users (from James):** Individual developers using Squad on projects where the rest of the team doesn't use Squad. Examples: open source projects, large shared repos where committing `.squad/` isn't appropriate. This is NOT for teams adopting Squad together — it's for one person using Squad on a shared repo.
- **No CI/CD (from James):** There will be no CI/CD integration for Dispatcher. No GitHub Actions triggers, no pipeline integration. Removed from PRD §2 and §6.

### 2026-02-21 22:47 — Config format: YAML not JSON (completed)
- Updated `docs/PRD.md` to use YAML for all config files
- Filed decision on hand-rolled YAML parser requirement
- All agents notified via history propagation

### 2026-02-22 — Onboard Command Expansion (§3.2)

- **GitHub URL support:** `dispatcher onboard` now accepts `https://github.com/owner/repo` or `owner/repo` shorthand. Clones into configurable `projectsDir` (default: `~/.dispatcher/projects/`).
- **Configurable projects directory:** New `projectsDir` key in `config.yaml`. Set during `dispatcher setup`.
- **Team selection prompt:** At onboard time, user chooses shared team (`~/.dispatcher/team/`) or project-specific team (`~/.dispatcher/teams/<project>/`). Scriptable with `--team <shared|new>`.
- **projects.yaml expanded:** Each project entry now includes `team` (shared/project) and `teamDir` (absolute path to the team directory used).
- **State layout expanded:** `~/.dispatcher/` now includes `teams/` (project-specific team dirs) and `projects/` (cloned repos).
- **§8.2 partially resolved:** Shared vs. per-project team is now a user choice at onboard time. Migration between team types and overlay approach remain open.
- **§6 Non-Goals #5 updated:** Reflects that basic multi-team support (shared vs project-specific) now exists; advanced configurations remain out of scope.

### 2026-02-22 — Dispatch Subcommand Restructure

- **Subcommands replace flags:** `dispatcher dispatch issue <number>` and `dispatcher dispatch pr <number>` replace `dispatcher dispatch <number>` and `dispatcher dispatch --pr <number>`. Explicit subcommands make the CLI self-documenting and avoid ambiguity.
- **`--repo <owner/repo>` flag:** Both subcommands accept an optional `--repo <owner/repo>` flag. If omitted, the repo is inferred from cwd (if inside an onboarded project), from `projects.yaml` (if only one project), or errors with a helpful message if ambiguous.
- **Sections updated:** §3.3, §3.4, §4.2 Data Flow, Appendix A Command Summary — all now reflect the new syntax.

---

## Orchestration Notes (2026-02-21T22:51)

- Scribe merged both Mal decisions into `.squad/decisions.md`
- Created orchestration log and session log
- Updated implementation agents (Kaylee, Wash, Jayne) with cross-agent context
- All squad/ changes committed
