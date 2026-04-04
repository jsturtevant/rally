---
date: 2026-03-23
author: Kaylee
status: implemented
---

# Decision: Preserve Navigation State Until User Commits to Action

## Context

The Dashboard uses React state (`browseMode`, `browseProject`, `dispatchPending`, `dispatchStatus`, etc.) to manage a stack of screens. When a user navigates through multiple screens and encounters a confirmation modal (like TrustConfirm), we need to decide when to clear the navigation state.

## Problem

Previously, when a user selected an item in ProjectItemPicker that had trust warnings, the navigation state (`browseMode` and `browseProject`) was cleared immediately before showing the TrustConfirm screen. This meant:

1. User path: Dashboard → ProjectBrowser → ProjectItemPicker → select item → TrustConfirm
2. Navigation state cleared when item selected (before confirmation)
3. User presses Escape on TrustConfirm
4. browseMode is already null → returns to main Dashboard
5. **Expected:** return to ProjectItemPicker

This violated the principle that Escape should always go back to the previous screen.

## Decision

**Preserve navigation state until the user commits to the action (confirms), not when entering the confirmation screen.**

### Implementation

In `Dashboard.jsx`:

1. **ProjectItemPicker onSelectItem:** Check for trust warnings FIRST, before clearing browseMode/browseProject. Only clear navigation state if no warnings exist.
2. **TrustConfirm onConfirm:** Clear browseMode/browseProject when user confirms the action.
3. **TrustConfirm onCancel:** Leave browseMode/browseProject intact so user returns to previous screen.

### Code Pattern

```jsx
// BEFORE (incorrect)
onSelectItem={(item, repo) => {
  setDispatchPending(pending);
  setBrowseMode(null);        // ❌ clears too early
  setBrowseProject(null);     // ❌ clears too early
  if (hasWarnings) {
    setDispatchStatus('confirming');
    return;
  }
  runDispatch(pending);
}

// AFTER (correct)
onSelectItem={(item, repo) => {
  setDispatchPending(pending);
  if (hasWarnings) {
    setDispatchStatus('confirming');
    return;                   // ✓ preserves navigation state
  }
  setBrowseMode(null);        // ✓ only clears if no warnings
  setBrowseProject(null);
  runDispatch(pending);
}

// TrustConfirm handlers
onConfirm={() => {
  setBrowseMode(null);        // ✓ clear on commit
  setBrowseProject(null);
  runDispatch(pending);
}}
onCancel={() => {
  // ✓ don't clear browseMode/browseProject
  setDispatchPending(null);
  setDispatchStatus(null);
}}
```

## Rationale

1. **Consistent Escape behavior:** Users expect Escape to navigate back to the previous screen across ALL screens, not just some.
2. **Navigation stack integrity:** Clearing state too early breaks the conceptual navigation stack.
3. **User control:** The user hasn't committed to leaving ProjectItemPicker until they confirm the dispatch. Canceling should return them to where they were.

## Consequences

- **Positive:** Escape key now works consistently across all screens
- **Positive:** Navigation feels more predictable and follows common UI patterns
- **Positive:** No side effects on other navigation flows (all existing tests pass)
- **Neutral:** Slightly more complex state management (need to clear browseMode in multiple places)

## Testing

All existing tests pass:
- 91 unit tests
- 5 E2E tests

## Future Pattern

When adding new multi-screen flows with confirmations:
1. Preserve navigation state when entering the confirmation screen
2. Clear state only when user confirms (commits to action)
3. Leave state intact when user cancels (returns to previous screen)
