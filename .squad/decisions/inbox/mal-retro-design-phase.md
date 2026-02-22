# Retrospective — PRD Design Phase

**Date:** 2026-02-22  
**Facilitated By:** Mal (Lead)  
**Participants:** Team review findings from Mal, Wash, Kaylee, Jayne

---

## 🔄 Retrospective — PRD Design Phase

### ✅ What Went Well

- **PRD is internally consistent** — Command CLI syntax, state model, workflows hang together. No contradictions found.
- **Dependency pivot was decisive** — Removed analysis paralysis. Adopting Ink/Chalk/Ora/Commander cleared the decks for implementation.
- **Stale docs were caught and fixed** — Zero-dep references in team docs were stale post-pivot. Fixed immediately so team has one source of truth.
- **Full team review cycle completed** — All 4 agents reviewed, found critical issues, and documented them. Blockers are explicit, not hidden.
- **Target user is clear** — James clarified: solo dev on shared repos, not team adoption. This narrowed scope and eliminated ambiguity.

### ⚠️ What Didn't Go Well

- **Five critical blockers remain open in §9** — gh field names, Windows symlink fallback, Squad invocation mechanism, dispatch status lifecycle, dispatch-context.md format. PRD Review Findings section is long because these were not resolved during design.
- **Error handling catalog missing** — Jayne found 12 error-handling gaps (uncommitted changes, collisions, auth failures, exit codes). PRD is light on edge cases.
- **Test framework not specified** — No `docs/TESTING.md`. Strategy for mocking git/gh/npx, fixture management, Ink component testing unclear.
- **Scope creep on dashboard** — Full-screen alternate buffer + keyboard navigation is ambitious. Low risk but worth calling out as a stretch goal.
- **Some design decisions were iterative** — Config format (JSON → YAML), subcommand syntax (flags → explicit subcommands), onboard expansion (basic → GitHub URL + team selection). Expected in design, but each required doc updates and team re-read.

### 🔧 What Should Change

1. **Resolve 5 critical blockers before implementation** — Schedule a 30-min team decision sync to lock:
   - gh field names (issue vs PR field sets)
   - Windows symlink fallback (hard error? junctions? flag?)
   - Squad invocation (instructions vs CLI vs VS Code)
   - Status lifecycle rules (who updates? when?)
   - dispatch-context.md format (schema)

2. **Write comprehensive error catalog** — Extend PRD §8 with error cases per command: what can go wrong, error message, recovery. Jayne to own.

3. **Create `docs/TESTING.md`** — Define test strategy: node:test + ink-testing-library, fixture patterns, git/gh mocking approach. Jayne to own (post-blocker resolution).

4. **Lock dispatch status lifecycle diagram** — Transitions (planning → implementing → reviewing → done → cleaned) need formal spec with roles. Add to PRD or separate decision.

5. **Pin nice-to-haves for v2** — Dashboard full-screen mode, multi-team overlays, concurrent dispatch safety, idempotency rules. Document as "Future Enhancement" to keep v1 focused.

### 📋 Action Items

1. **[Mal]** Schedule 30-min blocker resolution sync with Wash, Kaylee, Jayne before end of day (2026-02-22). Agenda: §9 questions #1, #3, #4, #5, #6.
   
2. **[Mal]** After sync, update `docs/PRD.md` with blocker resolutions and commit.

3. **[Jayne]** After blockers resolved, write `docs/TESTING.md` and error catalog for PRD §8. Target: 2026-02-23.

4. **[Kaylee & Wash]** After blocker resolution, proceed with `lib/` module implementation. Mal to assign staggered tasks to avoid blocking dependencies.

5. **[All]** Async: After blocker sync, review PRD updates (blocker resolutions) in `.squad/decisions.md` before next standup.

---

## Blocker Resolution Tracker

| Blocker | Owner | Status |
|---------|-------|--------|
| gh field names (§9.1) | Wash | Pending sync 2026-02-22 |
| Windows symlink fallback (§9.7) | Mal + Kaylee | Pending sync 2026-02-22 |
| Squad invocation (§9.1) | Jayne | Pending sync 2026-02-22 |
| Status lifecycle (§9.2) | Mal | Pending sync 2026-02-22 |
| dispatch-context.md format (§9.4) | Jayne | Pending sync 2026-02-22 |

**Post-sync, this tracker moves to `.squad/decisions.md` as resolved.**
