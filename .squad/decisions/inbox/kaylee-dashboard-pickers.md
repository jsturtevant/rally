# Decision: Dashboard Pickers — Exit-and-Run Pattern for Dispatch

**By:** Kaylee (Core Dev)
**Date:** 2026-02-25
**Status:** Proposed

## Context

Issue #278 requested issue/PR pickers from the dashboard. The dashboard is an Ink (React) full-screen app, while dispatch involves `execFileSync` calls, git worktree creation, and Copilot process spawning — operations that don't belong inside a render loop.

## Decision

Follow the existing `onAttachSession` exit-and-run pattern: the Ink app stores a `pendingDispatch` object (type, number, repo), calls `exit()`, and the outer code in `rally.js` handles the actual dispatch after `waitUntilExit()`. This keeps the Ink lifecycle clean and reuses existing dispatch functions unchanged.

## Impact

- New dashboard callbacks: `onDispatchItem`, `onAddProject` (in addition to existing `onAttachSession`)
- Any future "do something after dashboard exit" features should follow this same pattern
- Components use DI props (`_fetchIssues`, `_fetchPrs`, `_listOnboardedRepos`) for testability
