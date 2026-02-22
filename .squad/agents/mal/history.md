# Project Context

- **Owner:** James Sturtevant
- **Project:** Dispatcher — a CLI tool that dispatches Squad teams to GitHub issues and PR reviews via git worktrees
- **Stack:** Node.js with curated npm packages (Ink, Chalk, Ora, Commander, js-yaml, @inquirer/prompts) + node:test for testing
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

### 2026-02-22 — Terminal UI/UX Specification (§5)

- **Hand-rolled ANSI UI:** Added comprehensive §5 to PRD specifying a zero-dependency terminal UI system. All components live in `lib/ui/` (replacing the single `lib/ui.js`), each a standalone module.
- **Brand palette:** Cyan primary, green success, red error, yellow warning, dim gray secondary. Status icons: ✓ ✗ ⚠ ● ◌ ◆. All via ANSI SGR codes.
- **Eight UI components specified:** colors.js (foundation + TTY detection), box.js (Unicode box-drawing panels), table.js (auto-width columns), spinner.js (braille-dot animation), progress.js (block-character bars), prompt.js (arrow-key selector), status.js (in-place \r overwrite), dashboard.js (alternate screen buffer full-screen layout).
- **Graceful degradation is mandatory:** Every component branches on `isTTY()`. Piped output gets plain text — no escape codes, no animation. Supports `NO_COLOR` and `FORCE_COLOR` env vars.
- **Dashboard uses alternate screen buffer:** `\x1b[?1049h/l` for full-screen without polluting scroll history. Keyboard navigation (↑↓ select, q quit, r refresh, c clean). Auto-refresh every 5s. Resize-responsive.
- **Module structure updated:** §4.3 now shows `lib/ui/` directory with all 9 component files instead of the single `ui.js`.
- **Sections renumbered:** Old §5–§8 became §6–§9 to accommodate the new section.

- **Subcommands replace flags:** `dispatcher dispatch issue <number>` and `dispatcher dispatch pr <number>` replace `dispatcher dispatch <number>` and `dispatcher dispatch --pr <number>`. Explicit subcommands make the CLI self-documenting and avoid ambiguity.
- **`--repo <owner/repo>` flag:** Both subcommands accept an optional `--repo <owner/repo>` flag. If omitted, the repo is inferred from cwd (if inside an onboarded project), from `projects.yaml` (if only one project), or errors with a helpful message if ambiguous.
- **Sections updated:** §3.3, §3.4, §4.2 Data Flow, Appendix A Command Summary — all now reflect the new syntax.

### 2026-02-22 — Dependency Pivot: Dropped Zero-Dep Constraint

- **Dependency pivot:** James directed us to use deps — specifically the same stack as Copilot/Claude CLIs. Adopted: Ink (v5+), Chalk (v5+), Ora, Commander, js-yaml, @inquirer/prompts, ink-table.
- **PRD §5 rewritten:** Terminal UI/UX section now describes Ink-based React component architecture instead of hand-rolled ANSI modules. Eight standalone modules replaced with Ink components (StatusMessage, DispatchBox, DispatchTable, ProgressSteps), Ora spinners, and @inquirer/prompts.
- **PRD §5.0 added:** New Dependencies section listing all npm packages with version constraints and rationale.
- **Module structure simplified:** `lib/ui/` now contains `App.jsx`, `Dashboard.jsx`, and `components/` directory with Ink React components instead of 9 standalone raw-ANSI modules.
- **Config parsing:** `config.js` now uses `js-yaml` instead of a custom YAML parser.
- **CLI parsing:** `bin/dispatcher.js` now uses Commander instead of manual `process.argv` parsing.
- **Technical constraints updated:** §8 Dependencies row updated from "zero runtime dependencies" to curated npm package list.
- **All zero-dep references removed** from PRD. Historical decision records in `.squad/decisions.md` preserved as-is for the record.

---

