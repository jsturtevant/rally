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

### 2026-02-21 — PRD Draft & Architecture

- **All implementation begins with** `docs/PRD.md` — comprehensive spec covering 5 commands with CLI specs, error cases, state models, and open questions.
- **State model:** Three JSON files under `~/.dispatcher/` — `config.json`, `projects.json`, `active.json`. Simple, zero-dep, file-based.
- **Core technique:** Symlink + `.git/info/exclude` (from Tamir Dresher's pattern). Foundation for `onboard` command.
- **Worktree location:** `.worktrees/dispatcher-<N>/` with branch naming `dispatcher/<N>-<slug>`.
- **Module structure:** `bin/dispatcher.js` entry + `lib/` modules per command + shared utilities.
- **Key decisions:** Three-file state, worktrees inside repo, module-per-command. Open questions logged in PRD §8.
- **Target user clarification (2026-02-21):** Solo developers on shared/OSS repos, NOT teams adopting Squad together. Individual using Squad where rest of team doesn't — e.g., open source projects or large shared repos where committing `.squad/` is inappropriate.
- **No CI/CD for Dispatcher (2026-02-21):** Zero CI/CD integration. No GitHub Actions, no pipeline triggers, no automated invocation. This is a manual CLI tool.


### 2026-02-21 22:47 — Config format: YAML not JSON
- User directive: all Dispatcher config files use YAML, not JSON
- See `.squad/decisions.md` → "Decision: Config file format changed from JSON to YAML"

### 2026-02-22 — Onboard Expansion (§3.2) & Dispatch Subcommands (§3.3–3.4)

**From Mal (Lead):**
- **Onboard expansion:** Now accepts GitHub URLs (`https://github.com/owner/repo` or `owner/repo`), clones into configurable `projectsDir` (default: `~/.dispatcher/projects/`). User selects team type at onboard: shared (`~/.dispatcher/team/`) or project-specific (`~/.dispatcher/teams/<project>/`). Flag: `--team <shared|new>`. `projects.yaml` schema expanded to track `team` and `teamDir`.
- **Dispatch subcommands:** Explicit subcommands `dispatcher dispatch issue <number>` and `dispatcher dispatch pr <number>` (was implicit + `--pr` flag). Both accept `--repo <owner/repo>` with fallback inference logic. Sections §3.3, §3.4, §4.2 updated in PRD.
- **State layout:** `~/.dispatcher/` gains `teams/` (project-specific) and `projects/` (cloned repos).
- **See:** `.squad/decisions.md` → "Onboard Command Expansion" and "Dispatch uses explicit subcommands"

**What this means for you:**
- Review `docs/PRD.md` §3.2, §3.3, §3.4, §4.1, §4.2 before implementing
- `lib/setup.js` must create `projectsDir` (default: `~/.dispatcher/projects/`) and `teams/` directory
- `lib/config.js` must handle new `projectsDir` key in YAML config
