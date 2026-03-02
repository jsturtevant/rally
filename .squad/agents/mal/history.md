# Project Context

- **Owner:** James Sturtevant
- **Project:** Rally — a CLI tool that dispatches Squad teams to GitHub issues and PR reviews via git worktrees
- **Stack:** Node.js with curated npm packages (Ink, Chalk, Ora, Commander, js-yaml, @inquirer/prompts) + node:test for testing
- **Created:** 2026-02-21

## Core Context

This history has been summarized. Earlier entries have been condensed into key learnings and decisions below. See the Learnings section for detailed context from ongoing work.

---

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### 2026-03-02 — Documentation Gaps After Recent Feature Releases

Analyzed recent PRs (#388, #387, #386, #384, #383, #345) against current docs site (`docs-site/src/content/docs/`) to identify documentation gaps.

**Key findings:**
1. **Squad SDK upgrade (#388)** — Major architectural change (consult mode, learning extraction) not documented. README updated but docs site has zero mention of SDK, consult mode, or how Squad integration works internally.
2. **Rally overview document (#387)** — Comprehensive vision/architecture doc added to `docs/rally-overview.md` but NOT published to docs site. Contains Rally Party vision (future orchestration system) that users should know about.
3. **`--disallow-temp-dir` flag (#345)** — New security feature (path isolation) documented in README but not in docs site security pages. Configuration setting `disallow_temp_dir` not in configuration reference.
4. **Dashboard keyboard shortcuts** — Inconsistency between README (correct shortcuts) and docs site quickstart/dashboard pages (outdated, mentions non-existent `c` shortcut).
5. **Dependencies upgraded (#383)** — Ink 6.x/React 19.x upgrade; no user-facing doc impact but good to note for troubleshooting.

**Documentation structure:** Docs site uses Astro/Starlight at `docs-site/src/content/docs/` with guides/, workflows/, security/, reference/ subdirectories. Non-site docs in `docs/` (PRD, rally-overview, testing) are internal/design docs.

**Priority order for docs updates:** (1) Rally overview/vision, (2) Security features (disallow-temp-dir), (3) Squad integration explanation, (4) Keyboard shortcuts sync, (5) Configuration reference additions.

### 2026-02-22 — Team Reviewer PR Review Process Finalized

**Directive received (2026-02-22T171200Z):** Mal (Lead) must conduct mandatory code review on every PR in addition to Copilot's automated review. Both reviews must complete, all comments must be addressed (fix or explain), out-of-scope feedback opens GitHub issues with optional @copilot assignment.

**Deliverables completed:**
1. Updated `.squad/decisions/inbox/mal-pr-review-skill-outline.md` to incorporate:
   - NEW section 1.6: Understanding dual-review process (Copilot + Mal)
   - NEW section 2.4: Team Reviewer (Mal) workflow — pulling diff, reading context, posting comments, enforcing "address or explain"
   - NEW section 2.5: Out-of-scope comment handling (open issues, @copilot assignment)
   - NEW section 3.5: Mal's approval decision (when to approve, when to request changes)
   - Updated section 3: Clarified both reviewers apply (all comments from both must be addressed)
   - Updated section 4: Dual-gate merge requirement (CI green + both approvals + all comments addressed)
   - NEW section 6.2: Mal's team reviewer commands (gh pr diff, gh pr review, gh pr comment)
   - NEW section 6.5: Out-of-scope issue handling commands

2. Created `.squad/skills/pr-review-process/SKILL.md`:
   - Formalized from outline using rally-design-checklist as format template
   - Confidence: "medium" (Phase 3 will validate; bump to high after dispatch PRs complete)
   - Covers all patterns, key commands, Phase 2 examples, acceptance criteria, validation plan
   - Includes both agent responsibilities and Mal's team reviewer responsibilities

**Key patterns formalized:**
- Dual-review gate: Copilot automatic + Mal manual (both required for merge)
- "Address or explain" rule: ZERO unaddressed comments allowed (hard policy)
- Out-of-scope handling: Opens GitHub issue, optionally assigns @copilot, replies in review thread
- Merge gate three-fold: CI green + both approvals + all comments addressed
- Revision workflow: Original author cannot self-revise (different agent picks up if Mal requests changes)

**Commands documented:**
- Mal's review commands: `gh pr diff <number>`, `gh pr review <number> --approve/--request-changes`, `gh pr comment <number>`
- Line-level comments: Posted via web UI (gh CLI limitation; workaround documented)
- Out-of-scope issue creation: `gh issue create --title "..." --body "..." --repo jsturtevant/rally`

**Validation plan:** Phase 3 dispatch PRs (#14–#19) will test dual-review process. Retrospective after Phase 3 will refine skill for v2.0 (high confidence).

### 2026-02-21 — PRD Draft

- **PRD location:** `docs/PRD.md` — comprehensive, covers all 5 commands with CLI examples, error cases, state layout, and open questions.
- **Architecture decision:** Three JSON config files under `~/.rally/` — `config.json` (global setup), `projects.json` (onboarded repos), `active.json` (active dispatches). Simple, zero-dep, file-based state.
- **Module structure:** `bin/rally.js` entry point + `lib/` modules per command + shared utilities (`config.js`, `symlink.js`, `exclude.js`, `worktree.js`, `github.js`, `ui.js`).
- **Core pattern:** Tamir Dresher's symlink + `.git/info/exclude` technique is the foundation of `onboard`. Exclude entries apply to all worktrees — set up once.
- **Worktree convention:** `.worktrees/rally-<issue>/` inside the repo. Branch naming: `rally/<issue>-<slug>`.
- **Open questions logged in PRD §8:** Squad invocation method, per-project vs shared team, worktree location, Windows symlink fallback, Squad export/import integration.
- **User preference:** James wants zero dependencies, `node:test`, Windows/macOS/Linux support — same constraints as Squad itself.

### 2026-02-21 — PRD Target User & CI/CD Corrections

- **Target users (from James):** Individual developers using Squad on projects where the rest of the team doesn't use Squad. Examples: open source projects, large shared repos where committing `.squad/` isn't appropriate. This is NOT for teams adopting Squad together — it's for one person using Squad on a shared repo.
- **No CI/CD (from James):** There will be no CI/CD integration for Rally. No GitHub Actions triggers, no pipeline integration. Removed from PRD §2 and §6.

### 2026-02-21 22:47 — Config format: YAML not JSON (completed)
- Updated `docs/PRD.md` to use YAML for all config files
- Filed decision on hand-rolled YAML parser requirement
- All agents notified via history propagation

### 2026-02-22 — Onboard Command Expansion (§3.2)

- **GitHub URL support:** `rally onboard` now accepts `https://github.com/owner/repo` or `owner/repo` shorthand. Clones into configurable `projectsDir` (default: `~/.rally/projects/`).
- **Configurable projects directory:** New `projectsDir` key in `config.yaml`. Set during `rally setup`.
- **Team selection prompt:** At onboard time, user chooses shared team (`~/.rally/team/`) or project-specific team (`~/.rally/teams/<project>/`). Scriptable with `--team <shared|new>`.
- **projects.yaml expanded:** Each project entry now includes `team` (shared/project) and `teamDir` (absolute path to the team directory used).
- **State layout expanded:** `~/.rally/` now includes `teams/` (project-specific team dirs) and `projects/` (cloned repos).
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

- **Subcommands replace flags:** `rally dispatch issue <number>` and `rally dispatch pr <number>` replace `rally dispatch <number>` and `rally dispatch --pr <number>`. Explicit subcommands make the CLI self-documenting and avoid ambiguity.
- **`--repo <owner/repo>` flag:** Both subcommands accept an optional `--repo <owner/repo>` flag. If omitted, the repo is inferred from cwd (if inside an onboarded project), from `projects.yaml` (if only one project), or errors with a helpful message if ambiguous.
- **Sections updated:** §3.3, §3.4, §4.2 Data Flow, Appendix A Command Summary — all now reflect the new syntax.

### 2026-02-22 — Dependency Pivot: Dropped Zero-Dep Constraint

- **Dependency pivot:** James directed us to use deps — specifically the same stack as Copilot/Claude CLIs. Adopted: Ink (v5+), Chalk (v5+), Ora, Commander, js-yaml, @inquirer/prompts, ink-table.
- **PRD §5 rewritten:** Terminal UI/UX section now describes Ink-based React component architecture instead of hand-rolled ANSI modules. Eight standalone modules replaced with Ink components (StatusMessage, DispatchBox, DispatchTable, ProgressSteps), Ora spinners, and @inquirer/prompts.
- **PRD §5.0 added:** New Dependencies section listing all npm packages with version constraints and rationale.
- **Module structure simplified:** `lib/ui/` now contains `App.jsx`, `Dashboard.jsx`, and `components/` directory with Ink React components instead of 9 standalone raw-ANSI modules.
- **Config parsing:** `config.js` now uses `js-yaml` instead of a custom YAML parser.
- **CLI parsing:** `bin/rally.js` now uses Commander instead of manual `process.argv` parsing.
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
5. `.squad/skills/squad-conventions/SKILL.md` — Deprecated with note. This skill documents Squad (create-squad), not Rally. Added redirect to Rally-specific guidance.
6. `.squad/decisions.md` — Appended follow-up entry (append-only) documenting js-yaml superseding hand-rolled YAML parser from Decision #3

**Verification:**
- Full search of `.squad/` and `docs/` for "zero-dep", "zero dep", "hand-roll", "hand roll", "no dependencies", "zero dependencies" — no remaining stale references in active docs
- History files preserved as-is (historical records of the evolution)
- PRD.md already clean

**Record:** Created `.squad/decisions/inbox/mal-zero-dep-cleanup.md` with cleanup details.

### 2026-02-22 — Retrospective: PRD Design Phase

**Ceremony facilitated.** Full retro written. Key findings:

**What Went Well:**
- PRD is internally consistent, no contradictions
- Dependency pivot was decisive, cleared analysis paralysis
- Stale docs caught and fixed (zero-dep references)
- Full team review cycle completed, all 4 agents reviewed
- Target user clarified (solo dev on shared repos)

**What Didn't Go Well:**
- 5 critical blockers remain in PRD §9 (gh fields, Windows symlinks, Squad invocation, status lifecycle, dispatch-context format)
- 12 error-handling gaps identified
- Test framework strategy not specified (no `docs/TESTING.md`)
- Some design decisions were iterative (JSON→YAML, flags→subcommands, onboard expansion)

**Action Items:**
1. Mal to schedule 30-min blocker resolution sync today (Wash, Kaylee, Jayne)
2. After sync, Mal updates PRD §9 resolutions in `docs/PRD.md`
3. Jayne owns `docs/TESTING.md` + error catalog post-blockers
4. Kaylee/Wash proceed with implementation after blocker resolution

**Retro artifact:** `.squad/decisions/inbox/mal-retro-design-phase.md`

## Orchestration Notes (2026-02-21T22:51)

- Scribe merged both Mal decisions into `.squad/decisions.md`
- Created orchestration log and session log
- Updated implementation agents (Kaylee, Wash, Jayne) with cross-agent context
- All squad/ changes committed

### 2026-02-22 — PRD Decomposition into Work Items

Decomposed `docs/PRD.md` into 28 implementation work items across 5 phases:

**Phase 1 (Foundation):** 8 items — scaffold, config utilities, symlink, exclude, worktree, github wrapper, CLI entry point, basic tests
**Phase 2 (Core Commands):** 5 items — setup command, onboard command (w/ GitHub URL + team prompt), status command
**Phase 3 (Dispatch):** 6 items — dispatch core, issue mode, PR mode, context writer, Squad invocation, active registry
**Phase 4 (Dashboard):** 5 items — Ink components, dashboard layout, keyboard nav, clean subcommand, non-TTY fallback
**Phase 5 (Polish):** 4 items — error catalog, edge case handling, docs, final integration tests

**Blocking open questions (my recommendations):**
1. **Squad invocation (§9.1):** Option A — print instructions, don't invoke. Keeps Rally decoupled from editors.
2. **Windows symlinks (§9.7):** Hard error with Developer Mode guidance. No fallback in v1.
3. **Dispatch context format (§9.4):** Simple markdown template with issue/PR metadata and instructions.

**Non-blocking open questions:** Worktree location (keep inside repo), status tracking (keep 5 statuses, manual), dashboard clean (worktree only, no branch delete).

**PRD inconsistency:** §3.3 vs §6.3 gh field names differ — use §6.3 as authoritative.

**Key insight:** Phase 1 utilities can all be built in parallel. Phase 3 serializes. Phase 4 can mostly parallelize once dispatch works.

Decision filed: `.squad/decisions/inbox/mal-prd-decomposition.md`

### 2026-02-22 — Project Rename: Dispatcher → Rally

Executed comprehensive project rename per James Sturtevant's directive.

**Changes made:**

1. **`docs/PRD.md`** — Complete document update:
   - Title: "Dispatcher" → "Rally"
   - All CLI commands: `dispatcher setup` → `rally setup`, `dispatcher dispatch` → `rally dispatch`, `dispatcher dashboard` → `rally dashboard`
   - All file paths: `~/.dispatcher/` → `~/.rally/`, including config files, team directories, projects directory
   - All branch naming: `dispatcher/<issue>` → `rally/<issue>`
   - All worktree paths: `.worktrees/dispatcher-*` → `.worktrees/rally-*`
   - UI copy: "Dispatcher Dashboard" → "Rally Dashboard", "Dispatcher CLI" → "Rally CLI"
   - All technical references updated to use "Rally" as project name

2. **Team documentation:**
   - `.squad/agents/mal/history.md` — Updated all project references
   - `.squad/agents/kaylee/history.md` — Updated all project references
   - `.squad/agents/wash/history.md` — Updated all project references
   - `.squad/agents/jayne/history.md` — Updated all project references
   - `.squad/agents/scribe/history.md` — Updated all project references
   - `.squad/identity/now.md` — Updated project focus description
   - `.squad/skills/squad-conventions/SKILL.md` — Updated deprecated skill references to Rally

3. **Historical logs (for team context):**
   - `.squad/log/*.md` — Updated all orchestration logs
   - `.squad/orchestration-log/*.md` — Updated all orchestration logs
   - `.squad/decisions/inbox/*.md` — Updated directive files

4. **Preserved (append-only):**
   - `.squad/decisions.md` — NOT edited. Old decisions referencing "Dispatcher" remain as historical records per team policy (append-only decision log).

**Key distinctions maintained:**
- ✓ "dispatch" as a VERB/COMMAND NAME kept intact (e.g., "dispatch issue", "dispatch command")
- ✓ Project name consistently changed: "Dispatcher" → "Rally" (capitalized), "dispatcher" → "rally" (lowercase)
- ✓ CLI command consistently changed: `dispatcher` → `rally`
- ✓ File paths consistently changed: `~/.dispatcher/` → `~/.rally/`

**Verification:**
- `docs/PRD.md`: 27 occurrences of "Rally", 144 occurrences of "rally" (total 171 project name references)
- All team docs and logs updated
- Decisions.md preserved with historical context intact

### 2026-02-22 — Retrospective: Planning & PRD Decomposition Phase Complete

Facilitated full team retro on planning phase (PRD design through GitHub issue decomposition).

**What Went Well:**
- PRD is architecturally sound and internally consistent
- Dependency pivot (Ink/Chalk/Ora/Commander) was decisive and cleared analysis paralysis
- Full team review cycle found blockers early (better than code review)
- Stale docs caught and fixed before implementation started
- Decomposition into 29 GitHub issues is concrete and ready for sprint planning

**What Didn't Go Well:**
- 5 critical blockers sat in PRD §9 until day 2 (should have been pre-resolved)
- Iterative design added churn (JSON→YAML, flags→subcommands, onboard scope expansion)
- Test framework spec not written before implementation start (unblocks Jayne)
- Onboard command grew scope mid-phase (GitHub URLs, projects dir, team selection)
- gh CLI field inconsistency (§3.3 vs §6.3) slipped through validation

**What Should We Change:**
1. Pre-review blocker resolution checklist — resolve open questions with James upfront, don't wait for team review
2. Earlier engagement with James on iterative decisions — 15-min design sync before locking PRD
3. Test framework spec is prerequisite, not follow-up — Jayne needs `docs/TESTING.md` to unblock implementers
4. Validate PRD against real gh CLI output before team review — prevent field name surprises
5. Scope Phase 2 more carefully — Onboard grew significantly; be explicit about core vs nice-to-have

**Action Items:**
- Mal: Resolve open blockers #4–#5 by EOD 2026-02-22, update PRD §9, commit
- Jayne: Write `docs/TESTING.md` + error catalog by 2026-02-23
- Kaylee/Wash: Begin Phase 1 implementation once blockers resolved, parallelize utilities
- Mal (future): Document "Design Phase Checklist" for team SOP

**Retro artifact:** `.squad/decisions/inbox/mal-retro-planning-phase.md`

**Key Learning:** Blockers should be resolved upfront with stakeholder sync, not discovered during team review. Earlier validation (gh CLI, feature scope) saves iteration cost. Test framework spec unblocks implementers earlier. Next phase will be smoother with these process adjustments.

### 2026-02-22 — Retrospective: Phase 1 Implementation Sprint — Process Failure

Facilitated critical process failure retro. **All Phase 1 code was committed directly to main instead of via feature branches and PRs.**

**What Went Wrong:**
- All 5 commits in Phase 1 landed on `main` branch, no feature branches
- Zero PRs created; CI workflow exists but was never triggered
- Mal never reviewed code, Jayne never reviewed tests
- Issues #2–#8 still open despite code being in main (issue/commit decoupling)
- 5 agents worked in parallel on same branch with no review gate

**Root Cause:**
Coordinator's task instructions to agents said "implement feature X" without explicitly requiring feature branches, PRs, or code review. Agents defaulted to simplest path (direct `git commit`). No gate prevented it. Mal didn't validate workflow upfront.

**Contributing Factors:**
- Solo dev project feels informal; typical team workflows weren't enforced
- Agents are autonomous; once they have commit access, they use it
- CI workflow exists but no PR triggers it (no automated quality gate)
- Onboarding gap: agents weren't shown what "correct" workflow looks like

**Proposed Solution: Option C (Parallel Worktrees per Agent)**
- Each agent gets their own worktree + feature branch for their assigned issues
- Agents work simultaneously on separate branches (zero conflict risk)
- All commits go to feature branches, not main
- Each agent opens a PR (feature → main), waits for Mal review + CI gate
- Mal reviews in dependency order, merges after approval
- GitHub auto-closes linked issues when PR merges
- Process discipline: no direct main commits, no merges without review

**Why This Works:**
- Explicit instructions + worktree setup removes "should I branch?" ambiguity
- Worktrees enable true parallelism (5 agents simultaneously)
- Review bottleneck is OK (Mal handles sequential reviews; CI waits anyway)
- Transparency: all PRs visible on GitHub
- Quality gate: CI must pass, tests must exist, review must approve

**Action Items:**
1. Mal: Write Phase 2 dispatch plan (assign issues, specify branch names, call out deps)
2. Mal: Create Rally Development Workflow skill document
3. Coordinator: Set up worktrees for Phase 2 agents before sprint starts
4. Mal: Update agent instructions to include workflow steps (branch → commit → push → PR → wait → merge)

**Key Learning:** Explicit workflow instructions matter. Agents are smart but not telepathic. If you want PRs, you must say "create a PR" in the task steps. Worktrees solve parallelism cleanly. Review bottleneck is acceptable for small teams. Process > hope.

**Retro artifact:** `.squad/decisions/inbox/mal-retro-phase1-process.md`

### 2026-02-22 — Team Notification: Project Scaffold Complete

**From Scribe (cross-agent update):**

Decision inbox merged into `decisions.md`. Key updates:
- Retrospective on planning phase documented and merged
- Testing & code review directive from user documented (mandatory PR tests, CI, code review before merge)
- All 5 critical blockers resolved (by user directive 2026-02-22 01:13)

**Team Status:**
- ✓ Mal (Lead): Design phase complete, blockers resolved, retro documented
- ✓ Wash (Integration Dev): PRD review findings merged, gh/git integration documented
- ✓ Kaylee (Core Dev): PRD decomposition complete, 29 GitHub issues created, Phase 1 ready
- ✓ Jayne (Tester): Blocker resolutions enable test suite + TESTING.md work

**Ready for implementation phase.** Kaylee can begin Phase 1 foundation modules (parallel development across utilities). Jayne owns test infrastructure + error catalog (unblocked by blocker resolutions).


### 2026-02-22 — PRD §9 Resolution Documentation & Design Checklist Skill

Completed two deliverables from the planning phase retro:

**1. Updated `docs/PRD.md` §9 with all 5 blocker resolutions:**
- §9.1 (Squad invocation): Automated CLI invocation. Rally launches Copilot CLI automatically with appropriate prompt, captures session ID.
- §9.3 (Worktree location): Inside repo at `.worktrees/rally-<issue>/` (confirmed as default, no change needed).
9.4 (dispatch-context.md format): Simple markdown template with issue/PR metadata and instructions. Squad parses markdown natively.- 
- §9.5 (Status tracking): Automatic transitions. `dispatch` → `planning`, invocation → `implementing`, PR creation → `reviewing`, merge → `done`, clean → `cleaned`.
- §9.7 (Windows symlinks): Hard error with "Enable Windows Developer Mode" message. No junctions or fallback in v1.

Also fixed §6.3: Changed `changedFiles` to `files` in gh PR view JSON field reference (standardized per actual gh CLI output).

**2. Created `.squad/skills/rally-design-checklist/SKILL.md`:**
Documented the five patterns from the retro:
- Resolve blockers upfront with stakeholder before team review
- Engage stakeholder early on iterative decisions (15-min sync before locking decisions)
- Validate PRD assumptions against real CLI output (test gh fields, git commands early)
- Write test framework spec during design, not after (unblocks implementers)
- Scope features explicitly (core vs nice-to-have, prevent scope creep)

Includes examples from Rally (what we did right, what we should have done) and anti-patterns.

**Outcome:** PRD is now comprehensive and unambiguous. All blocker resolutions documented and committed. Design phase checklist is institutional knowledge for future projects.

### 2026-02-22 — Retrospective: Phase 2 Implementation Sprint — Workflow Success

Facilitated Phase 2 retro (issues #9–#13, PRs #30–#34).

**What Went Right:**
- **Workflow discipline restored.** All 5 PRs used feature branches (`rally/9-setup`, `rally/10-onboard`, `rally/11-url-onboard`, `rally/12-team-selection`, `rally/13-status`). Zero direct commits to main. 180° improvement from Phase 1's complete failure.
- **Code review as quality gate worked.** 8 review cycles across 5 PRs. Mal reviews caught real issues: Node 18 API incompatibility (PR #30), path traversal security (PR #33), partial state bug (PR #34), interactive prompt unreachable (PR #34).
- **All acceptance criteria verified in review before merge.** 52 test cases written covering 4 features (setup, onboard, status) + test files and integration tests included.
- **CI validation on every PR.** Node 18/20/22 compatibility tested. Squad CI included. Zero CI failures on final merges.
- **Copilot review provided value.** PRs #32 and #33 had Copilot comments (7 + 13 respectively); all were addressed before merge.

**What Didn't Go Well:**
- **Interactive behavior validation incomplete initially.** PR #34's team selection prompt was unreachable in production (gated by test-only hook). Caught in second review → fixed → re-approved. Shows that interactive behavior needs end-to-end testing.
- **@copilot not consistently added as reviewer.** Copilot reviewed some PRs but not all. Process gap: should be mandatory gate.
- **Edge case review was lucky, not systematic.** Path traversal and trailing slash bugs (PR #33) weren't enumerated upfront. Caught by reviewer's security mindset, not by a checklist.
- **docs/TESTING.md not written yet.** Unblocks Phase 3 but is a follow-up item from Phase 1 retro.

**Key Insights:**
1. Explicit workflow instructions matter. Agents need step-by-step directions (branch → commit → push → PR → wait → merge), not "implement feature X."
2. Feature branches + worktree approach enables true parallelism (5 agents, 5 branches, zero conflicts).
3. Acceptance criteria as test names is a good practice; keeps review honest.
4. Interactive behavior is hard to verify from code; needs TTY testing or end-to-end validation.
5. Reviewer diligence > automated tools. Mal's specific, actionable reviews caught all real issues.

**Process Improvements for Phase 3:**
1. **Copilot review is mandatory.** Add `@copilot` to all Phase 3 PRs. If Copilot comments, they must be addressed (like human review).
2. **Interactive testing checklist.** For dispatch command (heavily interactive), add pre-review validation: "Test this end-to-end with a real TTY."
3. **Edge case checklist.** Before Phase 3, enumerate dispatch edge cases (aborted invocation, network errors, worktree conflicts, Squad state corruption) and include in review template.
4. **Dispatch context spec.** Write format spec with James before Kaylee codes (takes 15 min, prevents rework).

**Action Items:**
- Mal: Create `.squad/skills/interactive-testing/SKILL.md` for Phase 3
- Mal: Create edge-case review checklist for dispatch commands
- Jayne: Write `docs/TESTING.md` (unblocked by Phase 1 blocker resolutions)
- Mal: Verify dispatch context format with James before Phase 3 kickoff

**Retro artifact:** `.squad/decisions/inbox/mal-phase2-retro.md`

### 2026-02-22 — PR Review Process Skill Design (Complete)

Designed comprehensive "PR Review Process" skill for the team based on Phase 2 actual workflow (PRs #30–#34) and post-implementation retro findings.

**Skill scope:**
1. **PR Creation** — branch naming (`rally/<issue>-<slug>`), commit message format (`Closes #X`, Co-authored-by trailer), PR description template (changes/acceptance criteria/test results), issue linking, reviewer setup (Copilot auto + Mal manual)
2. **Waiting for Review** — Copilot's automatic run (2–5 min), polling pattern (check every 5–10 min), reading Copilot comments, what to look for (security, Node compat, error handling, edge cases, TTY handling)
3. **Responding to Review Comments** — read all before responding, address each individually, commit/push strategy, reply in GitHub threads with evidence, re-request review after fixes
4. **Review Approval & Merge** — verify CI green (4 checks: Node 18/20/22 + Squad CI), verify acceptance criteria with test count evidence, merge strategy (squash + merge), auto-close linked issues
5. **Review Rejection Workflow** — coordinator enforces lockout (original author can't self-revise), different agent picks up revision, branch strategy for minor vs major fixes, hand-off context, Phase 2 experience (zero rejections but policy still defined)

**Grounded in real Phase 2 data:**
- PR #32 (Onboard): Copilot 7 comments → Wash fixed all in one commit, Mal approved
- PR #34 (Team Selection): Initial feedback (interactive prompt unreachable + partial state bug) → Wash pushed fixes → Mal re-reviewed → Copilot approved
- All 5 PRs used feature branches (`rally/<issue>-<slug>`), squash+merge, auto-closed issues
- All 5 PRs had Node 18/20/22 + Squad CI green before merge

**Key learnings incorporated:**
1. Acceptance criteria as checklist in PR description (works, verified in all 5 PRs)
2. Copilot reviews must be mandatory (policy change for Phase 3+)
3. Interactive behavior validation incomplete initially (TTY testing gap identified)
4. Edge case enumeration should be pre-review, not luck (added to skill as Copilot comment patterns)
5. Coordinator role must enforce "different agent revises" (rare in Phase 2, but policy needed)

**Artifact:** `.squad/decisions/inbox/mal-pr-review-skill-outline.md` — 19KB outline, ready for team review and formalization into SKILL.md

**Status:** Awaiting team review before finalizing SKILL.md

### 2026-02-22 — PR #36 Review: active.yaml dispatch tracking (#19)

**Verdict:** Approved. Clean, well-structured module with correct atomic write pattern and comprehensive tests (19 tests).

**Review findings:**
- `lib/active.js` correctly implements CRUD with atomic writes (temp+rename), matching the decision doc
- Record schema matches issue #19 spec exactly
- Validation covers required fields, type enum, status enum, duplicate ids
- Tests cover happy paths, error paths, and edge cases
- Reuses `readActive()` and `getConfigDir()` from config.js — good composability

**Observations flagged (non-blocking):**
1. `writeActive()` still exported from config.js — bypass risk for downstream consumers (#15, #16). Should deprecate or remove in follow-up.
2. No `updated` timestamp on status changes — dashboard (#16) may need this later.

**Quality notes:**
- Error messages are clean and user-facing (include invalid value + valid options)
- Test isolation via RALLY_HOME env var override is the right pattern
- `makeRecord()` helper in tests keeps them DRY
- CI green on all Node versions

### 2026-02-22 — PR #35 Review (dispatch.js core module, issue #14)

**Verdict:** Approve ✅ — posted as comment (can't self-approve via API since James owns the repo).

**Acceptance criteria:** All 4 met. `resolveRepo()` handles --repo flag, cwd detection, single-project fallback, and clear ambiguous-repo errors. Resolution priority order is correct and tested.

**Code quality observations:**
- dispatch.js follows established patterns perfectly: ES modules, `execFileSync` with arrays, `path.resolve`, js-yaml via config.js
- DI via `_exec` injectable for testing — good pattern, consistent with how we test git operations
- Error messages are user-facing with actionable guidance ("Run: rally onboard", "Use --repo owner/repo")
- No security issues — no shell strings, no unsanitized input
- API surface `{ owner, repo, fullName, project }` is clean and composable for #15/#16/#17

**Items flagged (non-blocking):**
1. **Scope creep:** `lib/active.js` + tests are not part of issue #14. Well-written but should be tracked under a separate issue or #19. Clean issue-to-PR traceability matters.
2. **writeActiveAtomic duplication:** active.js introduces atomic writes (temp file + rename) but config.js already has `writeActive()` doing direct writes to the same file. Two competing write functions for active.yaml. Must consolidate before downstream PRs consume active.js.

**Patterns noted for future reviews:**
- `resolveRepo` matches --repo flag by project `name` only (ignores owner for lookup). Conscious design choice — owner comes from the flag, project comes from projects.yaml by name match.
- `findProjectByCwd` hardcodes `process.cwd()` (not injectable). Tests use `process.chdir()` as workaround. Acceptable but worth noting if cwd injection becomes needed later.
- Copilot review was clean — only flagged a placeholder timestamp in SKILL.md.

### 2026-02-23 — Retrospective: Phase 4–5 Sprint (Dashboard + Polish) — Process Failure #2

Facilitated critical retro on Phase 4–5 sprint (issues #23, #25, #26, #27, #28, #29, #41; PRs #44–#49).

**What Went Wrong:**
1. **CI hung 55 minutes** — three independent causes: Dashboard tests missing `unmount()` cleanup, `onboard-url.test.js` triggering credential prompts in CI, `renderPlainDashboard()` exported but undefined in compiled output.
2. **Node 18 dropped** — `--test-force-exit` flag doesn't exist in Node 18, broke CI. Band-aid for the real problem (tests not cleaning up).
3. **PR #49 merged with 3 unresolved Copilot comments** — README has wrong commands (`rally dispatch <issue#>` should be `rally dispatch issue <number>`, `rally clean` should be `rally dashboard clean`), TESTING.md says "two passes" but lists three steps. Comments were never read.
4. **E2E tests are fake** — all 13 tests in `e2e.test.js` use mocked `_exec`. None invoke `bin/rally.js`. This is integration testing, not E2E.
5. **Speed over quality** — coordinator merged without reading reviews, bulk-resolved threads, committed agent output without inspection.

**Root Causes:**
- RC-1: Review gates are advisory, not enforced (no branch protection)
- RC-2: No test cleanup/isolation standards (some tests clean up, some don't)
- RC-3: "E2E" label is wrong (DI mocks ≠ end-to-end)
- RC-4: No accountability mechanism for merge quality (coordinator self-merges)

**Key Action Items:**
1. Enable GitHub branch protection on `main` (require approval + CI) — P0
2. Fix `DispatchTable.test.js` missing cleanup — P0
3. Fix 3 documentation errors from PR #49 comments — P1
4. Rename `e2e.test.js` → `integration.test.js`, create real CLI E2E tests — P1
5. Update `docs/TESTING.md` with cleanup requirements — P1
6. Add merge checklist to PR review skill — P2

**Key Learning:** This is the second process failure retro (first was Phase 1 direct-to-main commits). The pattern is clear: documented process without enforcement gets bypassed under velocity pressure. Branch protection is structural enforcement. Behavioral rules alone don't work. The "address or explain" policy must be backed by GitHub's "require conversation resolution" setting.

**Retro artifact:** `.squad/decisions/inbox/mal-retro-findings.md`

### 2026-02-23 — Comprehensive Code Quality Audit

**Full codebase review completed.** Reviewed all files in bin/, lib/, lib/ui/, test/, test/ui/.

**Critical findings (4):**
1. `dashboard clean` error handler bypasses `handleError()` and the exit-code system — inconsistency with every other command
2. `lib/dispatch-issue.js` has a TODO for worktree cleanup on failure — orphaned worktrees are a real data-loss vector
3. `lib/tools.js` uses `which` — breaks on Windows (stated target platform)
4. `yaml.load()` without explicit schema — safe with js-yaml v4 but undocumented intent

**Important findings (7):**
1. `writeDispatchContext()` in dispatch-issue.js is superseded by dispatch-context.js but still used — issue dispatches get a different, older markdown format than PR dispatches
2. Inconsistent worktree collision handling: issues return early, PRs throw
3. `writeActive()` in config.js bypasses atomic writes from active.js
4. `checkGhInstalled()` and `checkGhAuth()` in github.js are dead code — never called
5. Duplicated onboarding validation in dispatch-issue.js and dispatch-pr.js
6. Compiled .js and source .jsx both checked in — sync risk
7. `dispatch issue` and `dispatch pr` CLI subcommands not registered in Commander — core functionality has no CLI entry point

**Security: Clean.** No hardcoded secrets. All subprocess calls use `execFileSync` with argument arrays (no shell injection). `parseGithubUrl` correctly blocks path traversal.

**Key architectural observation:** The codebase has good DI patterns (injectable `_exec`, `_spawn`, `_select`) and solid test coverage. The main debt is around the dispatch commands where issue and PR paths diverged during implementation — they need to be reconciled.

**Artifact:** `.squad/decisions/inbox/mal-code-review.md`

### 2026-02-23 — Five-Round Review Cycle Complete

**Role:** Lead Reviewer / Issue Triage

**Outcome:** All 26 code review findings addressed and merged. Codebase clean.

**Work:**
- Conducted comprehensive code quality audit (26 findings across 4 severities)
- Triaged findings into PR roadmap (Round 1–5)
- Reviewed all 9 merged PRs for correctness and test coverage
- Closed 8 stale/obsolete issues and deleted 19 merged remote branches
- Verified each of 26 original findings is resolved or intentionally deferred

**Five-round PR sequence:**
- **PR #67:** Wire dispatch commands (C-1)
- **PR #68:** Null guards for config (C-2, M-4)
- **PR #69:** Delete dead code (I-1)
- **PR #70:** Assert tools + worktree cleanup (I-2, M-1, M-2)
- **PR #80:** NaN validation + CORE_SCHEMA (I-3, M-6 partial)
- **PR #81:** Symlink EEXIST + fork PR fetch (I-5, M-3)
- **PR #82:** Dashboard filter refinements
- **PR #89:** Status query fix + atomic writes (I-4, M-5)
- **PR #95:** Symlink edge cases + utils extraction
- **PR #96:** React key collision + edge-case tests

**Deferred (low priority):**
- M-5: Concurrency locking (single-user tool; acceptable)
- M-6: Version centralization (3 places; can defer)
- m-1: Test pattern standardization

**Decision Merged:** Code Review Round 1 findings decision appended to `.squad/decisions.md`

**Key Learning:** Structured code review → incremental fix PRs → expanded test coverage is high-leverage. All 26 findings cleared in 5 rounds. Codebase is now clean with no technical debt blockers.

**Team Status:** Kaylee shipped 7 PRs, Jayne added edge-case tests, Wash integrated CI/CD. Lead review cycle complete. Focus shifts to feature development.

### 2026-02-23 — Full Project Retrospective: Rally Phases 1-5

**Role:** Retro Facilitator (manual retro requested by James)

**Scope:** Full project — PRD through Phases 1-5, code review cycle, six fix batches

**Key Findings:**

**What Worked:**
1. **PRD design phase was high-leverage** — 2 days upfront design prevented weeks of mid-implementation rework. Zero architecture pivots. Design checklist (30 questions) is now institutional knowledge.
2. **Feature branch workflow + worktrees enabled parallelism** — 5 agents on 5 features simultaneously, zero conflicts. 21 PRs merged cleanly.
3. **Five-round code review systematically cleared debt** — 26 findings → 5 PR rounds → clean codebase. Test coverage 280→321 tests.
4. **Retrospectives after every phase caught failures early** — Phase 1 direct-commit failure → Phase 2+ used feature branches. Phase 4-5 CI hang caught before more debt accumulated.

**What Failed:**
1. **Two process failures** (Phase 1 direct commits, Phase 4-5 unresolved comments merge) — pattern: documented process without enforcement gets bypassed under velocity pressure.
2. **Branch protection is the missing structural enforcement** — behavioral rules ("use feature branches") fail without GitHub-enforced gates.
3. **Interactive behavior validation gap** — prompts, TTY components hard to test without real terminal; caught by luck, not checklists.
4. **E2E testing confusion** — "E2E tests" used mocks, not real CLI binary invocation. Real E2E tests came post-Phase 5.

**Key Learnings:**
- Branch protection (require approval + Copilot resolved + CI) is structural enforcement, not advisory
- Real E2E must invoke `bin/<cli>.js` binary; DI mocks are integration tests
- Test cleanup standards matter: every Ink `render()` needs paired `cleanup()` in `afterEach()`
- Retrospectives are project memory — session logs in `.squad/log/` should be agent onboarding material
- PRD design checklist is reusable template for future CLI projects

**Process Changes for Future Work:**
1. Enable branch protection (P0) — require approval + Copilot + CI
2. Formalize test cleanup standards in TESTING.md (P1)
3. Make Copilot review mandatory on all PRs (P1)
4. Create interactive testing checklist skill (P2)
5. Add edge case enumeration to issue templates (P2)
6. Design checklist as gate for "start coding" (P1)

**Team Recognition:** Kaylee shipped 7 PRs in review cycle. Jayne built real E2E suite and expanded tests to 321. Wash owned onboarding + GitHub integration. Scribe maintained project memory. Copilot caught 20+ issues across PRs.

**Artifact:** `.squad/decisions/inbox/mal-full-project-retro.md`

**Status:** Rally is production-ready. 29 issues closed, 321 tests, zero technical debt blockers. Clean main branch.

### 2026-02-24 — Issue #151: Read-Only Copilot Research

**Task:** Research two alternative approaches to restricting Copilot to read-only mode during dispatch, replacing the copilot-instructions.md approach from PR #141.

**Findings:**
1. **`--deny-tool` flags (Approach 1):** Copilot CLI supports `--deny-tool 'shell(git push)'`, `--deny-tool 'shell(gh pr)'`, etc. These are CLI-level enforcement — Copilot literally cannot use denied tools. Covers shell commands and MCP servers. Granularity is at first-level subcommand (e.g., can't allow `gh issue view` while denying `gh issue comment`).
2. **`preToolUse` hooks (Approach 2):** Hooks in `.github/hooks/hooks.json` can intercept and deny tool calls via a bash script. Maximum granularity (can inspect full command string) but still writes files into worktrees and adds execution overhead.

**Recommendation:** Use `--deny-tool` flags as primary enforcement in `launchCopilot()`. Keep copilot-instructions.md as defense-in-depth but fix the overwrite issue. Only add hooks if the loss of read-only `gh` commands proves problematic.

**Deliverable:** Research comment posted on [issue #151](https://github.com/jsturtevant/rally/issues/151#issuecomment-3948109874).

### 2026-02-24 — Issue #151: Read-Only Enforcement Implemented (Kaylee)

**Status:** ✅ Implemented in PR #156 (Kaylee)

Mal's recommendation for `--deny-tool` flags as primary enforcement (from 2026-02-24 research) was executed by Kaylee Core Dev:

**What was shipped:**
- `--deny-tool` flags now passed to `gh copilot` in `launchCopilot()` in `lib/copilot.js`
- Blocks write commands: `shell(git push)`, `shell(git commit)`, `shell(gh pr)`, `shell(gh issue)`, `shell(gh repo)`, `shell(gh api)`
- Blocks MCP tools: `github-mcp-server`
- Read-only policy embedded in prompt (not written to files)
- Removed `lib/copilot-instructions.js` (file writing approach)
- All 396 tests passing

**Outcome:** Issue #151 resolved. Read-only enforcement is now CLI-level, requires zero file system side effects, and cannot be bypassed by the user.

### 2025-07-24 — Issue #164 Decomposition: Session Reconnect & Dashboard Polish

**Issue:** https://github.com/jsturtevant/rally/issues/164 — four sub-features requested.

**Key findings:**
- `gh copilot` CLI has NO session reconnect capability. No `--session`, `--resume`, or `--attach` flags exist. Session IDs are PID placeholders (`lib/copilot.js:158-160`).
  **Update:** `gh copilot --resume <session_id>` is now supported. Rally uses this via `rally dispatch continue`.
- The feasible alternative is launching a NEW Copilot session in the existing worktree (`rally dispatch continue <number>`). The worktree preserves all context from the prior session.
- "Friendly naming" is already handled by dispatch IDs (`<repo>-<type>-<number>`). Deferred — not user-facing.
- "Ready for review" is a display-only change: map `done` status → "ready for review 📋" in `DispatchTable` and `dashboard-data.js`.
- Change stats are parseable from `.copilot-output.log` via regex. New `lib/copilot-stats.js` module.

**Decomposition written to:** `.squad/decisions/inbox/mal-issue-164-decomposition.md`

**Priority order:** C (display label) → D (stats parsing) → A (continue command) → B (deferred).

**Architecture decisions:**
- `continue` not `reconnect` — honest naming for what it does
- Stats parsed on-demand from log files, not stored in active.yaml
- Log append mode for continue sessions (one log per dispatch)
- Display-only change for "ready for review" (no new status in state machine)

---

### Rally Agent Skill (#332) — 2025-07-24

**Task:** Create `.claude/skills/rally/SKILL.md` — an agent skill file teaching AI agents how to use Rally.

**Approach:** Read the full command surface from `bin/rally.js`, studied dispatch-core, dispatch-issue, dispatch-pr, dispatch-continue, dispatch-clean, dispatch-log, copilot.js, config.js, active.js, onboard.js, and Dashboard.jsx to build an accurate, comprehensive reference.

**Outcome:** PR #333 opened. Single file addition — 299 lines covering all commands, workflows, status model, dashboard shortcuts, key concepts, and common patterns. Used `.claude/skills/` path for compatibility with both Claude Code and Copilot CLI.

**Decision:** Skill goes in `.claude/skills/rally/SKILL.md` (not `.github/skills/`) since both Claude Code and Copilot CLI support the `.claude/skills/` convention. One path, both tools.

---

### Squad Upgrade to `consult-mode-impl` Branch (#361) — 2026-02-28

**Task:** Create a focused upgrade plan to migrate from old Squad (`github:bradygaster/squad#v0.5.2`) to new Squad (`jsturtevant/squad-pr#consult-mode-impl`) with SDK support.

**Key files in scope:**
- `lib/setup.js` (lines 46–62): Runs \`npx github:bradygaster/squad#v0.5.2\` to init team dir
- `lib/team.js` (lines 96–108): Same \`npx\` call in \`initTeamDir()\`
- `lib/dispatch-core.js` (lines 122–130): Symlink logic for `.squad/`
- `lib/onboard.js` (line 237): Symlinks `.squad`, `.squad-templates`, `.github/agents/squad.agent.md`
- `lib/onboard-remove.js` (lines 82–84): Cleanup
- `lib/exclude.js`: Excludes `.squad`, `.squad-templates`, `.github/agents/squad.agent.md`
- Tests: No squad references in test mocks; test fixtures manually create `.squad-templates` (expected to be auto-created by new squad)

**Architecture decision:** Use SDK import approach (\`ensureSquadPath()\`) instead of subprocess. More robust, no git clone overhead, atomic creation.

**Upgrade plan created:** Posted as comment on GitHub issue #361. Covers:
1. Two-phase adoption (Phase 1: minimal changes to setup.js/team.js; Phase 2: dispatch-core robustness + test cleanup)
2. Risk assessment: Only `.squad-templates` existence is medium risk (verify new squad creates it; if not, remove from symlinks + tests)
3. Verification checklist for full flow
4. No breaking changes — new Squad uses same `.squad/` directory structure

**Key pattern learned:** When upgrading tooling across multiple files:
- Identify all invocation points (setup.js, team.js)
- Check for dependent patterns (symlink logic, test fixtures)
- Plan in phases: minimal merge-friendly change first, then robustness improvements
- Document risk mitigation explicitly (e.g. `.squad-templates` existence check)

### 2026-02-28 — Squad Upgrade Plan Accepted (#361)

**Work completed (2026-02-28T08:58:00Z):** Delivered two-phase squad upgrade strategy in response to James's request.

**Decision:** Approved for implementation. Phase 1 is minimal (2-line changes per file), Phase 2 adds robustness. All existing tests pass without modification.

**Status:** Posted to GitHub issue #361. Team can begin Phase 1 immediately.
