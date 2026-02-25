# Orchestration: Wash — Dispatch Trust Warnings

**Timestamp:** 2026-02-25T00:30Z  
**Agent:** Wash (Integration Dev)  
**Mode:** sync  
**Issue:** #218  
**PR:** #228  

## Work

Added prompt injection protection via trust check warnings. Warns when dispatching issues/PRs authored by non-current user or from non-member repos. `--trust` flag bypasses. Non-TTY environments skip warnings silently.

## Outcome

✅ PR #228 merged. Safety defaults implemented (confirm: false). Graceful degradation on API failures.
