# Continue/Attach Action Shortcut (Mock-based)

Tests the 'a' key to attach to an existing session.
Works when there's an active dispatch.
Uses isolated RALLY_HOME temp directory to avoid affecting user config.
For real GitHub integration tests, see real-dispatch.test.js

## Screenshots

The following screenshots show the visual state at each step:

### Dashboard

![Dashboard](../../test/baselines/actions-continue/01-dashboard.png)

### After Attach

![After Attach](../../test/baselines/actions-continue/02-after-attach.png)

### Empty Dashboard

![Empty Dashboard](../../test/baselines/actions-continue/03-empty-dashboard.png)

### After Attach Empty

![After Attach Empty](../../test/baselines/actions-continue/04-after-attach-empty.png)

### Attach Paused

![Attach Paused](../../test/baselines/actions-continue/05-attach-paused.png)

---

*Generated from [`test/e2e/journeys/actions/continue.test.js`](../../test/e2e/journeys/actions/continue.test.js)*
