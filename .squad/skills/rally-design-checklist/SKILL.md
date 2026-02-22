---
name: "Design Phase Checklist for Rally"
description: "Proven process for technical design phases: resolve blockers upfront, engage stakeholders early, validate against reality before team review, spec test frameworks before implementation, scope features explicitly."
domain: "design, process, quality-gates"
confidence: "high"
source: "earned"
tools: []
---

## Context

The Rally PRD design phase identified five critical blockers that should have been resolved before the team review cycle. Additional observations showed iterative scope creep (JSON→YAML→js-yaml, flags→subcommands, onboard expansion) and test framework specification deferred until after design was locked. These learnings apply to any feature-heavy technical design: get blockers resolved upfront, validate early assumptions with real output, and establish test strategy as a prerequisite, not a follow-up.

## Patterns

### 1. **Resolve blockers with stakeholder before team review**
- Before scheduling team review, privately sync with the primary stakeholder (James in Rally's case) on all open questions marked as blockers in your design document.
- Get explicit decisions on technical alternatives, fallback strategies, edge cases.
- Update the design with resolutions before sharing with the team.
- **Why:** Team review is meant to find logical inconsistencies and implementation risks, not to raise architectural questions. Blockers slow down team feedback cycles.

### 2. **Engage stakeholder early on iterative decisions**
- If you find yourself revising a major decision (e.g., JSON→YAML config format, flags→subcommands structure), schedule a quick 15-minute design sync with the stakeholder before locking it in.
- Document the decision and rationale so other team members understand the tradeoffs.
- **Why:** Iterative design is normal, but unanchored changes create churn. Stakeholder alignment prevents wasteful rework.

### 3. **Validate PRD assumptions against real CLI output**
- Before team review, test your gh CLI field names, git worktree syntax, or other external tool assumptions with actual tool runs.
- Catch field inconsistencies (e.g., `files` vs `changedFiles` in `gh pr view` JSON) before they make it into code.
- Create a small test script that exercises the exact commands in your PRD.
- **Why:** External tool APIs change, documentation drifts. Reality-checking saves implementation surprises.

### 4. **Write test framework spec during design, not after**
- Before design review, define your testing strategy: mocking approach for external tools (git, gh, npm), fixture management, test structure patterns, TTY/non-TTY testing, fixture file locations.
- Include the test strategy in the PRD or as a companion `docs/TESTING.md`.
- Don't defer this to "implementers will figure it out."
- **Why:** Test strategy unblocks implementers and prevents mid-implementation pivots on testing approach.

### 5. **Scope features explicitly: core vs. nice-to-have**
- When adding scope (e.g., GitHub URL support for `onboard`, team selection prompts, projects directory), explicitly mark it as core or nice-to-have in the design.
- Use a clear rubric: "Does this solve the primary user problem, or does it enable secondary workflows?"
- For Rally: core = issue→PR automation, nice-to-have = team layering, Squad export/import shortcuts.
- **Why:** Clear scope boundaries prevent mid-phase scope creep and keep team conversations focused.

## Examples

### Rally: What We Did Right
1. **Dependency pivot decision** — When blocked by analysis (zero-dep vs. hand-rolled YAML parser complexity), James made a decisive call (use npm deps), which immediately cleared the path. Design locked, team proceeded.
2. **Target user clarified** — Ambiguity about whether Rally was for solo devs or team adoption was resolved explicitly (solo devs on shared repos), which simplified all downstream decisions.

### Rally: What We Should Have Done
1. **Resolve blockers upfront** — The 5 blockers in PRD §9 sat open until day 2. Should have synced with James on 2026-02-21 to get §9.1, §9.4, §9.5, §9.7 resolved before team review.
2. **Test framework spec** — `docs/TESTING.md` was deferred to "after blockers." Should have been written during design phase so Jayne could parallelize test suite work.
3. **Validate gh CLI output** — Field names (§3.3 vs §6.3 inconsistency) should have been tested with real `gh` commands before locking the PRD.
4. **Scope onboard carefully** — Onboard grew from "symlink a cloned repo" to "GitHub URL support + projects directory + team selection prompt." Should have called out scope explicitly at each expansion point.

## Anti-Patterns

- **Defer blockers to team review.** Blockers should be pre-resolved. Team review finds inconsistencies, not architecture.
- **Iterate on design without stakeholder alignment.** If you're changing a major decision, get buy-in; don't surprise the team.
- **Assume external tool behavior.** Test it. APIs are not documentation.
- **Leave test strategy to implementers.** Establish approach upfront — mocking libraries, fixture patterns, TTY simulation.
- **Expand scope without calling it out.** If a feature grows, re-estimate and re-align with the team.
