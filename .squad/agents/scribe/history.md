# Project Context

- **Owner:** James Sturtevant
- **Project:** Rally — a CLI tool that dispatches Squad teams to GitHub issues and PR reviews via git worktrees
- **Stack:** Node.js with CLI production stack (Ink, Chalk, Ora, Commander, js-yaml, @inquirer/prompts; node:test for testing)
- **Created:** 2026-02-21

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### 2026-02-22 — Decision Inbox Merge & Team State Update Complete

**Task:** Merge `.squad/decisions/inbox/` into `.squad/decisions.md`, delete inbox files, update agent histories with scaffold completion status.

**What Happened:**

1. **Decision Inbox Merged (2 files → decisions.md):**
   - `mal-retro-planning-phase.md` → Full retro on PRD design phase (what went well, learnings, action items)
   - `copilot-directive-2026-02-22T014800Z.md` → Testing & code review directive (mandatory PR tests, CI, code review)
   - Deduped and consolidated into decisions.md under "Retrospective: PRD Design Phase Complete" and "Directive: Testing & Code Review Requirements"

2. **Inbox Files Deleted:**
   - `.squad/decisions/inbox/mal-retro-planning-phase.md` ✓
   - `.squad/decisions/inbox/copilot-directive-2026-02-22T014800Z.md` ✓

3. **Agent Histories Updated (cross-agent notification):**
   - **Mal:** Added "Team Notification: Project Scaffold Complete" noting all blockers resolved, ready for Phase 1
   - **Kaylee:** Added notification of Phase 1 readiness, GitHub issues #1–#8 ready for implementation
   - **Wash:** Added notification of Phase 1 readiness, his issues (#5, #6, #11, #18) assigned and ready
   - **Jayne:** Added notification that she's unblocked (5 blockers resolved), can proceed with test infrastructure + error catalog work
   - **Scribe:** Updated with this work summary

**Team State After Merge:**
- ✓ All decisions documented in single canonical source (decisions.md)
- ✓ No duplicate decision entries
- ✓ All agents notified of scaffold completion
- ✓ Implementation phase unblocked

**Next Phase:** Kaylee/Wash parallelize Phase 1 utilities. Jayne writes test infrastructure. Full documentation in decisions.md. All 29 GitHub issues (#1–#29) on jsturtevant/rally ready for assignment.


### 2026-02-28 — Squad Upgrade Plan Merged to Decisions

**Work completed (2026-02-28T08:58:00Z):**

1. **Created orchestration log:** `.squad/orchestration-log/2026-02-28T08-58-00Z-mal.md` — Mal's squad upgrade work
2. **Created session log:** `.squad/log/2026-02-28T08-58-00Z-squad-upgrade-plan.md` — Brief summary
3. **Merged inbox decision:** Mal's squad upgrade plan (.squad/decisions/inbox/mal-squad-upgrade-plan.md) → decisions.md
4. **Deleted inbox file:** Cleaned up merged decision
5. **Updated Mal's history:** Added squad upgrade work summary and acceptance status
6. **Git commit:** Staged .squad/ changes

**Outcome:** Decision is now canonical in decisions.md, all agents read-accessible. Phase 1 ready for implementation.