### 2026-02-22 — PRD Review Cycle Orchestration (All 4 Agents Complete)

- **Mal:** Architectural review found PRD coherent. Identified 3 stale zero-dep references in team docs (now fixed by Scribe).
- **Wash:** Git/GitHub integration feasibility review found 1 blocker (gh field names §3.3 vs §6.3) + 5 concerns + 2 nice-to-haves. Integration pattern is sound.
- **Kaylee:** CLI structure & UI review found CLI maps cleanly to Commander/Ink. 1 blocker (deps contradiction, now resolved) + 7 concerns + 4 nice-to-haves.
- **Jayne:** Testability & edge case review found 5 critical blockers in PRD §9 (open questions) + 12 error-handling gaps + 20+ edge cases. Test framework not specified.

**Critical Blockers Requiring Team Decision (Mal to schedule sync):**
1. **gh CLI field names** — §3.3 vs §6.3. For PRs, `files` vs `changedFiles` are semantically different. Must resolve before implementation.
2. **Windows symlink fallback** — §9.7 open. No strategy defined (hard error? junctions? copy? flag?).
3. **Squad invocation mechanism** — §9.1 open. Three options not decided (instructions vs CLI vs VS Code).
4. **Dispatch status lifecycle** — §9.2 open. Rules for status transitions not defined (who updates? when?).
5. **dispatch-context.md format** — §9.4 open. Format and schema undefined.

**Team Outcomes:**
- **Scribe:** Merged inbox decisions, updated stale team docs (stack refs), committed to `.squad/`
- **Mal:** PRD validated, dependency pivot approved, found stale docs needing updates. Next: Schedule decision sync on 5 blockers.
- **Kaylee/Wash:** Ready to implement once blockers resolved. Both awaiting decision sync.
- **Jayne:** Testability findings complete. Blocked on blocker resolution before writing test suite and `docs/TESTING.md`.

**Archive Progress:**
- `.squad/orchestration-log/2026-02-22T001900Z-{mal,wash,kaylee,jayne}.md` — created
- `.squad/log/2026-02-22T001900Z-prd-review.md` — session log created
- `.squad/decisions.md` — merged 5 inbox files, added PRD Review Findings section, deduped
- `.squad/decisions/inbox/` — all files deleted (merged)
- Agent history files updated with cross-agent context (Mal, Wash, Kaylee, Jayne)

### 2026-02-22 — Zero-Dependency Reference Cleanup (Complete)

Fixed all stale "zero-dependency" references across team documentation post-dependency pivot:

**Files updated:**
1. `.squad/team.md` — Stack now lists npm packages instead of "zero dependencies"
2. `.squad/agents/kaylee/charter.md` — "How I Work" section updated to reference production CLI stack; Voice section updated
3. `.squad/agents/jayne/charter.md` — Testing section updated to mention ink-testing-library alongside node:test
4. `.squad/agents/scribe/history.md` — Stack context updated
5. `.squad/skills/squad-conventions/SKILL.md` — Deprecated with note. This skill documents Squad (create-squad), not Dispatcher. Added redirect to Dispatcher-specific guidance.
6. `.squad/decisions.md` — Appended follow-up entry (append-only) documenting js-yaml superseding hand-rolled YAML parser from Decision #3

**Verification:**
- Full search of `.squad/` and `docs/` for "zero-dep", "zero dep", "hand-roll", "hand roll", "no dependencies", "zero dependencies" — no remaining stale references in active docs
- History files preserved as-is (historical records of the evolution)
- PRD.md already clean

**Record:** Created `.squad/decisions/inbox/mal-zero-dep-cleanup.md` with cleanup details.

## Orchestration Notes (2026-02-21T22:51)

- Scribe merged both Mal decisions into `.squad/decisions.md`
- Created orchestration log and session log
- Updated implementation agents (Kaylee, Wash, Jayne) with cross-agent context
- All squad/ changes committed
