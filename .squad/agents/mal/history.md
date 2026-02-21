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
