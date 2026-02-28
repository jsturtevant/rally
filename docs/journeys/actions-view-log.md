# View Log Action Shortcut (Mock-based)

Tests the 'l' key to view copilot log output
and Escape to return to dashboard.
Uses isolated RALLY_HOME temp directory to avoid affecting user config.
For real GitHub integration tests, see real-dispatch.test.js

## Screenshots

The following screenshots show the visual state at each step:

### Dashboard

![Dashboard](../../test/baselines/actions-view-log/01-dashboard.png)

### Log View

![Log View](../../test/baselines/actions-view-log/02-log-view.png)

### Log Before Escape

![Log Before Escape](../../test/baselines/actions-view-log/03-log-before-escape.png)

### After Escape

![After Escape](../../test/baselines/actions-view-log/04-after-escape.png)

---

*Generated from [`test/e2e/journeys/actions/view-log.test.js`](../../test/e2e/journeys/actions/view-log.test.js)*
