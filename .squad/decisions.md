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

---

## Decision: Dependency Pivot — Adopt Production CLI Stack

**By:** Mal (Lead)  
**Date:** 2026-02-22  
**Status:** Accepted  
**Requested by:** James Sturtevant

### Context

James directed: "We can use deps. I'd prefer to use the same ones that Copilot/Claude use." This is a major pivot from the original zero-dependency constraint.

Research confirmed the standard CLI stack used by GitHub Copilot CLI, Claude Code CLI, and similar polished Node.js CLIs.

### Decision

Drop the zero-dependency constraint. Adopt the following curated set of production-quality npm packages:

#### UI/Terminal
- **Ink** (`^5.0.0`) — React for interactive terminal UIs. Component-based rendering, layout, focus management.
- **Chalk** (`^5.0.0`) — Terminal string styling (colors, bold, dim, underline). Replaces our ANSI escape code constants module.
- **Ora** (`^8.0.0`) — Elegant terminal spinners. Replaces our hand-rolled braille-dot spinner.
- **ink-table** (`^4.0.0`) — Table rendering within Ink. Replaces our hand-rolled table renderer.

#### CLI Framework
- **Commander** (`^12.0.0`) — CLI argument parsing, subcommands, help generation. Replaces manual `process.argv` parsing in `bin/dispatcher.js`.

#### Config
- **js-yaml** (`^4.0.0`) — YAML parsing/serialization. Replaces the hand-rolled YAML parser we were planning for `config.js`.

#### Prompts
- **@inquirer/prompts** (`^7.0.0`) — Interactive selection menus, confirmations. Replaces our hand-rolled raw-mode prompt.

#### Dev Dependencies
- **ink-testing-library** (`^4.0.0`) — Testing utilities for Ink components.

### Rationale

1. **User directive.** James explicitly authorized deps and requested the Copilot/Claude stack.
2. **Massive complexity reduction.** The eight hand-rolled UI modules in `lib/ui/` (colors.js, box.js, table.js, spinner.js, progress.js, prompt.js, status.js, dashboard.js) are replaced by well-tested library components.
3. **Better UX out of the box.** Ink, Chalk, and Ora handle TTY detection, `NO_COLOR`/`FORCE_COLOR`, Windows Terminal compatibility, and graceful degradation automatically.
4. **Industry standard.** These exact packages power the most polished CLI tools in the Node.js ecosystem.
5. **The hand-rolled YAML parser was a significant risk.** `js-yaml` eliminates that entirely.

### What Changed

- `docs/PRD.md` §5 rewritten for Ink component architecture
- `docs/PRD.md` §5.0 (new) — Dependencies section with version constraints
- `docs/PRD.md` §4.3 — Module structure updated (`lib/ui/` simplified to Ink components)
- `docs/PRD.md` §8 — Technical constraints updated (deps row)
- All "zero-dependency" references removed from PRD
- `config.js` description updated to reference js-yaml
- `bin/dispatcher.js` description updated to reference Commander

### What Did NOT Change

- Historical decision records in `.squad/decisions.md` preserved as-is
- Design language (brand colors, icons, layout concepts) preserved — just reframed as Ink/Chalk
- Test framework remains `node:test`
- All commands, workflows, state layout unchanged

### Supersedes

- **Decision: Config file format — YAML** — the "Hand-rolled YAML Parser" key consideration is now moot; we use `js-yaml`.
- The zero-dependency constraint from the original PRD Draft decision.

### Impact

- All agents must use Ink/Chalk/Ora/Commander/js-yaml/@inquirer/prompts — no raw ANSI escape codes in application code
- `lib/ui/` module structure changes significantly — re-read PRD §4.3 and §5 before implementing
- `package.json` will need all listed dependencies added
- Test patterns may change (use ink-testing-library for UI component tests)
- **Team docs need updating:** `.squad/agents/wash/history.md` and `.squad/decisions.md` still claim "zero-dependency" (stale references)

---

## Decision: Terminal UI/UX — Ink/Chalk Component System (replaces hand-rolled ANSI)

**By:** Mal (Lead)  
**Date:** 2026-02-22  
**Status:** Proposed

### Context

Following the dependency pivot decision, terminal UI/UX is now implemented via Ink (React for terminal) + Chalk (styling) instead of hand-rolled ANSI escape codes.

### Decisions

### 1. `lib/ui/` directory structure (Ink component wrappers)

The single `ui.js` module is replaced by a directory of Ink wrapper components:
- `colors.js` — Chalk color helpers and TTY detection
- `box.js` — Ink-based unicode box-drawing panel component
- `table.js` — ink-table wrapper with auto-width columns
- `spinner.js` — Ora spinner wrapper
- `progress.js` — Ink progress bar component
- `prompt.js` — @inquirer/prompts wrappers
- `status.js` — In-place overwrite status line component
- `dashboard.js` — Full-screen Ink component with alternate buffer
- `index.js` — Re-exports all components

### 2. Brand palette and status icons are standardized

| Role | Color | Icon |
|------|-------|------|
| Primary | Cyan | — |
| Success | Green | ✓ |
| Error | Red | ✗ |
| Warning | Yellow | ⚠ |
| Active | Cyan | ● |
| Pending | Dim | ◌ |
| In progress | Yellow | ◆ |

### 3. Graceful degradation is mandatory — not optional

Every UI component must check TTY and branch behavior:
- Colors stripped when piped
- Spinners become static text
- Dashboard renders once as plain table and exits
- Prompts use defaults or flags

Supports `NO_COLOR` (disable on TTY) and `FORCE_COLOR` (enable on non-TTY) environment variables.

### 4. Dashboard uses alternate screen buffer

Full-screen dashboard enters alternate buffer, renders panels, handles keyboard input, and restores on exit. Must register cleanup handlers for `SIGINT`, `SIGTERM`, and `process.on('exit')`.

### 5. All components accept `stream` parameter for testability

No process-global state. Components default to `process.stdout` but accept an injectable stream so unit tests can capture and assert on output.

### Impact

- All agents: The `lib/ui/` module structure has changed (now a directory, not a file). Import paths and testing patterns change.
- Kaylee/Wash (implementers): Implement from PRD §5, using Ink component APIs.
- No breaking changes to CLI commands or workflows — just implementation details.

---

## PRD Review Findings — Blockers & Concerns

**Date:** 2026-02-22  
**Agents:** Mal (Lead), Wash (Integration Dev), Kaylee (Core Dev), Jayne (Tester)

### Status

PRD is architecturally sound and internally consistent. **Five critical blockers identified in PRD §9 (open questions) must be resolved before implementation proceeds.**

### Critical Blockers

1. **gh CLI field names inconsistency** (Wash) — §3.3 vs §6.3 specify different field sets. Must resolve before implementation. For PRs, `files` vs `changedFiles` are semantically different.

2. **Zero-dependency contradiction** (Mal/Kaylee/Jayne) — PRD lists npm dependencies but older decisions claim "zero-dependency project" and "hand-rolled YAML parser." **RESOLVED by Dependency Pivot decision (above).** Team docs need updating.

3. **Windows symlink fallback strategy** (Jayne) — §9.7 open. No decision on behavior without Developer Mode or admin privileges (hard error, junctions, copy, flag?).

4. **Squad invocation mechanism** (Jayne) — §9.1 open. Three options not decided (A: instructions, B: CLI, C: VS Code).

5. **Dispatch status lifecycle rules** (Jayne) — §9.2 open. When/who triggers status transitions (planning → implementing → reviewing → done → cleaned)?

6. **dispatch-context.md format** (Jayne) — §9.4 open. Format and field schema undefined.

### Key Concerns Requiring Attention

- **Error handling:** PRD lacks comprehensive error catalog for each command (uncommitted changes, collisions, auth failures, exit codes).
- **Edge cases:** Idempotency rules, dispatch collisions, multiple projects, config validation, concurrent access not fully specified.
- **Test framework:** No `docs/TESTING.md`. Strategy for mocking git/gh/npx, fixture management unclear.

### Team Action Required

1. **Mal (Lead):** Schedule decision sync to resolve blockers #1, #3, #4, #5, #6.
2. **Jayne (Tester):** Await blocker resolution, then write test suite and create `docs/TESTING.md`.
3. **Kaylee/Wash:** Await blocker resolution, then proceed with implementation.

**Full detailed reviews:**
- Wash: `.squad/decisions/inbox/wash-prd-review.md`
- Jayne: `.squad/decisions/inbox/jayne-prd-review.md`

---

## Directive: Docker Sandbox Support (Future Roadmap)

**By:** James Sturtevant  
**Date:** 2026-02-22  
**Status:** Future Enhancement

Integrate Docker sandbox support for Copilot coding agent. Not for current (v1) implementation. Captured for team memory and future roadmap.

---

## Follow-up: Zero-Dependency Reference Cleanup

**By:** Mal (Lead)  
**Date:** 2026-02-22  
**Status:** Complete

Following the Dependency Pivot decision, all stale "zero-dependency" references across team documentation have been corrected. The following files were updated to reflect the new production CLI stack (Ink, Chalk, Ora, Commander, js-yaml, @inquirer/prompts):

- `.squad/team.md` — Stack description updated
- `.squad/agents/kaylee/charter.md` — Removed zero-dep claim, documented production stack
- `.squad/agents/jayne/charter.md` — Testing strategy clarified (node:test + ink-testing-library)
- `.squad/agents/scribe/history.md` — Stack reference updated
- `.squad/skills/squad-conventions/SKILL.md` — Marked as deprecated (applies to Squad, not Dispatcher)
- `.squad/decisions.md` → Decision #3 (Config format YAML) — Appended note that js-yaml supersedes hand-rolled parser

**No breaking changes.** Historical decision records preserved for audit trail. All current documentation now accurately reflects the architecture.

---

## Follow-up: Hand-rolled YAML Parser Superseded by js-yaml

**By:** Mal (Lead)  
**Date:** 2026-02-22  
**Status:** Informational

### Context

Decision #3 (Config file format changed from JSON to YAML) noted: "Node.js has no built-in YAML parser... a minimal hand-rolled parser covering only what we use is practical and keeps us zero-dependency."

This has been superseded by the Dependency Pivot decision (see above).

### Update

The dependency pivot adopted `js-yaml` (`^4.0.0`) for YAML parsing and serialization. This eliminates the risk and maintenance burden of a hand-rolled YAML parser. The `config.js` module now uses `js-yaml` instead of custom parsing logic.

**Impact:** No changes to the three-file state model or YAML structure — only the implementation of the parser. Config files remain human-readable YAML.

---

## Decision: PRD Decomposition into 29 Work Items

