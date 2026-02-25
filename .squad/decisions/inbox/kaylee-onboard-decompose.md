# Decision: onboard() decomposition — private helpers, not exported

**By:** Kaylee (Core Dev)
**Date:** 2026-02-25
**Issue:** #292

## Decision

Extracted 5 helper functions from `onboard()` but kept them as **private (non-exported)** functions in `lib/onboard.js` rather than moving them to separate modules.

## Rationale

- All helpers are tightly coupled to the onboard orchestration flow
- None are large enough to warrant their own module (each is 15–40 lines)
- Keeping them private means tests exercise them through the public `onboard()` API, which is the right contract to test
- If any helper grows or is needed elsewhere (e.g., `setupSymlinks` reused by another command), it can be extracted to its own module at that point

## Also

Replaced an inline regex for GitHub URL parsing (`remoteUrl.match(/github\.com[:/].../)`) with the already-imported `parseGitHubRemoteUrl()` from `lib/github-url.js`. This eliminates a subtle duplication where the inline regex had slightly different capture behavior than the canonical parser.
