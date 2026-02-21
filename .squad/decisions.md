# Decisions

Team decisions that affect how we work. All agents read this before starting work.

<!-- Scribe merges entries from .squad/decisions/inbox/ into this file. -->

---

## Decision: PRD Draft — Architecture & State Management

**By:** Mal (Lead)  
**Date:** 2026-02-21  
**Status:** Proposed

### Decision

Drafted the initial PRD (`docs/PRD.md`) establishing:

1. **Three-file state model** under `~/.dispatcher/`: `config.yaml`, `projects.yaml`, `active.yaml`. File-based, zero dependencies, human-readable, YAML format.
2. **Symlink + exclude as the core pattern.** `onboard` creates symlinks and writes `.git/info/exclude`. This is the foundational technique — everything else builds on it.
3. **Worktrees inside the repo** at `.worktrees/dispatcher-<N>/` with `dispatcher/<N>-<slug>` branch naming.
4. **Module-per-command structure** in `lib/` with shared utilities.

**Update (2026-02-21 22:47):** Config file format changed from JSON to YAML per user directive. See Decision: Config file format changed from JSON to YAML below.

### Open Questions (need team input)

- How does Dispatcher invoke Squad after worktree setup? (Option A: just set up + print instructions, Option B: invoke Squad CLI, Option C: open VS Code)
- Per-project vs. shared team state?
- Windows symlink fallback strategy?

### Impact

All agents should read `docs/PRD.md` before implementing any command. It has CLI specs, error cases, and state formats.

---

## Decision: PRD Target Users & No CI/CD

**By:** Mal (Lead)  
**Date:** 2026-02-21  
**Status:** Accepted

### Decision

Updated `docs/PRD.md` §2 (Target Users) and removed all CI/CD references per user directive:

1. **Target users are individual developers on shared repos.** Not teams adopting Squad together — it's one person using Squad where the rest of the team doesn't. Examples: open source projects, large repos where committing `.squad/` isn't appropriate.

2. **No CI/CD integration.** Dispatcher will not integrate with GitHub Actions, CI pipelines, or any automated triggers. Removed the "Secondary: CI/CD pipelines" section and all related mentions.

### Impact

All agents must treat these as hard constraints:
- Don't design features assuming CI/CD triggers or pipeline integration
- Target the solo-developer-on-shared-repo use case, not team adoption
- Reference the updated PRD before implementing any command

---

## Decision: Config file format changed from JSON to YAML

**By:** Mal (Lead)  
**Date:** 2026-02-21  
**Status:** Accepted

### Context

User directive received: use YAML for config files instead of JSON.

### Decision

All three config files now use `.yaml` extension and YAML syntax in PRD:
- `~/.dispatcher/config.yaml` (was config.json)
- `~/.dispatcher/projects.yaml` (was projects.json)
- `~/.dispatcher/active.yaml` (was active.json)

### Rationale

YAML is more human-readable for config files, especially ones users may hand-edit.

### Key Consideration: Hand-rolled YAML Parser

**Node.js has no built-in YAML parser.** This is a zero-dependency project. The `config.js` module will need a hand-rolled YAML parser and serializer. Our config structures are simple (flat keys, one-level arrays of objects), so a minimal parser covering only what we use is practical and keeps us zero-dependency.

If config complexity grows in future, revisit this decision.

### Scope

- `docs/PRD.md` only — all config references and code examples updated to YAML syntax
- `package.json` and Squad export files (`.json`) remain unchanged per deliberate choice

---

## Decision: Onboard Command Expansion — GitHub URLs, Projects Dir, Team Selection

**By:** Mal (Lead)  
**Date:** 2026-02-22  
**Status:** Proposed

### Context

User requested expanding `dispatcher onboard` (§3.2) to support GitHub URLs, configurable clone targets, and a shared-vs-project-specific team prompt.

### Decisions

1. **`dispatcher onboard` accepts GitHub URLs.** Full URLs (`https://github.com/owner/repo`) and shorthands (`owner/repo`) are supported. The repo is cloned into `projectsDir` before onboarding.

2. **Configurable projects directory.** New `projectsDir` key in `config.yaml` (default: `~/.dispatcher/projects/`). Created during `dispatcher setup`.

3. **Team selection prompt at onboard time.** User picks "Existing team" (shared, `~/.dispatcher/team/`) or "New team" (project-specific, `~/.dispatcher/teams/<project>/`). Scriptable via `--team <shared|new>` flag.

4. **projects.yaml tracks team type.** Each entry now has `team` (shared/project) and `teamDir` fields so downstream commands (`dispatch`, `dashboard`) know where to find the team.

5. **State layout expanded.** `~/.dispatcher/` gains `teams/` (project-specific team directories) and `projects/` (cloned repos).

6. **§8.2 partially resolved.** The "per-project vs shared team" open question is now answered for v1: users choose at onboard time. Remaining open: migration between team types, team overlays/layering.

### Impact

- `lib/onboard.js` needs URL detection, `git clone` integration, interactive prompt, and project-specific team init logic.
- `lib/config.js` parser must handle the new `projectsDir` key.
- `lib/setup.js` should create the `projects/` directory.
- All agents should re-read `docs/PRD.md` §3.2, §4.1, and §8.2 before implementing.

---

## Decision: Dispatch uses explicit subcommands (`issue`, `pr`) instead of flags

**By:** Mal (Lead)  
**Date:** 2026-02-22  
**Status:** Accepted  
**Requested by:** James Sturtevant

### Context

The original dispatch syntax used positional args and flags to distinguish modes:
- `dispatcher dispatch <issue-number>` — issue mode (implicit)
- `dispatcher dispatch --pr <pr-number>` — PR review mode (flag-based)

This was asymmetric and made the CLI harder to parse at a glance.

### Decision

Use explicit subcommands:
- `dispatcher dispatch issue <issue-number> [--repo <owner/repo>]`
- `dispatcher dispatch pr <pr-number> [--repo <owner/repo>]`

Both subcommands accept `--repo <owner/repo>` to specify the target repo. If omitted, Dispatcher infers:
1. From the current directory (if inside an onboarded project)
2. From `projects.yaml` (if exactly one project is onboarded)
3. Error with: `✗ Multiple projects onboarded. Specify with --repo owner/repo`

### Rationale

- Subcommands are self-documenting — `dispatcher dispatch issue 42` reads as a sentence
- Symmetric structure for both modes
- `--repo` uses `owner/repo` format (matching GitHub conventions) instead of a local path

### Impact

- `docs/PRD.md` §3.3, §3.4, §4.2, Appendix A updated
- `lib/dispatch.js` will need subcommand routing in `bin/dispatcher.js`
- All agents should use the new syntax in examples and implementations
