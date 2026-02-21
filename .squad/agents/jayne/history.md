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
- Decision filed: hand-rolled YAML parser needed (zero-dependency constraint)
- See `.squad/decisions.md` → "Decision: Config file format changed from JSON to YAML"
