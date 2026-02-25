# Decision: Dispatch Trust Check Behavior

**Author:** Wash (Integration Dev)
**Date:** 2026
**Issue:** #218

## Context

When dispatching issues/PRs, the content (title, body, labels, comments) is fed to an AI agent. Content authored by untrusted third parties could contain prompt injection attacks.

## Decision

1. **Author mismatch warning**: If the issue/PR author ≠ current GitHub user, show a warning and require confirmation (default: No).
2. **Org membership warning**: If the current user is not a member of the repo's org, show an additional warning.
3. **`--trust` flag**: Bypasses all warnings for automation/scripting.
4. **Non-TTY passthrough**: In non-interactive environments (CI, piped input), skip warnings silently — don't block automated workflows.
5. **Graceful degradation**: If `gh api user` or author lookup fails, proceed without warning rather than blocking the user.

## Rationale

- **Default deny** (confirm default: false) — user must actively opt in when processing untrusted content
- **Non-TTY passthrough** — CI/automation users should use `--trust` explicitly; when stdin isn't a TTY there's no way to prompt anyway
- **Fail-open on API errors** — better to let the user proceed than to block on transient API failures
