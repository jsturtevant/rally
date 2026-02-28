# Upstream Status Action Shortcut (Mock-based)

Tests the 'u' key to mark an item as "waiting on upstream".
Status icon should change to 🟣.
Uses isolated RALLY_HOME temp directory to avoid affecting user config.
For real GitHub integration tests, see real-dispatch.test.js

## Screenshots

The following screenshots show the visual state at each step:

### Before Upstream

![Before Upstream](../../test/baselines/actions-upstream/01-before-upstream.png)

### After Upstream

![After Upstream](../../test/baselines/actions-upstream/02-after-upstream.png)

### Status Updated

![Status Updated](../../test/baselines/actions-upstream/03-status-updated.png)

### Empty Dashboard

![Empty Dashboard](../../test/baselines/actions-upstream/04-empty-dashboard.png)

### Starting Upstream

![Starting Upstream](../../test/baselines/actions-upstream/05-starting-upstream.png)

### After Toggle

![After Toggle](../../test/baselines/actions-upstream/06-after-toggle.png)

---

*Generated from [`test/e2e/journeys/actions/upstream.test.js`](../../test/e2e/journeys/actions/upstream.test.js)*
