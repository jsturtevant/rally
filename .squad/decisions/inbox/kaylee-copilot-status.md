# Decision: PR dispatch initial status changed to `implementing`

**Date:** 2025-07-25
**Author:** Kaylee (Core Dev)
**Issue:** #321

## Context

PR dispatches (`rally dispatch pr`) were created with `initialStatus: 'reviewing'`, which immediately showed "ready for review" in the dashboard while copilot was still actively working on the review.

## Decision

Changed `initialStatus` for PR dispatches from `'reviewing'` to `'implementing'`. The existing `refreshDispatchStatuses()` mechanism now handles the transition to `'reviewing'` when copilot finishes — same as issue dispatches.

Also renamed the `implementing` dashboard label from "working" to "copilot working" for clarity.

## Impact

- PR dispatches now follow the same lifecycle as issue dispatches
- Dashboard accurately reflects copilot's working state
- No new statuses or state machine changes needed
