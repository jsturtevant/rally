# Decision: PRD §9 Blocker Resolutions & Field Name Standardization

**By:** Mal (Lead)  
**Date:** 2026-02-22  
**Status:** Complete

## Summary

Documented all five critical blocker resolutions in PRD §9 and standardized GitHub CLI field references. PRD is now complete and ready for implementation.

## Changes Made

### 1. PRD §9 Resolutions (All 5 Blockers)

#### §9.1 — Squad Invocation Mechanism
**Resolution:** Automated CLI invocation. Rally automatically launches Copilot CLI in the worktree with the appropriate prompt (review PR or plan/implement fix for issue). Rally captures the session ID for later resume if needed.

#### §9.3 — Worktree Location
**Resolution:** Inside repo at `.worktrees/rally-<issue>/`. Already the default in the PRD; no change needed. This location stays with the repo, is easy to navigate, and is excluded from git.

#### §9.4 — dispatch-context.md Format
**Resolution:** Simple markdown template. Squad parses markdown natively. Include issue/PR number, title, labels, body, and for PRs the changed files list. Include worktree path and branch name as instructions.

#### §9.5 — Status Tracking
**Resolution:** Automatic transitions. `dispatch` sets `planning`, Squad invocation moves to `implementing`, PR creation moves to `reviewing`, PR merge moves to `done`, `dashboard clean` moves to `cleaned`. No manual status commands.

#### §9.7 — Windows Symlinks
**Resolution:** Hard error with clear message: "Symlinks require Windows Developer Mode. Enable it in Windows Settings: Settings → Update & Security → For developers → Developer Mode". No junctions or copy fallback in v1.

### 2. Field Name Standardization

**§6.3 GitHub CLI field reference update:**
- Changed: `gh pr view <n> --json title,body,headRefName,baseRefName,changedFiles`
- To: `gh pr view <n> --json title,body,headRefName,baseRefName,files`

Standardized to use `files` instead of `changedFiles` to match actual gh CLI output.

## Impact

- PRD is now complete and unambiguous — all open questions resolved
- Implementation teams (Kaylee, Wash) have clear specifications for all 5 commands
- Test teams (Jayne) have blocking resolved and can proceed with test suite
- No ambiguity on GitHub integration, Windows handling, or Squad invocation

## Related Artifacts

- `.squad/skills/rally-design-checklist/SKILL.md` — Institutional knowledge documenting five design phase patterns (separate decision file not needed)
- All blocker resolutions came from user directive (James Sturtevant) on 2026-02-22 01:13
