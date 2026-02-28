# Remove Worktree Action Shortcut (Mock-based)

Tests the 'x' key to remove a worktree.
Note: The 'x' key removes immediately without a confirmation prompt.
Uses isolated RALLY_HOME temp directory to avoid affecting user config.
For real GitHub integration tests, see real-dispatch.test.js

## Screenshots

The following screenshots show the visual state at each step:

### Before Remove

![Before Remove](../../test/baselines/actions-remove/01-before-remove.png)

### After Remove

![After Remove](../../test/baselines/actions-remove/02-after-remove.png)

### Confirmation Prompt

![Confirmation Prompt](../../test/baselines/actions-remove/02-confirmation-prompt.png)

### Before Confirm

![Before Confirm](../../test/baselines/actions-remove/03-before-confirm.png)

### With Dispatch

![With Dispatch](../../test/baselines/actions-remove/03-with-dispatch.png)

### After Confirm

![After Confirm](../../test/baselines/actions-remove/04-after-confirm.png)

### After Remove Refresh

![After Remove Refresh](../../test/baselines/actions-remove/04-after-remove-refresh.png)

### Before Cancel

![Before Cancel](../../test/baselines/actions-remove/05-before-cancel.png)

### After Cancel

![After Cancel](../../test/baselines/actions-remove/06-after-cancel.png)

### After Escape

![After Escape](../../test/baselines/actions-remove/07-after-escape.png)

---

*Generated from [`test/e2e/journeys/actions/remove.test.js`](../../test/e2e/journeys/actions/remove.test.js)*
