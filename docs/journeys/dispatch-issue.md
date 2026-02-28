# Dispatch to Issue via Dashboard UI

Tests the complete user journey for dispatching to a GitHub issue
through the interactive dashboard interface.
This is a skeptical test — it checks error paths, timeouts, and
edge cases alongside the happy path.
Uses isolated RALLY_HOME temp directory to avoid affecting user config.

## Screenshots

The following screenshots show the visual state at each step:

### Dashboard

![Dashboard](../../test/baselines/dispatch-issue/01-dashboard.png)

### Project Browser

![Project Browser](../../test/baselines/dispatch-issue/02-project-browser.png)

### Item Picker

![Item Picker](../../test/baselines/dispatch-issue/03-item-picker.png)

### Issue Selected

![Issue Selected](../../test/baselines/dispatch-issue/04-issue-selected.png)

### Dispatch Complete

![Dispatch Complete](../../test/baselines/dispatch-issue/05-dispatch-complete.png)

### Dashboard With Dispatch

![Dashboard With Dispatch](../../test/baselines/dispatch-issue/06-dashboard-with-dispatch.png)

---

*Generated from [`test/e2e/journeys/dispatch/issue.test.js`](../../test/e2e/journeys/dispatch/issue.test.js)*
