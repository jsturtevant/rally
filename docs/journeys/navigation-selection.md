# Keyboard Navigation Selection

Tests keyboard navigation in the dashboard:
- j/k moves selection down/up
- ↑/↓ arrow keys work the same
- Selection wraps at list boundaries
- Multi-project navigation (moving between repo groups)

## Screenshots

The following screenshots show the visual state at each step:

### Initial

![Initial](../../test/baselines/navigation-selection/01-initial.png)

### After J

![After J](../../test/baselines/navigation-selection/02-after-j.png)

### After K

![After K](../../test/baselines/navigation-selection/03-after-k.png)

### Multiple J

![Multiple J](../../test/baselines/navigation-selection/04-multiple-j.png)

### Arrow Down

![Arrow Down](../../test/baselines/navigation-selection/05-arrow-down.png)

### Arrow Up

![Arrow Up](../../test/baselines/navigation-selection/06-arrow-up.png)

### Mixed Navigation

![Mixed Navigation](../../test/baselines/navigation-selection/07-mixed-navigation.png)

### Wrap Bottom

![Wrap Bottom](../../test/baselines/navigation-selection/08-wrap-bottom.png)

### Wrap Top

![Wrap Top](../../test/baselines/navigation-selection/09-wrap-top.png)

### Multi Project

![Multi Project](../../test/baselines/navigation-selection/10-multi-project.png)

### Project Browser Nav

![Project Browser Nav](../../test/baselines/navigation-selection/11-project-browser-nav.png)

---

*Generated from [`test/e2e/journeys/navigation/selection.test.js`](../../test/e2e/journeys/navigation/selection.test.js)*
