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
