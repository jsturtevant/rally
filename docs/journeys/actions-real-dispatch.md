# Action Shortcuts with Real GitHub Integration

Tests all action shortcuts (l, a, u, x, c, o) using a real dispatch
to GitHub issue #54. Uses a shared dispatch for efficiency.
This test file:
- Skips if gh CLI not authenticated
- Uses isolated RALLY_HOME temp directory
- Dispatches once to issue #54, tests multiple shortcuts
- Cleans up dispatch after all tests

## Screenshots

The following screenshots show the visual state at each step:

### Dashboard Before Log

![Dashboard Before Log](../../test/baselines/actions-real-dispatch/01-dashboard-before-log.png)

### Log View

![Log View](../../test/baselines/actions-real-dispatch/02-log-view.png)

### Dashboard Before Attach

![Dashboard Before Attach](../../test/baselines/actions-real-dispatch/03-dashboard-before-attach.png)

### After Attach

![After Attach](../../test/baselines/actions-real-dispatch/04-after-attach.png)

### Dashboard Before Upstream

![Dashboard Before Upstream](../../test/baselines/actions-real-dispatch/05-dashboard-before-upstream.png)

### After Upstream

![After Upstream](../../test/baselines/actions-real-dispatch/06-after-upstream.png)

### Dashboard Before Open

![Dashboard Before Open](../../test/baselines/actions-real-dispatch/07-dashboard-before-open.png)

### After Open

![After Open](../../test/baselines/actions-real-dispatch/08-after-open.png)

### Dashboard Before Remove

![Dashboard Before Remove](../../test/baselines/actions-real-dispatch/09-dashboard-before-remove.png)

### After Remove

![After Remove](../../test/baselines/actions-real-dispatch/10-after-remove.png)

### Remove Confirmation

![Remove Confirmation](../../test/baselines/actions-real-dispatch/10-remove-confirmation.png)

### After Cancel Remove

![After Cancel Remove](../../test/baselines/actions-real-dispatch/11-after-cancel-remove.png)

### Navigation Start

![Navigation Start](../../test/baselines/actions-real-dispatch/12-navigation-start.png)

### Before Refresh

![Before Refresh](../../test/baselines/actions-real-dispatch/13-before-refresh.png)

### After Refresh

![After Refresh](../../test/baselines/actions-real-dispatch/14-after-refresh.png)

### Before Quit

![Before Quit](../../test/baselines/actions-real-dispatch/15-before-quit.png)

---

*Generated from [`test/e2e/journeys/actions/real-dispatch.test.js`](../../test/e2e/journeys/actions/real-dispatch.test.js)*