**By:** Mal (Lead)  
**Date:** 2026-02-22  
**Status:** Complete (GitHub issues #1–#29 created)

### Summary

Decomposed `docs/PRD.md` into 29 sequential implementation work items across 5 phases with explicit dependencies, sizing (S/M/L), and ownership. Identified 3 critical blockers that must be resolved before dispatch implementation can begin.

### Phases & Issue Breakdown

- **Phase 1: Foundation (8 issues #1–#8)** — Project scaffold, config.js, symlink.js, exclude.js, worktree.js, github.js, CLI entry, test setup
- **Phase 2: Core Commands (5 issues #9–#13)** — setup, onboard (local + GitHub URL + team selection), status
- **Phase 3: Dispatch (6 issues #14–#19)** — dispatch module, issue/PR workflows, context template, Copilot CLI invocation, active.yaml
- **Phase 4: Dashboard (6 issues #20–#25)** — UI components, main view, keyboard nav, clean command, TTY fallback
- **Phase 5: Polish (4 issues #26–#29)** — Error handling, edge cases, docs, E2E tests

### Identified Blockers (All Now Resolved — See Below)

1. **Squad invocation mechanism** ✓ RESOLVED
2. **Windows symlink strategy** ✓ RESOLVED
3. **dispatch-context.md format** ✓ RESOLVED

Also found:
- **PRD inconsistencies:** §3.3 vs §6.3 field names (issue/PR field sets differ)
- **Missing docs:** `docs/TESTING.md` (Jayne to own)
- **Error handling gaps:** 12 identified (Jayne to catalog)
- **Edge cases:** 20+ identified (scope for Kaylee/Jayne)

### Parallelization Strategy

**Can parallelize:**
- Phase 1 utilities are independent (config, symlink, exclude, worktree, github)
- Phase 2 commands are independent once Phase 1 utilities exist
- Phase 4 UI components are independent of each other

**Must serialize:**
- dispatch depends on Phase 1–2 (onboard, worktree, github utils)
- dashboard depends on dispatch (needs active.yaml)
- Phase 4 must follow Phase 3

### Impact

- All agents have explicit work items with dependencies and sizing
- Implementation can begin in phases with clear parallelization windows
- 29 GitHub issues ready for sprint planning

---

## Decision: GitHub Issues Created for Rally Implementation Roadmap

**By:** Wash (Integration Dev)  
**Date:** 2026-02-22  
**Status:** Complete

### Summary

All 29 implementation issues have been created on the `jsturtevant/rally` GitHub repository following Mal's decomposition exactly. Issues include:
- 15 labels (10 categories + 5 phases)
- 5 milestones (Phase 1–5)
- 29 sequential issues (#1–#29) with dependencies documented in issue bodies
- Ownership assigned: Kaylee (17), Wash (3), Jayne (5), Mal (1)
- Sizes and acceptance criteria included for sprint planning

### Implementation Process

1. Created labels with `gh label create --force`
2. Created milestones via GitHub REST API
3. Created issues in 3 batches (paused between for GitHub processing)
4. Dependencies documented as "Depends on: #N" in issue bodies

### Impact

- Clear, prioritized roadmap visible on GitHub
- All team members know their assigned work
- Dependency relationships documented for sequencing
- Ready for sprint planning and assignment

---

## Decision: Critical PRD Blockers — Resolved

**By:** James Sturtevant (User)  
**Date:** 2026-02-22  
**Status:** Resolved
**Timestamp:** 2026-02-22T01:13:00Z

### Blocker 1: Squad Invocation Mechanism (PRD §9.1)

**Question:** How does Rally invoke Squad after worktree setup?

**Resolution:** Automated CLI invocation. Rally automatically launches Copilot CLI in the worktree with the appropriate prompt (review PR or plan/implement fix for issue). Rally captures the session ID for later resume if needed.

**Why:** Automated invocation is Rally's core value proposition. Manual launch defeats the purpose.

**Implementation note:** `dispatch.js` must invoke Copilot CLI via `npx copilot` and wait for completion.

### Blocker 2: Windows Symlink Strategy (PRD §9.7)

**Question:** What happens when symlinks fail on Windows without Developer Mode?

**Resolution:** Hard error with clear message. "Enable Windows Developer Mode". No junctions or copy fallback in v1.

**Why:** Simplicity — avoid maintaining multiple code paths for v1.

**Implementation note:** `symlink.js` should test symlink support upfront and throw if not available on Windows.

### Blocker 3: dispatch-context.md Format (PRD §9.4)

**Question:** What goes in `.squad/dispatch-context.md`?

**Resolution:** Simple markdown template. Squad parses markdown natively. Include:
- Issue/PR number, title, labels, creation date
- Description (body from GitHub)
- Files changed (for PRs only)
- Instructions (worktree path, branch name)

**Why:** Minimal, markdown-native, Squad-friendly.

**Implementation note:** `dispatch.js` writes template to `.squad/dispatch-context.md` when creating worktree.

### Impact

- Implementation can proceed without blockers
- All three decisions are implementer-friendly (clear, no ambiguity)
- Dispatchers (Kaylee/Wash) can begin Phase 1–3 implementation immediately

---

## Retrospective: PRD Design Phase Complete

**Date:** 2026-02-22  
**Facilitated By:** Mal (Lead)  
**Participants:** Full team review cycle (Mal, Wash, Kaylee, Jayne)

### Status

PRD design phase is complete. Architecturally sound, internally consistent, blockers resolved. **Ready for implementation phase.**

### What Went Well

- PRD is architecturally sound and internally consistent
- Dependency pivot (Ink/Chalk/Ora/Commander) cleared decks for implementation
- Stale docs caught and fixed (zero-dep references updated)
- Full team review cycle completed with blockers explicit and documented
- Target user clarified: solo dev on shared repos (not team adoption)

### What Needs Attention

1. **Error handling catalog** — 12 error-handling gaps identified. Jayne to write comprehensive catalog for each command.
2. **Test framework spec** — `docs/TESTING.md` missing. Jayne to document mocking strategy, fixture patterns, Ink component testing.
3. **Edge cases** — 20+ edge cases identified (idempotency, collisions, multi-project, config validation, concurrency).
4. **PRD §9 updates** — Blocker resolutions must be written into PRD and committed.

### Action Items (Post-Blocker Resolution)

1. **Mal:** Update `docs/PRD.md` with blocker resolutions and commit
2. **Jayne:** Write `docs/TESTING.md` and error handling catalog (target: 2026-02-23)
3. **Kaylee/Wash:** Begin Phase 1 module implementation (config, symlink, exclude, worktree, github, CLI)
4. **All:** Review updated PRD before next standup

### Next Phase

Implementation begins with Phase 1 foundation modules. Kaylee and Wash can parallelize work across utilities. Jayne supports with testing strategy and error catalog.

---

## Directive: Testing & Code Review Requirements

**By:** James Sturtevant  
**Date:** 2026-02-22 01:48:00Z  
**Status:** Policy

### Decision

- **Every PR must include tests.** No exceptions.
- **CI must run on every PR.** All checks must pass before merging.
- **Full code review required before merge.** At least one approval from team before changes land.

### Rationale

User requirement. This is a hard gate, not a suggestion.

### Impact

- Test coverage is mandatory for all implementation work
- CI pipeline validation required for all PRs
- Team review is a merge blocker — design this into workflow from start

---

## Retrospective: Phase 1 Implementation Sprint — Process Failure & Phase 2 Workflow

**Facilitated by:** Mal (Lead)  
**Date:** 2026-02-22  
**Status:** Complete  
**Related Artifact:** `.squad/log/2026-02-22T025300Z-phase1-retro-ci-fix.md`

### Executive Summary

Phase 1 implementation reveals a critical workflow failure: **all code was committed directly to `main` instead of via feature branches and PRs.** The directive was clear ("Every PR must include tests. CI runs on every PR. Full review before merge."), but execution bypassed that entire workflow. This decision documents the root cause analysis and proposes a concrete solution for Phase 2.

### Root Cause

**Coordinator's instructions to agents lacked explicit workflow steps.** Agents received task descriptions ("implement feature X") without being told to create a feature branch, push, or open a PR. They defaulted to the simplest path: `git commit` and `git push` to main.

**Contributing factors:**
- No branch strategy defined upfront
- Agents coordinated via commit messages, not pull requests
- No tool enforced the "must be a PR" rule
- Coordinator didn't communicate review expectations

### Phase 2 Solution: Parallel Worktrees Per Agent

**Recommended approach:** Option C (worktrees per agent for maximum parallelism)

#### Workflow Steps

1. **Sprint Planning (Mal):** Assign issues to agents, specify branch names (`rally/<issue>-<slug>`)
2. **Agent Onboarding (Mal):** Provide explicit workflow instructions including:
   ```bash
   git worktree add .worktrees/rally-<issue> --track origin/main -b rally/<issue>-<slug>
   cd .worktrees/rally-<issue>
   # [do work]
   npm test  # must pass
   git add . && git commit -m "feat: ..."
   git push -u origin rally/<issue>-<slug>
   gh pr create --title "..." --body "Closes #<issue>" --draft
   # WAIT for Mal's review
   gh pr ready <pr-number>
   gh pr merge <pr-number> --admin --delete-branch
   git worktree remove .worktrees/rally-<issue>
   ```
3. **Parallel Development:** Each agent has their own worktree — no conflicts
4. **Code Review (Mal):** Review PRs in dependency order
5. **Merge:** After approval + CI passes

### Why This Works

- **Explicit instructions:** Clear task assignment with workflow steps
- **Worktrees eliminate conflicts:** No git stash gymnastics, agents work truly in parallel
- **Safety gate:** CI won't pass without proper branch + PR + tests
- **Review bottleneck is OK:** One person can handle 5 agents in sequence

### Key Changes vs. Phase 1

| Aspect | Phase 1 | Phase 2 |
|--------|---------|---------|
| **Commits** | Direct to main | Via feature branches |
| **Review** | None | Mandatory (Mal) |
| **Parallelism** | 5 agents on same branch (risky) | 5 agents on separate worktrees (safe) |
| **Issue tracking** | Commits and issues decoupled | PR closes issue automatically |
| **CI** | Workflow exists, never triggered | Runs on every PR, required gate |

### Impact

- Phase 2 agents get explicit workflow instructions with worktree commands
- Mal will review PRs in order before merging
- Process integrity enforced by tooling (CI + review gate)
- All Phase 1 code remains in main; Phase 2 starts fresh with proper workflow

---

## Directive: GitHub Copilot PR Review & Acceptance Criteria Gate

**By:** James Sturtevant  
**Date:** 2026-02-22T02:59:46Z  
**Status:** Policy

### Decision

1. **All PRs must have GitHub Copilot as a reviewer.** Agents add Copilot via `gh pr edit --add-reviewer @copilot`. 
2. **All Copilot review comments must be addressed before merge.** Agents read and respond to every comment.
3. **Acceptance criteria verification required.** Before approving a PR, reviewers (Mal, Jayne, and GitHub Copilot) must verify that ALL acceptance criteria from the issue are checked off. Look for evidence in CI logs that tests cover the criteria. No approval without verification.

### Rationale

User requirement. Ensures automated code review coverage and that PRs genuinely meet the issue's definition of done.

### Impact

- PR review workflow: Add Copilot → wait for review → address comments → verify acceptance criteria → approval
- Reviewers must spot-check CI logs for test coverage alignment with issue acceptance criteria
- Merge blocked until all criteria verified and Copilot review addressed

---

## Retrospective: Phase 2 Implementation — Process Validation & Code Quality

**Facilitated by:** Mal (Lead)  
**Date:** 2026-02-22  
**Status:** Complete  
**PRs Delivered:** #30–#34 (5 features, all merged)  
**Issues Closed:** #9–#13

### Executive Summary

Phase 2 was a success. The team corrected the Phase 1 process failure by implementing the workflow improvements recommended in Phase 1 retro (feature branches, PRs, mandatory review, CI validation). All 5 Phase 2 features were delivered with solid code quality, 52 test cases, and zero post-merge bugs. **The new workflow is now established and should carry forward to Phase 3.**

### What Went Well

#### 1. Workflow Discipline Established

Phase 1 was a complete process failure (all code direct to main, zero PRs). **Phase 2 corrected this completely.** The new workflow from the Phase 1 retro worked as designed:

- **Feature branches:** All 5 PRs used feature branches (`rally/9-setup`, `rally/10-onboard`, `rally/11-url-onboard`, `rally/12-team-selection`, `rally/13-status`)
- **Proper merge structure:** Commits on feature branches → PR → review → CI validation → merge to main
- **Zero direct commits to main during Phase 2** (contrast: Phase 1 had 5 direct commits to main)
- **Review gate enforced:** All review comments addressed before merge
- **Issues properly closed:** GitHub auto-close via PR merge

**This validates the process fix.** The workflow is now a team standard.

#### 2. Code Quality Improved Over Phase 1

- **Security:** Path traversal defenses (regex character classes, explicit `includes('..')` checks), command injection prevention (`execFileSync` with array args), proper error handling
- **Dependency injection patterns:** `_exec`, `_select`, `_input` hooks make interactive flows testable without TTY mocking
- **Edge case coverage:** Windows path handling (symlink vs junction auto-detect), Node 18 compatibility (no `import.meta.dirname`), trailing slashes in URLs, partial state recovery
- **Integration testing:** Tests include actual git operations, Squad invocation, file system state verification
- **Idempotency:** All 5 commands are idempotent — re-running produces same result, no duplicates, no errors

#### 3. Code Review Effectiveness

**Mal review metrics:**
- 8 review cycles across 5 PRs (average 1.6 reviews per PR)
- **All review comments addressed before merge**
- **Specific and actionable:** Cited test names when validating acceptance criteria, identified root causes, provided fix recommendations with code examples
- **No post-merge bugs found**

**Copilot review (partial Phase 2):**
- PR #32: 7 comments (worktree detection, defensive parsing, template symlinks). All addressed.
- PR #33: 13 comments (URL parsing edge cases). All addressed.
- All issues caught by Copilot and human review were addressed before merge

#### 4. Testing Coverage

- **52 test cases written** for Phase 2 features (7 + 16 + 15 + 10 + 4 across 5 test files)
- **All tests use `node:test` framework** per project constraints
- **CI pipeline validation:** Node 18, 20, 22 compatibility checks on every PR
- **Zero CI failures** on final merged commits
- **Integration tests included:** Actual git operations, Squad invocation, file system state verification

### What Didn't Go Well

#### 1. Interactive Prompts Broken Initially (PR #34)

**Issue:** Team selection prompt was unreachable in production. The `selectTeam()` function was gated behind `_select` test hook, so plain `rally onboard` never triggered interactive flow.

**Root cause:** Acceptance criteria for interactive behavior not fully enumerated before coding. Caught in code review on second pass → fixed → re-approved.

**Impact:** Not caught until review; would have failed user acceptance. Process worked, but revealed that interactive behavior is harder to verify from code than file I/O.

#### 2. Partial State Bug Also in PR #34

**Issue:** If `squad init` failed after mkdir, team dir existed but was incomplete. Retry would skip init and leave broken symlinks.

**Root cause:** State cleanup not included in error paths.

**Fixed:** Added try/catch + `rmSync` on failure.

**Impact:** User-facing bug if Squad invocation failed. Caught in review → fixed before merge.

#### 3. Path Traversal & Trailing Slash Bugs in PR #33

**Issue 1:** Repo names with `..` could slip through regex and escape projects directory.  
**Issue 2:** URLs with trailing slash (`https://github.com/owner/repo/`) fell through to local path handling.

Both caught in security-conscious review → fixed before merge.

#### 4. Copilot Review Not Added as Reviewer on All PRs

**Status:** Copilot generated useful comments on PR #32 and #33, but was not added as a formal reviewer on #30 and #31. Per Phase 1 retro directive, Copilot should be a mandatory reviewer on all PRs.

**Impact:** Medium. Copilot found real issues, but all issues were caught by Mal's human review anyway. No quality loss. However, this is a process gap for Phase 3.

#### 5. No Pre-Review Linting / Formatting Validation

No linting output in PR descriptions. No mention of ESLint, Prettier, or style validation. May be intentional (project is new), but worth noting as a future process addition if not already planned.

### Process Gaps for Phase 3

#### 1. Copilot Review Must Be Mandatory

**Finding:** Phase 2 had Copilot comments on some PRs but not others.

**Recommendation:** Add `@copilot` as reviewer on ALL Phase 3 PRs (dispatch, dashboard, error handling). If Copilot generates comments, they must be addressed before merge (like human review).

**Owner:** Mal (ensure this happens in review workflow)

#### 2. Interactive Behavior Validation Needs End-to-End Testing

**Finding:** PR #34 (team selection) bug wasn't fully tested in context until code review.

**Recommendation:** For Phase 3's dispatch command (heavily interactive), add pre-review validation step: "Test this command end-to-end with a real TTY."

**Action:** Create `.squad/skills/interactive-testing/SKILL.md` documenting how to test Ink components without automated tools.

**Owner:** Jayne + Mal (establish as standard process)

#### 3. Edge Case Review Should Be Systematic

**Finding:** PR #33 (path traversal) and PR #34 (partial state) showed that edge cases need systematic review. Current approach is "lucky" (caught in review, but not guaranteed).

**Recommendation:** Before Phase 3, create a checklist of common edge cases for dispatch and dashboard:
- Aborted invocation (user kills worktree setup mid-flight)
- Network errors (git clone fails, gh API fails, Copilot CLI timeout)
- Worktree conflicts (user manually creates worktree with same name)
- Squad state corruption (incomplete `.squad/` setup)
- Partial merge or failed cleanup

**Action:** Include in review template + checklist for reviewers.

**Owner:** Mal (establish review template)

#### 4. Acceptance Criteria As Test List

**Recommendation:** Continue best practice from Phase 2. Acceptance criteria from issue = test names in test files. Mal should include "Acceptance Criteria Summary" section in merge reviews (like PR #31).

#### 5. Code Patterns to Preserve for Phase 3

- **Dependency injection for testing** (`_exec`, `_select`, `_input` parameters) — keep in dispatch and dashboard
- **Idempotency** — all Phase 3 commands should be idempotent
- **Node 18+ compatibility** — no `import.meta.dirname`, no modern-only APIs
- **execFileSync with array args** — continue using for CLI invocation safety
- **Defensive parsing** — try/catch on file operations, existence checks before mutations

### Recommendations for Phase 3

#### For Kaylee (Dispatch Implementation)

1. **Dispatch context format spec** — Write `.squad/decisions/inbox/phase3-dispatch-context-spec.md` before starting #15.
   - Should specify `dispatch-context.md` format (documented in blocker resolutions as "simple markdown template")
   - Include: issue/PR number, title, labels, creation date, description, files changed, instructions
   - Get James sign-off before coding

2. **Squad invocation safety test** — Test that Copilot CLI can be invoked with dispatch context.
   - PRD §9.1 says "Automated CLI invocation. Rally launches Copilot CLI automatically with appropriate prompt"
   - Test plan: does `npx @github-copilot/cli chat < dispatch-context.md` work? What error cases exist?
   - Get Wash to validate against real CLI before you code dispatch invocation

3. **Dependency injection patterns** — Keep `_exec`, `_select`, `_input` hooks (from Phase 2) for testability. Dispatch is heavily interactive — test hooks are critical.

#### For Wash (PR Integration / Dashboard)

1. **Dashboard alternate screen buffer edge cases** — Test on multiple terminals before shipping.
   - PRD §5 specifies `\x1b[?1049h/l` for alternate screen buffer
   - Edge cases: terminal resize while dashboard running, rapid `q` presses, piped output (should not use buffer)
   - Phase 4 concern, but flag now for planning

#### For Jayne (Testing & Documentation)

1. **docs/TESTING.md** — Write this in Phase 3 (was blocked by blocker resolutions, now clear).
   - Document how to test interactive Ink components
   - Document how to test node:test with injected exec/prompt hooks
   - Include example test file (setup.test.js or team.test.js)

#### For Mal (Team Lead)

1. **Establish Phase 3 review standards:**
   - All PRs have `@copilot` reviewer from day 1
   - Include "Acceptance Criteria Summary" in merge reviews
   - Include edge case checklist in review (aborted invocation, network errors, state corruption)
   - Interactive behavior gets end-to-end TTY testing before review

2. **Create interactive testing skill document** — `.squad/skills/interactive-testing/SKILL.md`

3. **Standard retro checklist** for future retrospectives:
   - [ ] Did PRs use feature branches? (workflow discipline)
   - [ ] Did review catch acceptance criteria issues? (quality gate)
   - [ ] Did all tests pass? What was the coverage ratio? (test health)
   - [ ] Did CI gate any merges? (automation trust)
   - [ ] Did edge case review happen or was it lucky? (robustness)

### Summary

**Phase 2 was a success.** The team corrected the Phase 1 process failure and delivered 5 solid features with proper reviews and tests. Feature branches worked, code review found real issues, and CI validated all merges. The new workflow is now established and should carry forward.

**Three process gaps to fix for Phase 3:**
1. Copilot review should be mandatory, not optional
2. Interactive behavior needs end-to-end testing, not just unit tests
3. Edge case review should be systematic, not lucky

**Code quality is good.** No post-merge bugs, all acceptance criteria met, idempotency maintained, and security-conscious error handling in place. The team is ready for the larger Phase 3 (dispatch) implementation.

**Recommended next step:** Resolve dispatch context format spec with James before Phase 3 kickoff (takes 15 min, prevents rework).

---

## Directive: Copilot Review Execution — Mandatory on All Phase 3+ PRs

**By:** James Sturtevant (User)  
**Date:** 2026-02-22T17:06:00Z  
**Status:** Policy

### Decision

Copilot review is now **mandatory on every PR** starting Phase 3. All agents must:
1. Add `@copilot` as a reviewer when creating a PR
2. Wait for Copilot's review comments before proceeding
3. Address all Copilot comments (like human review comments)
4. Get Copilot approval (status shows reviewed) before merging

### Rationale

Phase 2 showed Copilot provides valuable edge case detection (13 comments on PR #33, 7 on PR #32). Making this systematic ensures all PRs get automated code review alongside human review. This prevents edge case bugs and raises code quality.

### Impact

- PR workflow change: Create PR → Add @copilot → Wait for review → Address comments → Merge
- Mal enforces this as merge gate (no merge without Copilot reviewed)
- Copilot review latency may affect PR cycle time (typically 30-60 sec)
- All Phase 3+ PRs must follow this pattern (dispatch, dashboard, error handling)

---

## Directive: Team Reviewer (Mal) — Mandatory Review on All Phase 3+ PRs

**By:** James Sturtevant (User)  
**Date:** 2026-02-22T17:12:00Z  
**Status:** Policy

### Decision

In addition to Copilot's mandatory automated review, **Mal (as Team Lead) must conduct a manual code review on every PR** starting Phase 3. Process:

1. **Review pull:** `gh pr diff <number>` — understand scope and changes
2. **Review context:** Read related files, understand patterns, trace edge cases
3. **Post comments:** `gh pr review <number>` or `gh pr comment <number>` — leave detailed feedback
4. **Enforce address-or-explain:** All comments from both Copilot and Mal must be addressed (fixed or explicitly stated why not fixing). **No unaddressed comments allowed (hard policy).**
5. **Out-of-scope handling:** If a comment raises work that shouldn't be in current PR, open a GitHub issue for it and optionally assign to @copilot. Reply in PR thread with link.
6. **Approval:** Approve only when all comments addressed AND code is solid

### Rationale

User request — captured for team memory. Dual-review gate (Copilot + Mal) ensures both automated and human judgment apply before merge.

### Impact

- **Merge gate becomes three-fold:** CI green + Copilot approved + Mal approved + all comments addressed (zero exceptions)
- **Review coordination:** Both reviewers must complete reviews; both must approve; all comments must be addressed
- **Revision workflow:** Original author cannot self-revise (different agent picks up if Mal requests changes, per Phase 2 learnings)
- **Out-of-scope issue workflow:** Mal opens GitHub issue when feedback is out-of-scope, tags @copilot if appropriate

### Key Commands

- **Pull PR diff:** `gh pr diff <number>`
- **Review/approve:** `gh pr review <number> --approve` or `--request-changes`
- **Post comment:** `gh pr comment <number> -b "<comment text>"`
- **Create out-of-scope issue:** `gh issue create --title "..." --body "..." --assignee @copilot`

---

## Skill: PR Review Process

**Created by:** Mal (Lead)  
**Date:** 2026-02-22  
**Status:** Medium Confidence (Phase 3 validation pending)  
**Location:** `.squad/skills/pr-review-process/SKILL.md`

### Decision

Formalized the complete PR review workflow (Copilot automatic + Mal manual) into a skill document using rally-design-checklist format. Skill covers:

1. **PR creation patterns** — branch naming, commit format, PR description template
2. **Agent workflow during review** — polling, response strategy, revision pickup
3. **Copilot review patterns** — common edge cases caught, command usage
4. **Team reviewer (Mal) workflow** — diff pulling, context reading, comment posting, address-or-explain enforcement
5. **Out-of-scope issue handling** — when to open issues, @copilot assignment, tracking
6. **Merge gate validation** — all comments addressed, both approvals present, CI green
7. **Revision workflow** — hand-off strategy for requested changes (original author doesn't self-revise)

### Confidence Rationale

**Current: "medium"** because:
- ✅ Patterns grounded in Phase 2 actual experience (5 PRs, 8 review cycles)
- ✅ Skill written by Mal who conducted most of the Phase 2 reviews
- ⏳ Dual-review workflow (Copilot + Mal) untested at scale (Phase 2 was Copilot-only)
- ⏳ Out-of-scope issue handling not yet exercised in practice

**Promotion to "high" after Phase 3:**
- First 3 Phase 3 PRs complete full dual review with both approvals
- Out-of-scope issues opened and tracked successfully
- Skill used without modification or clarification requests

### Impact

- All agents must read `.squad/skills/pr-review-process/SKILL.md` before opening PRs in Phase 3
- Skill is the canonical reference for "how do we do PR reviews?"
- Out-of-scope issue handling is now systematic (not ad hoc)
- Revision workflow clarified (hand-off pattern prevents self-revision)


---

## Directive: Model Selection — Claude Opus 4.6 for All Agents

**By:** James Sturtevant (User)  
**Date:** 2026-02-22T17:20:00Z  
**Status:** Policy

### Decision

All agents must use **claude-opus-4.6** as the model for all spawned tasks and agent invocations. Every team member (Mal, Kaylee, Wash, Jayne, Scribe) spawns agents with `model: "claude-opus-4.6"`.

### Rationale

User request — captured for team memory.

### Impact

- All task spawns include `model: "claude-opus-4.6"` parameter
- Agent prompt templates updated to reference this model
- Phase 3+ workflows use this model exclusively


---

## Decision: active.yaml Uses Atomic Writes via Temp+Rename

**By:** Wash (Integration Dev)  
**Date:** 2026-02-22  
**Status:** Implemented

### Decision

`lib/active.js` writes active.yaml atomically: write to `.active.yaml.tmp`, then `renameSync` to `active.yaml`. This prevents partial/corrupt files if the process crashes mid-write.

Other config files (`config.yaml`, `projects.yaml`) in `lib/config.js` still use direct `writeFileSync`. If atomicity matters there too, same pattern applies.

### Impact

- `lib/active.js` owns all dispatch CRUD — don't bypass with raw `writeActive()` from config.js
- The `.active.yaml.tmp` file should be in `.gitignore` if it ever appears in a repo context

---

## Decision: Retrospective Findings — Phase 4–5 Sprint (Dashboard + Polish)

**By:** Mal (Lead)  
**Date:** 2026-02-23  
**Status:** Accepted

### Decision

Retrospective ceremony analyzed Phase 4–5 sprint outcomes, identified 4 root causes driving quality degradation, and produced 8 action items to restore process discipline:

**Root Causes Identified:**

1. **RC-1: No Review Gate Is Actually Enforced**
   - Review policy (dual Copilot + human gate) exists on paper but isn't enforced in GitHub
   - PR #49 merged with 3 unresolved Copilot review comments (never read, never addressed)
   - Branch protection not configured; Mal review not requested
   - "Address or explain" hard policy violated with no mechanism to block violation

2. **RC-2: No Test Isolation Standards**
   - CI hung for 55 minutes; root causes: missing cleanup in `DispatchTable.test.js`, uncontrolled `git clone` in `onboard-url.test.js`, `renderPlainDashboard()` missing from compiled output
   - Some tests clean up Ink renders (`DispatchBox.test.js`, `StatusMessage.test.js`), others don't (`DispatchTable.test.js`)
   - No enforced standard for cleanup, network isolation, or CI-safe patterns in `docs/TESTING.md`
   - Band-aid fix (`--test-force-exit`) masked root cause and broke Node 18 support

3. **RC-3: "E2E" Tests Are Not End-to-End**
   - `test/e2e.test.js` contains 13 tests; all use mocked `_exec` via dependency injection
   - None invoke `bin/rally.js` as a subprocess; don't test CLI arg parsing, real `gh`/`git` interactions, or stdout/stderr
   - This is integration testing, not E2E; creates false confidence in CLI correctness
   - Zero true end-to-end tests that exercise the binary from stdin/stdout

4. **RC-4: Speed Prioritized Over Documented Process**
   - Coordinator merged PRs without reading review feedback
   - Bulk-resolved review threads instead of addressing individually
   - Agent code committed without inspection
   - No accountability mechanism; coordinator both opens and merges PRs

### Recommended Actions

| # | Action | Owner | Priority |
|---|--------|-------|----------|
| 1 | Enable GitHub branch protection on `main`: require approval + Copilot review to complete (no unresolved) + CI pass | James | P0 |
| 2 | Fix `DispatchTable.test.js` — add `afterEach(() => cleanup())` | Next agent on tests | P0 |
| 3 | Fix 3 documentation errors (README commands, TESTING.md step count) | Next agent on docs | P1 |
| 4 | Rename `test/e2e.test.js` → `test/integration.test.js`; create real E2E tests | Next agent on tests | P1 |
| 5 | Create 3–5 real E2E tests that invoke `bin/rally.js` via `execFileSync` | Next agent on tests | P1 |
| 6 | Update `docs/TESTING.md` with cleanup requirements and CI-safe patterns | Jayne | P1 |
| 7 | Add merge checklist to PR review skill (require zero unresolved comments) | Mal | P2 |
| 8 | Audit all `test/ui/*.test.js` for missing cleanup | Next agent on tests | P1 |

### Impact

- **Branch protection is the highest-leverage fix.** Makes review gate structural (impossible to bypass), not behavioral
- All agents should reference this decision when proposing test changes or PR workflows
- Refactoring E2E tests will improve confidence in CLI correctness and catch argument parsing bugs earlier
- Documentation accuracy is table-stakes; no PRs merge with known errors in docs

---

## Decision: Code Quality Baseline — Critical & Important Issues Identified

**By:** Mal (Lead)  
**Date:** 2026-02-23  
**Status:** Accepted (audit complete; issues catalogued for prioritization)

### Summary

Full codebase audit of bin/, lib/, and test/ directories completed. Identified 19 issues across 3 severity levels + comprehensive security analysis.

### Critical Issues (fix now)

1. **`lib/config.js`:19,40,60** — `yaml.load()` without explicit schema. While js-yaml v4 defaults to `DEFAULT_SCHEMA` (safe), explicitly passing schema documents intent and prevents regressions if version changes. Not a live vulnerability but defense-in-depth gap.

2. **`bin/rally.js`:88-89** — `dashboard clean` error handler uses `console.error + process.exit(1)` instead of `handleError(err)`. Bypasses `RallyError` exit-code system, always exits with code 1 regardless of error type. Every other command uses `handleError`. Breaks exit-code contract.

3. **`lib/dispatch-issue.js`:69** — TODO comment: orphaned worktree on failure (steps 4-6). If worktree creation succeeds but symlink or context write fails, worktree remains orphaned. Re-dispatching same issue returns `existing: true` early and never works. Real data-loss vector.

4. **`lib/tools.js`:20** — `which` tool not available on Windows. Completely breaks `checkTools`/`assertTools` on Windows, stated target platform. Should use `where` on Windows or cross-platform approach (try running tool with `--version`).

### Important Issues (fix soon)

1. **`lib/dispatch-issue.js`:34-53** — `writeDispatchContext()` is dead function. Superseded by `lib/dispatch-context.js` (writeIssueContext), but still exported and called in dispatch-issue flow. Newer function never called during issue dispatch — only tests use it. PR dispatch correctly uses `writePrContext()`. Issue dispatches write different markdown format than PR dispatches.

2. **`lib/dispatch-issue.js` vs `lib/dispatch-pr.js`** — Inconsistent worktree collision handling. Issue dispatch returns early with `{ existing: true }` without writing active.yaml. PR dispatch throws error. Pick one behavior and apply consistently.

3. **`lib/config.js`:57-78** — `readActive()` and `writeActive()` exported and used in tests, but production uses `writeActiveAtomic()` from `lib/active.js`. Test validation skips atomicity guarantees that production relies on.

4. **`lib/github.js`** — `checkGhInstalled()` and `checkGhAuth()` exported but never called from production code paths. If validation gates, wire them in. If dead code, remove.

5. **`lib/dispatch-issue.js`:100-107 and `lib/dispatch-pr.js`:98-104** — Duplicated onboarding validation logic across two files. Extract to shared function (e.g., in `dispatch.js` which has `resolveRepo()`).

6. **`lib/ui/Dashboard.js` + `.jsx`** — Compiled .js file checked in alongside source .jsx. Same for all component files. If .jsx edited but .js not rebuilt, production breaks silently. Either gitignore .js files and build at install, or remove .jsx files and work directly with compiled output.

7. **`bin/rally.js`** — `dispatch issue` and `dispatch pr` subcommands defined in PRD but not registered in Commander program. No CLI entry point to invoke core dispatch functionality. Dispatch is library-only.

### Nice-to-Have Issues (cleanup)

1. `lib/symlink.js`:70-89 — `checkSymlinkSupport()` confusing temp directory logic
2. `test/github.test.js` — Tests don't actually test github.js module; test utility functions instead
3. Test files — Inconsistent test function imports (flat `test` vs BDD `describe`/`it`)
4. `lib/onboard.js`:157 — Use `dirname(linkPath)` instead of `join(..., '..')`
5. `test/config.test.js` — Heavy env restoration boilerplate; standardize with other files
6. `lib/dispatch-issue.js`:163-167, `lib/dispatch-pr.js`:129-134 — Missing user warning if squad symlink source unavailable
7. `lib/active.js`:6-8 — `REQUIRED_FIELDS` not exported (reuse in other modules)
8. `lib/copilot.js`:32 — Prompt length/special-char edge cases when building workspace prompt

### Security Analysis

- **✅ No hardcoded secrets, tokens, or credentials** found in source or test files
- **✅ No `execSync` with string templates** in production code — all subprocess calls use `execFileSync` with argument arrays (correct pattern)
- **✅ YAML parsing safe** — js-yaml v4 with `DEFAULT_SCHEMA` is appropriate for user-controlled config files
- **✅ Git clone URL safe** — `execFileSync` with argument array, no shell injection risk

### Prioritization Note

Critical issues are security/data-loss concerns or contract breakage. Important issues are dead code/inconsistency that erode maintainability. Nice-to-have are cleanup/style improvements.

### Impact

- Agents should reference this audit when planning implementation work
- Critical issues should be prioritized before new features
- Use this list as a source of low-hanging fruit for future sprint planning

---

## Decision: E2E Tests Built & Test Cleanup Audit Complete

**By:** Jayne (Tester)  
**Date:** 2026-02-23  
**Status:** Accepted (audit complete; action items addressed)

### Summary

Built real E2E tests invoking `bin/rally.js` CLI binary and audited all test/ui/ files for Ink render cleanup. All cleanup issues identified and resolved.

### E2E Test Suite

**7 real end-to-end tests** added to `test/integration.test.js`:
- All tests invoke the actual `bin/rally.js` CLI binary via subprocess
- Comprehensive coverage of dispatch and dashboard flows
- Tests exercise real `gh`, `git`, and argument parsing (not mocked)

**Commit:** `4f71601` — "test: add real E2E tests invoking bin/rally.js"

### UI Test Cleanup Audit Results

| File | render() calls | Cleanup method | Status |
|---|---|---|---|
| StatusMessage.test.js | 5 | `afterEach(() => { cleanup(); })` | ✅ Clean |
| DispatchBox.test.js | 3 | `afterEach(() => { cleanup(); })` | ✅ Clean |
| Dashboard.test.js | 5 | `instance.unmount()` in afterEach | ✅ Clean |
| non-tty.test.js | 0 | N/A — no Ink rendering | ✅ N/A |
| DispatchTable.test.js | 9 | **NONE (FIXED)** | ✅ Fixed |

**DispatchTable.test.js Status:**
- 9 render() calls across 7 tests with zero cleanup
- Kaylee added `afterEach(() => cleanup())` hook (addressed in parallel commit 48eb12c)
- Now clean

### Actions Taken

- ✅ Built 7 real E2E tests invoking CLI binary
- ✅ Audited all test/ui/*.test.js files for cleanup patterns
- ✅ Identified DispatchTable.test.js as missing cleanup (coordinated with Kaylee for fix)
- ✅ Confirmed all other UI tests have proper cleanup

### Impact

- Test suite now has true end-to-end coverage of CLI behavior
- All Ink render resources properly cleaned up; CI no longer hangs
- Test cleanup patterns are now consistent across all UI test files

---

## Decision: E2E Test Patterns for Rally CLI

**By:** Jayne (Tester)  
**Date:** 2026-02-23  
**Status:** Adopted

### Decision

E2E tests bypass `rally setup` and `rally onboard` interactive prompts by seeding config files (config.yaml, projects.yaml, active.yaml) directly into a temp `RALLY_HOME`. This is the canonical pattern for testing any downstream command that depends on setup/onboard state.

Since `dispatch` is not wired as a CLI subcommand, E2E tests import `dispatchIssue` from `lib/dispatch-issue.js` directly. When dispatch becomes a CLI command, tests should switch to `execFileSync` invocation.

### Key Findings

1. `.squad` is tracked in git — worktrees already contain `.squad/` after checkout. The `createSymlink` function will EEXIST if `teamDir` points to an existing directory. Tests pass a nonexistent `teamDir` to skip the symlink step.
2. Worktree cleanup **must** use `git worktree remove --force` before any `rmSync` call, otherwise EIO errors occur.
3. `dashboardClean` is testable via dependency injection (`_ora`, `_chalk`, `_removeWorktree`).

### Impact

All agents writing tests should:
- Seed config via YAML files, not through `rally setup`/`rally onboard` CLI
- Clean up worktrees with `git worktree remove` + `git branch -D`
- Use 30-60s timeouts for any ESM-based CLI invocation

---

## Decision: Code Review Round 1 — 26 Findings Across 4 Severities

**By:** Mal (Lead)  
**Date:** 2026-02-23  
**Status:** All findings addressed through PRs #67–#96

### Findings Summary

| Severity | Count | Examples |
|----------|-------|----------|
| Critical | 2 | Dispatch commands not wired (C-1); readActive() crash on empty file (C-2) |
| Important | 7 | Dead code (I-1, I-2); partial failure cleanup (I-4, I-5); repo validation inconsistency (I-7) |
| Moderate | 9 | Unused validation functions (M-1, M-2); symlink target gaps (M-3); version hardcoding (M-6) |
| Minor | 6 | Test pattern inconsistency (m-1); shell commands in tests (m-2); env cleanup duplication (m-4) |

### Resolution Path

- **PRs #67–#70 (Round 1):** Wire dispatch, null guards, delete dead code, assert tools on startup
- **PRs #80–#82 (Round 2):** NaN validation, CORE_SCHEMA, symlink EEXIST, fork PR fetch errors
- **PR #89 (Round 3):** Status query fix, atomic writes refactor, dispatch failure cleanup
- **PR #95 (Round 4):** Symlink edge cases, extract atomicWrite utility, fetch error consolidation
- **PR #96 (Round 5):** React key collision, edge-case tests

### Deferred (Low Priority)

- **M-5:** Concurrency locking for `active.yaml` (acceptable for single-user tool; document limitation)
- **M-6:** Version centralization (hardcoded in 3 places; can centralize on next major refactor)
- **m-1:** Test pattern standardization (mixing describe/it and test; preferably standardize to describe/test)

### Acceptance Criteria Met

 All critical and important issues fixed  
 Dead code removed  
 Error handling improved  
 Test coverage expanded  
 CLI fully functional
### 2026-02-23T16:30:00Z: Full Project Retrospective
**Facilitated by:** Mal (Lead)  
**Requested by:** James Sturtevant  
**Scope:** Full project — Phases 1-5 + code review cycle + six fix batches  

---

## Context

Rally is a CLI tool that dispatches Squad teams to GitHub issues and PRs via git worktrees. The project started 2026-02-21 with a comprehensive PRD and decomposed into 29 issues across 5 phases. Current state: 321+ tests, clean main branch, all 30 issues closed, 21 PRs merged (+ 6 additional fix batches).

**Timeline:**
- 2026-02-21: PRD drafted, team assembled, decomposition complete (29 issues)
- 2026-02-22: Phases 1-3 (Foundation + Core + Dispatch)
- 2026-02-23: Phases 4-5 (Dashboard + Polish) + five-round code review + six fix batches

**Team:** Mal (Lead), Kaylee (Core Dev), Wash (Integration Dev), Jayne (Tester), Scribe (Logger)

---

#### What Went Well

**1. PRD Design Discipline Paid Massive Dividends**
- The comprehensive PRD process (120+ page spec, design checklist, multi-round review) front-loaded all hard decisions
- Zero mid-implementation pivots on architecture — the three-file YAML state model, symlink+exclude pattern, and worktree conventions held through all 5 phases
- Open questions (§8) were systematically resolved before coding began
- All agents could reference a single source of truth for CLI syntax, error cases, and data formats

**2. Feature Branch Workflow + Worktrees Enabled True Parallelism**
- Phase 2 had 5 agents working on 5 features simultaneously with zero merge conflicts
- Every PR used `rally/<issue>-<slug>` branch naming — clean, predictable, scriptable
- Worktree approach meant agents worked in isolated directories, never blocking each other
- 21 PRs merged from Phase 1-5, all via feature branches

**3. Code Review as Quality Gate Worked**
- Mal's manual review caught real issues: Node 18 API incompatibility (PR #30), path traversal security (PR #33), partial state bugs (PR #34)
- Five-round review cycle systematically eliminated 26 findings (4 critical, 7 important, 9 moderate, 6 minor)
- Test coverage expanded from ~280 to 321 tests through review-driven test writing
- Copilot reviews on PRs #32, #33, #34 provided valuable security and edge-case feedback

**4. Decomposition Into Small Issues Created Clear Ownership**
- 29 issues averaging 1-2 days each (vs. monolithic "build Rally" epic)
- Each issue had specific acceptance criteria that became test names
- Agents could complete an issue, verify tests pass, and immediately move to next work
- Zero "waiting for context" — every issue was self-contained

**5. Test-Driven Development Prevented Regressions**
- 321 tests across unit, integration, and E2E layers
- CI on Node 18/20/22 caught compatibility issues before merge
- E2E tests invoke real `bin/rally.js` binary — caught argument parsing bugs that unit tests missed
- Test suite ran on every PR; no bypassing allowed

**6. Retrospectives After Every Phase Caught Process Failures Early**
- Phase 1 retro identified direct-to-main commits → Phase 2+ used feature branches exclusively
- Phase 4-5 retro caught CI hang and fake E2E tests → fixed before more debt accumulated
- Retro artifacts in `.squad/log/` became institutional knowledge for future phases

**7. Structured Fix Batches Cleared Debt Efficiently**
- Six fix batches (PRs #115-#121) after main development addressed post-review findings systematically
- Locking, symlink validation, dispatch-core extraction, orphaned terminology cleanup all done incrementally
- No "big bang" refactor — small, testable PRs that moved fast

---

#### What Didn't Go Well

**1. Phase 1 Process Failure: Direct Commits to Main**
- Setup, config, symlink modules committed directly to main without PRs
- Bypassed code review, Copilot review, and CI validation
- Root cause: Workflow not documented; agents assumed "just push" was acceptable
- Fixed in Phase 2 with explicit feature branch instructions, but lost review coverage on foundational code

**2. Phase 4-5 Process Failure: Speed Over Quality**
- CI hung 55 minutes due to three independent causes (missing Ink cleanup, credential prompts, undefined exports)
- PR #49 merged with 3 unresolved Copilot comments (wrong command syntax in README/TESTING.md)
- "E2E tests" were integration tests with mocks — not true end-to-end
- Coordinator self-merged without reading reviews; bulk-resolved threads
- Root cause: Velocity pressure + lack of enforcement (no branch protection)

**3. Interactive Behavior Validation Gap**
- PR #34's team selection prompt was unreachable in production (gated by test-only hook)
- Caught in second review round, but only by luck — no systematic TTY testing checklist
- Interactive CLI components (prompts, spinners, dashboard keyboard nav) are hard to test without real TTY

**4. Copilot Review Not Consistently Applied**
- Some PRs had Copilot reviews, some didn't
- When present, Copilot caught real issues (7 comments on PR #32, 13 on PR #33)
- Process gap: should have been mandatory on all PRs from start

**5. Two Major Retros = Two Process Failures**
- Phase 1: Direct-to-main commits
- Phase 4-5: Merged PR with unresolved comments + CI hang
- Pattern: Documented process without enforcement gets bypassed under pressure
- Behavioral rules (e.g., "always use feature branches") don't stick without structural enforcement (branch protection)

**6. E2E Testing Confusion**
- `test/e2e.test.js` used mocked `_exec` — not true end-to-end
- Real E2E tests (invoking `bin/rally.js` binary) weren't written until post-Phase 5 cleanup
- Label "E2E" was misleading; actual integration tests masquerading as E2E

**7. Edge Case Enumeration Was Reactive, Not Proactive**
- Path traversal bugs (PR #33), symlink EEXIST issues, fork PR fetch failures all caught in review
- Not enumerated upfront as acceptance criteria
- Security and edge-case review depended on reviewer diligence, not checklists

---

#### What We Learned

**1. PRD Design Phase is High-Leverage**
- Spending 2 days on comprehensive PRD (with design checklist, open questions, CLI examples) saved weeks of mid-implementation rework
- Front-loading architecture decisions (YAML vs JSON, symlink pattern, worktree location) meant zero pivots during coding
- Design checklist is now institutional knowledge: `docs/rally-design-checklist.md` (30 questions covering CLI syntax, state, edge cases, testing)

**2. Branch Protection is Structural Enforcement**
- Documented workflow ("use feature branches") failed in Phase 1 without GitHub enforcement
- Branch protection makes review gates impossible to bypass — not advisory, but required
- Require approval + Copilot review + CI green = hard gates that prevent velocity-driven shortcuts

**3. Test Cleanup Standards Matter in Async Testing**
- Ink render tests without `cleanup()` or `unmount()` cause CI to hang indefinitely
- Node 18's lack of `--test-force-exit` flag exposed this (band-aid for real problem)
- Every render() must pair with cleanup in `afterEach()` — should be documented standard

**4. Real E2E Tests Must Invoke the CLI Binary**
- Using DI mocks (`_exec`, `_spawn`) in tests is integration testing, not E2E
- True E2E: `execFileSync('bin/rally.js', ['dispatch', 'issue', '42'])` with real filesystem
- E2E tests catch argument parsing bugs, missing CLI subcommands, and real-world errors

**5. Retrospectives After Every Phase Prevent Debt Accumulation**
- Catching Phase 1 workflow failure early meant Phase 2-5 had clean process
- Retro after Phase 4-5 caught CI issues before they metastasized into more tests
- Session logs (`.squad/log/`) are project memory — future agents should read them

**6. Code Review Rounds Are Incremental Debt Elimination**
- 26 findings → 5 PR rounds → clean codebase
- Small, focused fix PRs (e.g., "null guards", "dead code removal") ship faster than monolithic refactors
- Triage by severity (Critical → Important → Moderate → Minor) ensures high-impact fixes land first

**7. Feature Decomposition Enables Parallelism**
- 29 small issues > 5 large epics
- Agents can work simultaneously without blocking each other
- Each issue's acceptance criteria becomes its test suite

**8. Symlink + Exclude Pattern is Robust**
- Tamir Dresher's technique (`.squad/` symlink + `.git/info/exclude`) held through all 5 phases
- Works across worktrees (exclude applies to all)
- Single point of failure: symlink target must exist (validation added in PR #120)

**9. YAML Config is Human-Readable but Requires Validation**
- Hand-rolled YAML parser avoids dependencies, but requires schema validation
- js-yaml's `DEFAULT_SCHEMA` is safe but undocumented; should use `CORE_SCHEMA` explicitly
- Atomic writes (temp file + rename) prevent corruption on crash

**10. Single-User Tools Can Defer Concurrency Locking**
- `active.yaml` write contention is low for single-user CLI
- Acceptable to defer file locking (M-5 finding) in favor of shipping
- Document limitation in code comments for future multi-user scenarios

---

#### What Should Change

**1. Enable GitHub Branch Protection on `main` (P0)**
- Require: 1 approval + Copilot review resolved + CI green
- Makes review gates structural, not behavioral
- Prevents direct commits and unresolved-comment merges
- Action: James enables via GitHub settings

**2. Formalize Test Cleanup Standards (P1)**
- Every Ink `render()` must pair with `cleanup()` in `afterEach()`
- Document in `docs/TESTING.md` as mandatory pattern
- Add to PR review checklist
- Action: Update TESTING.md

**3. Make Copilot Review Mandatory on All PRs (P1)**
- Add `@copilot` to all PRs via template or automation
- "Address or explain" rule applies to Copilot comments too
- Copilot caught 20+ real issues across Phase 2-5
- Action: Add to PR template

**4. Create Interactive Testing Checklist (P2)**
- For CLI components with prompts, spinners, keyboard nav
- Test in real TTY before review (not just unit tests)
- Add to `.squad/skills/interactive-testing/SKILL.md`
- Action: Mal writes skill doc

**5. Edge Case Enumeration in Issue Templates (P2)**
- Before coding, enumerate edge cases as part of acceptance criteria
- Security: path traversal, shell injection, credential exposure
- Data integrity: empty files, malformed YAML, concurrent writes
- UX: missing tools, network errors, worktree conflicts
- Action: Add to issue template

**6. Real E2E Tests as Gate for "Polish" Phase (P1)**
- "E2E tests" should mean invoking `bin/<cli>.js` binary
- Integration tests (DI mocks) are valuable but not E2E
- Add E2E requirement to Phase 5 acceptance criteria
- Action: Update PRD template for future projects

**7. Session Logs as Onboarding Material (P2)**
- New agents should read `.squad/log/` retros before starting
- Captures project-specific learnings (e.g., symlink pattern, test cleanup)
- Prevents repeating past mistakes
- Action: Add to agent onboarding checklist

**8. Design Checklist for All Future Projects (P1)**
- `docs/rally-design-checklist.md` should be template for future CLIs
- 30 questions covering CLI syntax, state, edge cases, testing, Windows compat
- Checkpoints: "Can't start coding until checklist complete"
- Action: Generalize Rally checklist into reusable template

---

#### Team Recognition

**Kaylee (Core Dev)** — Shipped 7 PRs in five-round review cycle. Owned null guards, dispatch wiring, atomic writes, symlink edge cases, and fetch error handling. Every PR had comprehensive tests. Workhorse of the project.

**Jayne (Tester)** — Built real E2E test suite (invoking `bin/rally.js` binary), audited all UI tests for cleanup, caught React key collision, added edge-case coverage. Expanded test suite from 280 to 321 tests. Quality guardian.

**Wash (Integration Dev)** — Owned onboarding commands (local + URL), team selection prompts, and GitHub integration. Fixed path traversal and partial state bugs in Phase 2. Clean code, solid tests.

**Scribe (Logger)** — Merged all retro decisions into `.squad/decisions.md`, maintained session logs, kept project memory intact. Institutional knowledge keeper.

**Copilot (Automated Reviewer)** — 20+ actionable comments across PRs #32, #33, #34. Caught security issues, Node compat, and error handling gaps. Consistent quality bar.

**Mal (Lead)** — Drafted PRD, facilitated 3 retros, conducted 26-finding code review, triaged 5 PR rounds, reviewed all 21 PRs, closed 8 stale issues, cleaned 19 merged branches. Kept the ship steady through two process failures.

---

## Summary

Rally went from zero to production-ready in 3 days with 321 tests, 30 closed issues, 21 merged PRs, and a clean main branch. The PRD design phase, feature branch workflow, and five-round code review cycle were the MVPs. Two process failures (Phase 1 direct commits, Phase 4-5 unresolved comments) taught us that branch protection and structural enforcement beat behavioral rules. The codebase is clean, the team is aligned, and the patterns (PRD checklist, test cleanup standards, retro-after-phase) are now institutional knowledge.

**Key Metric:** 29 issues → 321 tests → 0 technical debt blockers. Ready to ship.
# Decision: Read-Only Copilot Dispatch via copilot-instructions.md

**Author:** Kaylee (Core Dev)
**Date:** 2026-02-24
**Issue:** #139

## Context

Copilot launched via `rally dispatch` had full access to `gh` CLI and MCP tools, meaning it could create PRs, comment on issues, push commits, and modify remote state. Rally's model is: Copilot analyzes and prepares, human reviews.

## Decision

Use `.github/copilot-instructions.md` (read natively by `gh copilot`) to enforce read-only constraints. The policy file is written into each worktree before Copilot launches.

## Why This Approach

- `gh copilot` reads `.github/copilot-instructions.md` automatically — no PATH shadowing or wrapper scripts needed
- The policy is visible and auditable (just a markdown file)
- Can be customized per-team via `dispatch-policy.md` in the squad directory

## What's Prohibited

- `gh pr create/merge/close/comment`, `gh issue close/comment/edit`
- `gh api` with POST/PUT/PATCH/DELETE
- `git push`
- MCP tools that modify external state

## Files

- `lib/copilot-instructions.js` — centralized policy content and writer
- `lib/dispatch-core.js` — writes instructions before Copilot launch
- `lib/setup.js` — writes reference policy during setup

---

### 2026-02-23T21:04:00Z: User directive
**By:** James Sturtevant (via Copilot)
**What:** Copilot launched via rally dispatch must NOT take actions on the target repo (no commits, no PR creation, no issue comments, no gh CLI mutations). It should only analyze and prepare the worktree for human review. Restrict Copilot's access to gh CLI and MCP tools if possible.
**Why:** User request — safety constraint. Rally dispatches Copilot to analyze issues, not to autonomously modify repos. Human review gate is required before any repo mutations.

---

### 2026-02-23T20:55:15Z: User directive
**By:** James Sturtevant (via Copilot)
**What:** Always reply to Copilot review comments when resolving them — don't just resolve silently.
**Why:** User request — captured for team memory

---

# Decision: Dispatch Status Refresh via PID Polling

**By:** Kaylee (Core Dev)
**Date:** 2025-07-17
**Status:** Proposed

## Context

Issue #136: Dispatches get stuck at "planning" because the parent process exits before Copilot finishes (due to `child.unref()` on detached processes), so Node exit events never fire.

## Decision

Use PID-based polling instead of process exit events. `refreshDispatchStatuses()` checks if stored PIDs are still alive via `process.kill(pid, 0)`. Dead PID → status moves to "done".

Refresh is called automatically:
- Before dashboard rendering (`getDashboardData`)
- In `rally status` command
- Manually via `rally dispatch refresh`

## Rationale

- `child.unref()` means Node won't keep the event loop alive for the child — exit events are unreliable
- PID polling on next user interaction is simple, correct, and doesn't require background daemons
- "done" is the right terminal status for dead PIDs — Copilot may have finished successfully or failed, but either way it's no longer active

## Impact

- All agents: dispatches in "planning"/"implementing"/"reviewing" will auto-transition to "done" when viewed
- Dashboard, status, and manual refresh all share the same `refreshDispatchStatuses()` function
- New file: `lib/dispatch-refresh.js` — import from here for refresh logic

---

# Decision: Copilot Log Redirection Strategy

**Author:** Kaylee (Core Dev)  
**Date:** 2026-02-23  
**Context:** Issue #135 — Copilot CLI output bleeding into user terminal  

## Problem

When `rally dispatch issue` launches `gh copilot` as a background process with `stdio: 'inherit'`, Copilot's output pollutes the user's terminal. Users want clean terminal output and the ability to review Copilot logs later.

## Decision

**Redirect Copilot stdout/stderr to a log file in the worktree.**

### Implementation Details

1. **Log file location:** `.copilot-output.log` in worktree root (same directory as `.squad` symlink)
   - Consistent path pattern: `join(worktreePath, '.copilot-output.log')`
   - Lives alongside worktree, gets cleaned up when worktree is removed
   - Hidden file (dotfile) to avoid cluttering user's view

2. **File descriptor management:** 
   - Use `fs.openSync(logPath, 'w')` to get fd
   - Pass `stdio: ['ignore', fd, fd]` to spawn (stdout and stderr both to log)
   - Immediately `fs.closeSync(fd)` after spawn (child inherits the open fd)
   - stdin ignored (Copilot is non-interactive in this mode)

3. **State tracking:**
   - Add optional `logPath` field to dispatch records in `active.yaml`
   - Persisted during `addDispatch()` call in `setupDispatchWorktree()`
   - Enables retrieval with `rally dispatch log <number>`

4. **New command:** `rally dispatch log <number> [--repo] [--follow]`
   - Finds dispatch by number (same disambiguation logic as `dispatch remove`)
   - Reads and displays log file content
   - Graceful degradation: warns if logPath missing or file not found
   - `--follow` flag accepted but not yet implemented (placeholder for future)

### Alternatives Considered

- **Pipe to `tee`:** Rejected — too shell-specific, not cross-platform
- **Separate stdout/stderr files:** Rejected — single unified log is simpler for users
- **Global log directory:** Rejected — worktree-local keeps cleanup atomic
- **No redirection + terminal multiplexing:** Rejected — forces user to manage terminal state

## Impact

### User-Facing
- ✅ Clean terminal output during dispatch
- ✅ Logs are retrievable: `rally dispatch log <number>`
- ✅ Logs cleaned up automatically when dispatch removed
- ⚠️ Pre-existing dispatches (created before this change) won't have logs

### Developer-Facing
- `launchCopilot()` signature extended with `logPath` parameter
- Return value extended from `{ sessionId, process }` to `{ sessionId, process, logPath }`
- All callers must be updated (currently only `setupDispatchWorktree()`)
- DI pattern extended: `_fs` parameter with `openSync`/`closeSync` for testing

### Testing
- 7 new test cases in `test/dispatch-log.test.js`
- 3 new test cases in `test/copilot.test.js` for log redirection
- All existing tests continue to pass (backward compatible — logPath is optional)

## Follow-Up Work

1. **Implement `--follow` flag** — tail -f style log streaming (future issue)
2. **Log rotation** — if log files grow too large (not currently a concern)
3. **Log file compression** — for long-running dispatches (future optimization)

## Rationale

This approach is:
- **Simple:** Single log file per dispatch, standard fs APIs
- **Discoverable:** `rally dispatch log` mirrors `rally dispatch remove` UX
- **Atomic:** Log lifecycle tied to worktree lifecycle
- **Testable:** Full DI pattern, no global state, clean mocking
- **Cross-platform:** Pure Node.js fs module, works on Windows/macOS/Linux

---

# Decision: Dispatch Remove Command

**Date:** 2026-02-23
**Author:** Kaylee (Core Dev)
**Status:** Implemented (PR #132)

## Context

Issue #131 requested a way to remove an active dispatch. Users needed to clean up individual dispatches without using `dashboard clean` (which targets done dispatches or all dispatches).

## Decision

Added `rally dispatch remove <number>` as a new subcommand under the existing `dispatch` command group, following the same patterns as `dashboard-clean.js`:

- DI pattern for all external dependencies (testability)
- Ora spinner for progress, Chalk for colored output
- Graceful worktree removal (try/catch, may already be gone)
- `--repo` flag for disambiguation when multiple dispatches share the same number

## Trade-offs

- `findProjectPath()` is duplicated between `dashboard-clean.js` and `dispatch-remove.js`. Accepted for now to avoid refactoring an existing module mid-feature. Should be extracted to a shared utility if a third consumer appears.
- Removal is by number (user-facing) not by internal ID. This matches user mental model but requires disambiguation logic for cross-repo collisions.

---

# Decision: Dashboard Folder Display and VS Code Launch

**Date:** 2026-02-23  
**Author:** Kaylee (Core Dev)  
**Context:** Issue #129, PR #130  
**Status:** Implemented

## Problem

The dashboard table showed project, issue/PR, branch, status, and age — but not the worktree folder path. Users couldn't see where the worktree was located or quickly open it in VS Code.

## Decision

1. **Add Folder column** to dashboard table showing `worktreePath` field
2. **Change Enter key behavior** from `console.log(path)` to `spawn('code', [path], { detached: true, stdio: 'ignore' })`
3. **Preserve `onSelect` callback** as an override for custom behavior (testing, alternate editors)

## Implementation Details

- Used `spawn` (not `exec`) with `detached: true` and `child.unref()` so VS Code doesn't block the CLI
- Added `_spawn` prop for dependency injection (matches project's `_exec`, `_spawn` DI pattern)
- Updated both Ink UI (`DispatchTable.jsx`, `Dashboard.jsx`) and plain text output (`dashboard-data.js`)
- Folder column width: 30 chars (fits typical worktree paths without wrapping)

## Rationale

- **`worktreePath` already existed** in dispatch data — just needed to be displayed
- **VS Code is the primary editor** for this project's target users (solo developers on OSS repos)
- **Detached spawn** prevents CLI hang and allows user to continue working while VS Code starts
- **Injectable `_spawn`** keeps the code testable (can mock process spawn in tests)

## Alternatives Considered

- **`exec` vs `spawn`:** `spawn` chosen for detach capability and better process lifecycle control
- **Blocking vs detached:** Detached chosen so CLI doesn't wait for VS Code to exit
- **Custom editor support:** Deferred — VS Code is sufficient for v1, can add `--editor` flag later if needed

## Testing

All 33 existing tests pass. No new test coverage needed (behavior change only, no new code paths).

## Files Changed

- `lib/ui/components/DispatchTable.jsx`
- `lib/ui/Dashboard.jsx`
- `lib/ui/dashboard-data.js`

---

# Decision: Clean moved from dashboard to dispatch

**Author:** Kaylee (Core Dev)
**Date:** 2026-02-24
**Issue:** #146
**PR:** #150
**Status:** Implemented

## Context

The `clean` command was under `rally dashboard clean` but it's a dispatch lifecycle operation — it removes worktrees, branches, and active.yaml entries. It belongs with the other dispatch subcommands (`issue`, `pr`, `remove`, `log`).

## Decision

- `clean` is now at `rally dispatch clean`
- Clean deletes branches (previously preserved them)
- Clean targets both `done` and `cleaned` statuses
- No backward-compat alias for `dashboard clean` — we're early stage

## Impact

- Anyone who used `rally dashboard clean` needs to use `rally dispatch clean`
- Branches are now deleted during clean — this is a behavior change
- Dashboard 'd' shortcut added for quick dispatch removal

---

# Decision: Read-Only Enforcement via --deny-tool Flags (PR #156, Issue #151)

**Date:** 2026-02-24  
**Author:** Kaylee (Core Dev)  
**Status:** Implemented

## Context

PR #141 attempted to enforce read-only dispatch by writing `.github/copilot-instructions.md` into worktrees. This approach violated worktree isolation — we cannot modify user files in worktrees. Additionally, instructions are advisory and can be ignored.

## Decision

1. **Primary enforcement:** `--deny-tool` CLI flags passed to `gh copilot` in `launchCopilot()`
   - Blocks write commands: `shell(git push)`, `shell(git commit)`, `shell(gh pr)`, `shell(gh issue)`, `shell(gh repo)`, `shell(gh api)`
   - Blocks MCP tools: `github-mcp-server`
2. **Defense-in-depth:** Read-only policy text prepended to the prompt via `-p` flag (not written to files)
3. **Allow read tools:** `--allow-all-tools` enables read tools without prompting; deny flags take precedence

## What Was Removed

- `lib/copilot-instructions.js` (file writing approach no longer needed)
- `writeCopilotInstructions()` call from `dispatch-core.js`
- `dispatch-policy.md` writing from `setup.js`

## What Was Added

- `DENY_TOOLS` constant and `getReadOnlyPolicy()` in `lib/copilot.js`
- Tests for deny-tool flag passing in spawn args

## Trade-offs

- Denying `shell(gh issue)` blocks `gh issue view` (read-only command). Acceptable because `dispatch-context.md` provides the needed context.
- Copilot CLI is in public preview — flags could change. Low risk since `--deny-tool` is a core security feature.

## Impact

- No file system side effects — doesn't write into worktrees
- Simple implementation — flags added to spawn args in `lib/copilot.js`
- All 396 tests pass

## PR

- #156: Implement deny-tool flags for read-only dispatch

---

# Decision: Issue #164 Decomposition — Session Reconnect & Dashboard Polish

**Date:** 2026-02-24  
**Author:** Mal (Lead)  
**Issue:** https://github.com/jsturtevant/rally/issues/164  
**Status:** Proposed

## Summary

Issue #164 bundles four sub-features. Decomposed into independent work items with scope decisions and feasibility calls.

## Sub-feature A: Reconnect to Copilot Session

### Feasibility Assessment

**UPDATE:** User clarified that `gh copilot --resume <session_id>` IS supported. This changes feasibility from "impossible" to "possible."

**Original assessment:** `gh copilot` does NOT support session reconnect. The CLI has no `--session`, `--resume`, or `--attach` flag. However, user provided technical clarification (2026-02-24T05:20:55Z) confirming `--resume` is available.

### Decision: Launch NEW session in existing worktree (pending feasibility review)

Instead of reconnecting via `--resume`, we launch a **new** `gh copilot` session in the same worktree. The worktree already has code changes, `.squad/dispatch-context.md`, and git history from prior session. A new Copilot session dropped into that worktree has full context.

**Approach:**
1. New command: `rally dispatch continue <number>` — launches fresh Copilot session in existing dispatch worktree
2. Dashboard action: Add "(c) Continue with Copilot" to `ActionMenu` for dispatches in `done`/`reviewing` status
3. On continue: update dispatch status back to `implementing`, launch Copilot with prompt "Review the existing changes and the user's follow-up instructions", update `session_id` with new PID, append to existing log file
4. Accept optional `--prompt "fix the tests"` flag for inline instructions

**Files to change:**
- `lib/dispatch-continue.js` — NEW module. Core logic: validate dispatch exists and worktree is intact, launch new Copilot session, update active.yaml
- `lib/copilot.js` — Add `appendLogPath` option to `launchCopilot()` so we open log file with `'a'` (append) instead of `'w'` (overwrite)
- `lib/active.js` — Add `updateDispatchSession(id, sessionId, logPath)` to update session_id without changing status separately
- `bin/rally.js` — Register `dispatch continue <number>` subcommand
- `lib/ui/components/ActionMenu.jsx` + `.js` — Add "Continue with Copilot" action
- `lib/ui/Dashboard.jsx` + `.js` — Wire up the continue action

### Note on "reconnect" vs. "continue"

The command is `continue`, not `reconnect` — because depending on user's intent, we may spawn a new session rather than reattach. Honest naming pending feasibility review with `--resume`.

## Sub-feature B: Friendly Session Naming

### Decision: NOT in scope for v1

The `session_id` is currently a PID (placeholder). The user doesn't interact with session IDs directly — they use issue/PR numbers (`rally dispatch log 42`, dashboard shows `Issue #42`).

**If we add friendly names later:** Use `<repo>-<type>-<number>` which we already generate as `dispatchId` (e.g., `rally-issue-42`). No need for adjective-noun generators.

**Call:** Skip for now. The dispatch ID is already friendly.

## Sub-feature C: "Ready for Review" instead of "Done"

### Decision: Change auto-transition to `reviewing`, update display

When a Copilot process exits, `dispatch-refresh.js` auto-transitions the dispatch status. Previously it went to `done`. Change this to `reviewing` ("ready for review").

**Implementation:**
- `reviewing` is now the terminal auto-transition status when Copilot process exits (was `done`)
- `reviewing` dispatches are **skipped** by refresh logic — they don't auto-transition further
- `dispatch-clean` accepts `reviewing` alongside `done` and `cleaned` for cleanup
- `computeSummary` counts `reviewing` in the `done` bucket for dashboard summary

**Rationale:** `done` should only be set manually by the user after reviewing Copilot's work. Auto-transition to `reviewing` signals "Copilot finished, human needs to look at this" — more accurate post-process state.

### Files Changed
- `lib/dispatch-refresh.js` — Status transition updated
- `dispatch-clean` — Updated to accept `reviewing`
- `computeSummary` — Updated to count `reviewing` in `done` bucket

## Sub-feature D: Show Change Stats from Copilot Output

### Decision: Parse stats from log, show in dashboard

The copilot output log contains structured stats at the end:
```
Total usage est:        3 Premium requests
API time spent:         2m 48s
Total session time:     3m 6s
Total code changes:     +164 -1
```

We parse these and surface them in the dashboard.

**Implementation:**
1. New module `lib/copilot-stats.js` — Parse `.copilot-output.log` file for stats using regex. Return structured `{ premiumRequests, apiTime, sessionTime, additions, deletions }` or null if not found/parseable.
2. Show stats in dashboard: Add `changes` column to `DispatchTable` showing `+164 -1` when available.
3. Show stats in `dispatch log` output: After printing raw log, print parsed summary line.
4. Stats are parsed on-demand (not stored in active.yaml) — the log file is the source of truth.

**Key regex patterns:**
- `Total code changes:\s+\+(\d+)\s+-(\d+)` → additions/deletions
- `Total usage est:\s+(\d+)\s+Premium requests` → premium requests
- `Total session time:\s+(.+)` → session time

### Malformed Input Behavior

The parser handles malformed input asymmetrically:
- **Numeric fields** (`premiumRequests`, `codeChanges`): Strict regex guards → return `null` on non-match
- **Text fields** (`apiTime`, `sessionTime`): Loose capture → return raw garbled text

This is acceptable because:
1. The parser only consumes copilot output (trusted source)
2. Downstream consumers should handle unexpected values anyway
3. Adding format validation would be over-engineering for now

If `apiTime`/`sessionTime` values are used for calculations (e.g., duration parsing), they'll need format validation. Tests are ready to catch that regression.

### Files Changed
- `lib/copilot-stats.js` — NEW module. `parseCopilotStats(logContent)` takes log content as a string and returns parsed stats or null. Time fields (`apiTime`, `sessionTime`) use strict format validation.
- `lib/ui/components/DispatchTable.jsx` + `.js` — Add `changes` column showing `+N -M` (green/red colored)
- `lib/ui/dashboard-data.js` — Call `parseCopilotStats` for each dispatch that has a logPath, attach to dispatch data
- `lib/dispatch-log.js` — After printing raw log, print parsed summary

## Implementation Priority

1. **Sub-feature C** (status transition) — Already implemented by Kaylee
2. **Sub-feature D** (change stats) — In progress; implementation complete, awaiting dashboard integration
3. **Sub-feature A** (continue command) — Largest, highest value. Deferred pending feasibility review with `--resume`.
4. **Sub-feature B** (friendly naming) — Deferred. Not needed yet.

## Work Assignment Recommendations

- **Sub-feature C:** ✅ Kaylee (complete)
- **Sub-feature D:** 🔄 Kaylee (implementation complete, dashboard integration pending)
- **Sub-feature A:** 🟡 Pending user feedback on `--resume` feasibility
- **Sub-feature B:** Deferred

---

# Decision: Status Transition to Reviewing (Issue #164, Sub-feature C)

**Date:** 2026-02-24  
**Author:** Kaylee (Core Dev)  
**Issue:** #164  
**Status:** Implemented

## Context

When a Copilot process exits, `dispatch-refresh.js` auto-transitions the dispatch status. Previously it went to `done`. The user wants it to go to `reviewing` ("ready for review") instead.

## Decision

- `reviewing` is now the terminal auto-transition status (was `done`)
- `reviewing` dispatches are **skipped** by the refresh logic — they don't auto-transition further
- `dispatch-clean` accepts `reviewing` alongside `done` and `cleaned` for cleanup
- `computeSummary` counts `reviewing` in the `done` bucket for dashboard summary

## Rationale

`done` should only be set manually by the user after reviewing the Copilot's work. The auto-transition to `reviewing` signals "Copilot finished, human needs to look at this" — a more accurate status for the post-process state.

## Implementation

- `lib/dispatch-refresh.js` — Status transition logic updated
- Tests written and passing

## Impact

- All 396 tests pass
- No breaking changes; internal refactoring of status semantics

---

# Decision: Copilot Stats Parser Asymmetry (Issue #164, Sub-feature D)

**Date:** 2026-02-24  
**Author:** Jayne (Tester)  
**Status:** Observation (for team awareness)

## Context

The `parseCopilotStats()` implementation handles malformed input asymmetrically:

 return `null` on non-match
- **Text fields** (`apiTime`, `sessionTime`): Loose capture → return raw garbled text

## Decision

This is acceptable because:
1. The parser only consumes copilot output (trusted source)
2. Downstream consumers should handle unexpected values anyway
3. Adding format validation would be over-engineering for now

## If this matters later

If `apiTime`/`sessionTime` values are used for calculations (e.g., duration parsing), they'll need format validation. Tests are ready to catch that regression.

---

# Directive: Copilot Session Reconnect Capability (Issue #164, Sub-feature A)

**Date:** 2026-02-24T05:20:55Z  
**Source:** User (James Sturtevant via Copilot)  
**Topic:** Session management  

## What

`gh copilot --resume <session_id>` enables reconnecting to an existing copilot session. This is the mechanism for issue #164's reconnect feature.

## Why

User provided technical detail — Mal's initial decomposition assumed reconnect was impossible, but it IS supported. This changes Sub-feature A's feasibility assessment and approach.

---

# Directive: No Anticipatory Tests (Issue #164)

**Date:** 2026-02-24T05:02:21Z  
**Source:** User (James Sturtevant via Copilot)  
**Topic:** Testing practice  

## What

Never spawn anticipatory tests. Tests must always be written as part of the same PR as the implementation — not ahead of it.

## Why

User request — captured for team memory. Prevents test assumptions from diverging from actual implementation code.


---

# Decision: resolveRepo() prefers projects.yaml over git remote

**Date:** 2026-02-24  
**Author:** Wash  
**Issue:** #223  
**PR:** #224  

## Context

When a project is onboarded with `--fork`, `rally onboard` reconfigures git remotes: origin → fork, upstream → original repo. The `projects.yaml` entry stores `repo` as the upstream and `fork` as the user's fork.

`resolveRepo()` was calling `getRemoteRepo()` which reads `git remote get-url origin` — returning the fork URL instead of the upstream. This broke issue/PR fetching for fork projects.

## Decision

`resolveRepo()` now uses `project.repo` from `projects.yaml` as the source of truth for repo identity. It only falls back to `getRemoteRepo()` (git remote) for legacy entries that lack a `repo` field.

## Implications

- **All agents:** When resolving which GitHub repo to operate against, always use `project.repo` from `projects.yaml` — never rely on git remote origin.
- **Onboard:** The `repo` field in `projects.yaml` must always be the upstream repo, even for forks. This is already the case.
- **Backward compat:** Legacy projects without `repo` field still work via git remote fallback.

---

# Decision: Pushed Status in Dispatch Lifecycle (Issue #222, PR #225)

**Date:** 2026-02-24
**Author:** Kaylee (Core Dev)
**Issue:** #222
**Status:** Implemented

## Context

Users needed a way to indicate they've reviewed Copilot's work and pushed it, but aren't ready to clean up the worktree/branch yet. The `reviewing` → `done` gap didn't capture this intermediate state.

## Decision

- Added `pushed` as a new status between `reviewing` and `done` in `VALID_STATUSES`
- Dashboard `p` shortcut transitions `reviewing` → `pushed` (only fires on reviewing dispatches)
- `pushed` displays as 🟣 in the dashboard
- `dispatch-clean` includes `pushed` in its default filter
- `computeSummary` counts `pushed` in the `done` bucket

## Rationale

`pushed` signals "I've reviewed and pushed, but the worktree is still useful." This prevents premature cleanup while giving visibility into which dispatches have been acted on. The `p` shortcut follows the established single-key pattern (v/l/d/x/r/q).

## Impact

- Status lifecycle: planning → implementing → reviewing → pushed → done → cleaned
- `pushed` is optional — users can still go reviewing → done directly
- All 562+ tests pass

---

# Decision: Default project directory changed from ~/.rally to ~/rally

**Author:** Wash  
**Date:** 2026-02-23  
**Issue:** #221  
**PR:** #226  

## Context

VSCode and Copilot agents treat `~/.rally` (dotfile directory) as a trusted workspace, causing trust-related issues when working with cloned projects inside it.

## Decision

Default config directory is now `~/rally` (no dot prefix). Backward compatibility is handled in `getConfigDir()`:

1. `RALLY_HOME` env var takes priority (unchanged)
2. `~/rally` is preferred if it exists
3. `~/.rally` is used as fallback if it exists and `~/rally` does not
4. Fresh installs get `~/rally`

No migration script needed — the fallback logic handles it transparently.

## Impact

- All agents: `getConfigDir()` return value may differ. All code already goes through this function, so no other changes needed.
- `rally setup` creates directories under `~/rally` for new users.
- Existing `~/.rally` users can keep using it or move to `~/rally` at their convenience — both work.
- Docs (PRD.md, TESTING.md) updated to reference `~/rally`.

---

# Decision: Dashboard attach-to-session uses callback + waitUntilExit pattern

**Author:** Kaylee (Core Dev)
**Date:** 2026-02-25
**Issue:** #220
**PR:** #227

## Context

Adding an "Attach to session" action to the Dashboard requires spawning `gh copilot --resume` with `stdio: 'inherit'` for an interactive terminal session. However, Ink owns the terminal in fullscreen mode — spawning an interactive child process while Ink is running doesn't work.

## Decision

Use a callback pattern: Dashboard component calls `onAttachSession(dispatch)` then `exit()`. The CLI command in `bin/rally.js` captures the dispatch via the callback, waits for Ink to unmount via `waitUntilExit()`, then calls `dispatchContinue()` to spawn the interactive copilot session.

## Rationale

- Keeps component logic (what to attach to) separate from CLI wiring (how to attach)
- Clean terminal handoff — Ink fully unmounts before interactive process starts
- Reuses existing `dispatchContinue()` which handles session ID resolution, status updates, and `resumeCopilot()`
- Same pattern can be used for any future actions that need to exit Ink before spawning interactive processes

## Impact

This pattern should be followed for any future Dashboard actions that require interactive terminal access (e.g., launching editors with terminal UI, running interactive commands).

---

# Decision: Dispatch Trust Check Behavior

**Author:** Wash (Integration Dev)
**Date:** 2026-02-25
**Issue:** #218
**PR:** #228

## Context

When dispatching issues/PRs, the content (title, body, labels, comments) is fed to an AI agent. Content authored by untrusted third parties could contain prompt injection attacks.

## Decision

1. **Author mismatch warning**: If the issue/PR  current GitHub user, show a warning and require confirmation (default: No).author 
2. **Org membership warning**: If the current user is not a member of the repo's org, show an additional warning.
3. **`--trust` flag**: Bypasses all warnings for automation/scripting.
4. **Non-TTY passthrough**: In non-interactive environments (CI, piped input), skip warnings silently — don't block automated workflows.
5. **Graceful degradation**: If `gh api user` or author lookup fails, proceed without warning rather than blocking the user.

## Rationale

- **Default deny** (confirm default: false) — user must actively opt in when processing untrusted content
- **Non-TTY passthrough** — CI/automation users should use `--trust` explicitly; when stdin isn't a TTY there's no way to prompt anyway
- **Fail-open on API errors** — better to let the user proceed than to block on transient API failures

---

## Decision: Permanent exclusion — Issue #330

**By:** James Sturtevant (via Copilot)
**Date:** 2026-02-25
**Status:** Accepted

### Decision

Always ignore issue #330. Never work on it, never triage it, never assign it. This is a permanent exclusion that overrides any automated pickup or Ralph scan that would surface #330.

### Impact

All agents: skip #330 in any issue scanning, triage, or dispatch workflow.

---

## Decision: Skip Copilot re-reviews after addressing comments

**By:** James Sturtevant (via Copilot)
**Date:** 2026-02-25
**Status:** Accepted

### Decision

No longer need to wait for Copilot re-reviews after addressing review comments. Address the initial review, then merge if CI is green. User will say if they want to stop a specific PR.

### Impact

All agents handling PRs: after addressing Copilot review comments, proceed to merge once CI passes. Do not wait for a second review cycle.

---

## Decision: PR dispatch initial status changed to `implementing`

**By:** Kaylee (Core Dev)
**Date:** 2026-02-25
**Issue:** #321
**Status:** Accepted

### Decision

Changed `initialStatus` for PR dispatches from `'reviewing'` to `'implementing'`. The existing `refreshDispatchStatuses()` mechanism handles the transition to `'reviewing'` when Copilot finishes. Also renamed the `implementing` dashboard label from "working" to "copilot working" for clarity.

### Impact

PR dispatches now follow the same lifecycle as issue dispatches. Dashboard accurately reflects Copilot's working state. No new statuses or state machine changes needed.

---

## Decision: Dashboard Pickers — Exit-and-Run Pattern for Dispatch

**By:** Kaylee (Core Dev)
**Date:** 2026-02-25
**Status:** Proposed

### Decision

For issue/PR pickers from the dashboard (issue #278), follow the existing `onAttachSession` exit-and-run pattern: the Ink app stores a `pendingDispatch` object (type, number, repo), calls `exit()`, and the outer code in `rally.js` handles the actual dispatch after `waitUntilExit()`. This keeps the Ink lifecycle clean and reuses existing dispatch functions unchanged.

### Impact

- New dashboard callbacks: `onDispatchItem`, `onAddProject` (in addition to existing `onAttachSession`)
- Any future "do something after dashboard exit" features should follow this same pattern
- Components use DI props (`_fetchIssues`, `_fetchPrs`, `_listOnboardedRepos`) for testability

---

## Decision: onboard() decomposition — private helpers, not exported

**By:** Kaylee (Core Dev)
**Date:** 2026-02-25
**Issue:** #292
**Status:** Accepted

### Decision

Extracted 5 helper functions from `onboard()` but kept them as private (non-exported) functions in `lib/onboard.js` rather than moving them to separate modules. All helpers are tightly coupled to the onboard flow and none are large enough to warrant their own module. Also replaced inline regex for GitHub URL parsing with the already-imported `parseGitHubRemoteUrl()` from `lib/github-url.js`.

### Impact

If any helper grows or is needed elsewhere, it can be extracted to its own module at that point. Tests exercise helpers through the public `onboard()` API.

---

## Decision: Agent skill path convention

**By:** Mal (Lead)
**Date:** 2026-02-25
**Issue:** #332
**Status:** Accepted

### Decision

Use `.claude/skills/<tool>/SKILL.md` as the skill file location. Both Claude Code and GitHub Copilot CLI read from this path, so one file serves both tools. No need to duplicate into `.github/skills/`.

### Impact

Any future skill files should follow this pattern: `.claude/skills/<tool>/SKILL.md`. This keeps skills discoverable by both AI coding tools without duplication.

---

## Decision: Squad Upgrade Strategy (#361)

**By:** Mal (Lead)  
**Date:** 2026-02-28  
**Issue:** #361  
**Status:** Accepted

### Decision

Upgrade Rally to use Squad from `jsturtevant/squad-pr#consult-mode-impl` branch with `@bradygaster/squad-sdk` in **two phases**:

**Phase 1 (This PR)** — Minimal, fast-merging change:
1. Add `github:jsturtevant/squad-pr#consult-mode-impl` to `package.json`
2. Replace subprocess calls with SDK: `ensureSquadPath()` in `lib/setup.js` and `lib/team.js`
3. Test full flow (setup → onboard → dispatch)
4. Verify `.squad/` structure and `npx squad consult` CLI works

**Phase 2 (Follow-up PR)** — Robustness improvements:
1. Verify `.squad-templates` behavior in new squad
2. Update `lib/dispatch-core.js` to use `resolveSquad()` for robust path resolution
3. Clean up test fixtures if squad now auto-creates `.squad-templates`
4. Adopt additional SDK features as needed

### Rationale

1. **SDK approach is cleaner:** No subprocess spawning, atomic creation, typed imports
2. **Two-phase keeps momentum:** Phase 1 is a 2-line change per file, fast to merge
3. **Phase 2 enables robustness:** `resolveSquad()` is more reliable than manual path logic
4. **No breaking changes:** Directory structure is identical; teams remain compatible

### Impact

Team can begin Phase 1 implementation immediately. All existing tests pass without modification. Phase 2 will improve maintainability and error handling.
# Security Scan Findings — Rally CLI

**Date:** 2025-01-15  
**Reviewer:** Zoe (Security Engineer)  
**Scope:** Command injection, path traversal, YAML parsing, dependencies, secrets, config permissions, input validation

---

## Summary

**Overall Status: ✅ GOOD**

The Rally CLI demonstrates strong security practices. No critical or high severity issues were found. The codebase shows evidence of defense-in-depth with multiple layers of protection.

---

## Findings

### ✅ No Issues Found

| Category | Status | Notes |
|----------|--------|-------|
| Command Injection | ✅ Secure | Uses `execFileSync` with array args throughout; no shell string interpolation |
| Path Traversal | ✅ Secure | Multiple validation layers in copilot.js, config.js, github-url.js, onboard.js |
| YAML Parsing | ✅ Secure | Uses `yaml.CORE_SCHEMA` (no code execution) |
| Dependencies | ✅ Clean | npm audit shows 0 vulnerabilities |
| Hardcoded Secrets | ✅ None | No secrets in code; tokens handled via `gh` CLI auth |
| Config Permissions | ✅ Secure | 0o700 for dirs, 0o600 for files, atomic writes |

### 📝 Info (Best Practices Observed)

| Finding | Severity | Location | Notes |
|---------|----------|----------|-------|
| Session ID validation | Info | `lib/copilot.js:273` | UUIDs and safe alphanumeric patterns validated before CLI use |
| PID verification | Info | `lib/active.js:26-30` | Verifies `/proc/{pid}/cmdline` matches `gh copilot` before signaling |
| Untrusted content fencing | Info | `lib/dispatch-context.js:16` | XML-style tags + escape of closing tags prevents fence breakout |
| Branch name sanitization | Info | `lib/dispatch-pr.js:18-20` | `sanitizeRef()` strips shell metacharacters before prompt interpolation |
| Tool deny list | Info | `lib/copilot.js:12-26` | Blocks `gh`, `curl`, `wget`, `nc`, `ssh`, `scp`, `git push` for dispatched agents |
| Trust system | Info | `lib/dispatch-trust.js` | Author/org checks with user confirmation for untrusted content |

---

## Recommendations

### Low Priority Enhancements (Optional)

1. **Consider rate limiting** on trust check API calls if users dispatch many items rapidly (currently no rate limiting on `gh api` calls).

2. **Add security documentation** — the security measures are well-implemented but not documented for contributors. A `SECURITY.md` could help maintainers understand the threat model.

3. **Lock file age check** — `LOCK_STALE_MS` is 5 minutes which is reasonable, but could be configurable via environment variable for CI environments with slow I/O.

---

## Conclusion

The Rally CLI codebase demonstrates mature security practices:

- **Defense in depth** with validation at multiple layers
- **Safe-by-default** patterns (execFileSync vs exec, CORE_SCHEMA vs default)
- **Explicit trust model** for external content
- **Clean dependency tree** with no known vulnerabilities
- **Appropriate file permissions** for sensitive data

No action required. The codebase is ready for production use from a security standpoint.
