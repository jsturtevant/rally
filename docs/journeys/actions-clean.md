# Clean Completed Items Action Shortcut (Mock-based)

Tests the 'c' key to clean all completed items.
Should show count of items cleaned.
Uses isolated RALLY_HOME temp directory to avoid affecting user config.
For real GitHub integration tests, see real-dispatch.test.js

## Screenshots

The following screenshots show the visual state at each step:

### Before Clean

![Before Clean](../../test/baselines/actions-clean/01-before-clean.png)

### After Clean

![After Clean](../../test/baselines/actions-clean/02-after-clean.png)

### Clean Count

![Clean Count](../../test/baselines/actions-clean/03-clean-count.png)

### No Completed

![No Completed](../../test/baselines/actions-clean/04-no-completed.png)

### After Clean None

![After Clean None](../../test/baselines/actions-clean/05-after-clean-none.png)

### Specific Clean

![Specific Clean](../../test/baselines/actions-clean/06-specific-clean.png)

---

*Generated from [`test/e2e/journeys/actions/clean.test.js`](../../test/e2e/journeys/actions/clean.test.js)*
