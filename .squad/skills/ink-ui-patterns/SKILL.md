---
name: "Ink UI Patterns for Rally Dashboard"
description: "Hard-won patterns for building fullscreen terminal UIs with Ink 5 + React. Covers useInput race conditions, fullscreen rendering, sub-view switching, and testing with ink-testing-library."
domain: "ui, ink, react, terminal, dashboard, testing"
confidence: "high"
source: "squad/quick-fixes branch — fixes 5-10, validated in production terminal"
tools: ["ink", "react", "ink-testing-library", "esbuild"]
---

## Context

Rally's dashboard is a fullscreen Ink 5 app (`{ fullScreen: true }`) that renders multiple sub-views: dispatch list, log viewer, detail view, action menu, trust confirmation, dispatch status, project browser. These patterns were learned through 6 rounds of bug fixes involving keyboard shortcuts breaking, content not rendering, and layout not filling the terminal.

**Key files:**
- `lib/ui/Dashboard.jsx` — main dashboard component, view router
- `lib/ui/components/LogViewer.jsx` — scrollable log viewer
- `lib/ui/components/ActionMenu.jsx` — dispatch action menu
- `lib/ui/components/DetailView.jsx` — dispatch detail view
- `lib/ui/components/TrustConfirm.jsx` — author mismatch confirmation
- `lib/ui/components/DispatchStatus.jsx` — dispatch progress display
- `test/build-jsx.mjs` — JSX → JS compiler (esbuild)

---

## Patterns

### 1. useInput Must Use `{ isActive }` — Race Condition Prevention

**Problem:** Ink 5's `useInput` fires on ALL registered components simultaneously. When a parent (Dashboard) and child (LogViewer) both have `useInput` hooks, both fire on every keypress. React's batched state updates cause inconsistent behavior — shortcuts break after one round of view switching.

**Fix:** Every `useInput` call must include `{ isActive: boolean }`:

```jsx
// In Dashboard — only active when showing the main dispatch list
useInput((input, key) => {
  if (input === 'l') setLogViewDispatch(selected);
  // ...
}, { isActive: !logViewDispatch && !detailView && !actionMenu });

// In LogViewer — only active when log view is shown
useInput((input, key) => {
  if (key.escape) onBack();
}, { isActive: true });
```

**Rule:** If a component has `useInput`, it MUST have `{ isActive }`. No exceptions. When multiple views exist, only ONE should be active at a time.

### 2. Ink's `height` Prop Does NOT Render Empty Rows

**Problem:** Setting `<Box height={40}>` on a container creates a Yoga layout constraint, but Ink's terminal renderer only outputs actual content lines. Empty space inside a height-constrained Box won't render as blank terminal rows. This causes sub-views to appear half-height even though layout math is correct.

**Fix:** Pad content with real `<Text>` nodes to fill the available space:

```jsx
const visible = lines.slice(scrollOffset, scrollOffset + visibleLines);
// Pad to fill — Ink only renders actual <Text> nodes
while (visible.length < visibleLines) visible.push('');

// Render with space for empty lines (empty string = zero height in Ink)
{visible.map((line, i) => (
  <Text key={i} wrap="truncate">{line || ' '}</Text>
))}
```

**Rule:** Never rely on `height` alone to fill space. Always render explicit `<Text>` nodes for every row. Use `' '` (space) not `''` (empty string) for padding — empty strings render as zero-height.

### 3. Sub-View Switching Requires Full-Height Wrappers

**Problem:** Ink's differential rendering updates lines in-place. When switching from a tall view (dispatch table with 30 rows) to a shorter view (log viewer with 20 rows), the bottom 10 rows of the old view remain visible as artifacts.

**Fix:** Every sub-view return in Dashboard must be wrapped in a full-height Box:

```jsx
if (logViewDispatch) {
  return (
    <Box flexDirection="column" height={stdout.rows}>
      <LogViewer
        dispatch={logViewDispatch}
        onBack={() => setLogViewDispatch(null)}
        terminalRows={stdout.rows}
      />
    </Box>
  );
}
```

**Rule:** ALL sub-view branches in a fullscreen Ink app must render at `height={stdout.rows}`. This forces Ink to repaint the full terminal on view switches.

### 4. Pass Terminal Dimensions as Props — Don't Call useStdout in Children

**Problem:** `useStdout()` returns `{ stdout: null }` in ink-testing-library. Components that call `useStdout()` directly crash in tests.

**Fix:** Call `useStdout()` once in the top-level Dashboard and pass dimensions as props:

```jsx
// Dashboard.jsx
const { stdout } = useStdout();
// ...
<LogViewer terminalRows={stdout.rows} />

// LogViewer.jsx — use prop, provide fallback
const visibleLines = visibleLinesProp || (terminalRows ? Math.max(5, terminalRows - 6) : 20);
```

**Rule:** Only the top-level fullscreen component should call `useStdout()`. All children receive terminal dimensions as props with sensible fallbacks.

### 5. Inline Dispatch Flow — Stay Inside Ink

**Problem:** Exiting Ink to run interactive prompts (e.g., `confirm()` for trust warnings) and re-entering causes crashes and lost state.

**Fix:** Build confirmation and status UIs as Ink components that render inside the dashboard's view router:

```jsx
// State machine: null → 'confirming' → 'dispatching' → 'done'/'error' → null
if (dispatchState === 'confirming') {
  return (
    <Box flexDirection="column" height={stdout.rows}>
      <TrustConfirm warnings={warnings} onConfirm={...} onCancel={...} />
    </Box>
  );
}
```

**Rule:** Never exit the Ink app for user interaction. Build all confirmation/status flows as Ink components rendered inside the existing fullscreen app.

### 6. Eliminate Refresh Flicker — Never Use State Just to Trigger Re-render

**Problem:** Using `setRefreshKey(k => k + 1)` to trigger a data refresh causes a React re-render even when data hasn't changed. Ink then repaints all lines, causing visible flicker.

**Fix:** Poll data directly inside `setInterval`. Compare JSON before calling `setData` — no state change means no re-render:

```jsx
const [data, setData] = useState(() => getDashboardData({ project }));
const prevJsonRef = useRef(JSON.stringify(data));

useEffect(() => {
  if (!refreshInterval) return;
  const timer = setInterval(() => {
    const fresh = getDashboardData({ project });
    const json = JSON.stringify(fresh);
    if (json !== prevJsonRef.current) {
      prevJsonRef.current = json;
      setData(fresh);
    }
  }, refreshInterval);
  return () => clearInterval(timer);
}, [refreshInterval, project]);
```

For manual refreshes (after user actions), use a `reloadData()` helper that does the same compare-then-set.

**Rule:** Never use a "refresh counter" state variable. Poll data in an interval and only `setState` when the data actually changed.

### 7. Track Terminal Size with useState + Resize Listener

**Problem:** `stdout.rows` is a live property on a mutable object. React deps (`useMemo`, `useEffect`) compare by reference — they don't detect when `stdout.rows` changes. So `useMemo([stdout.rows])` won't re-run on terminal resize.

**Fix:** Store terminal height in `useState` and update via a resize event listener:

```jsx
const { stdout } = useStdout();
const [termRows, setTermRows] = useState(stdout?.rows || 25);

useEffect(() => {
  if (!stdout) return;
  const onResize = () => setTermRows(stdout.rows);
  stdout.on('resize', onResize);
  return () => stdout.off('resize', onResize);
}, [stdout]);
```

Use `termRows` everywhere instead of `stdout.rows`. This ensures React re-renders on resize.

**Rule:** Never read `stdout.rows` directly in render logic or memoization deps. Use a state variable updated by a resize listener.

### 8. Fill Vertical Space with `justifyContent="space-between"` (Preferred)

**Problem:** `<Box flexGrow={1}>` causes flicker. Manual row counting breaks when text wraps at narrow widths (project headers, long PR titles). The row count you calculate never matches reality.

**Fix:** Use Yoga's `justifyContent="space-between"` with an explicit `height` on the outer Box:

```jsx
<Box
  flexDirection="column"
  height={termRows}
  justifyContent="space-between"
  borderStyle="round"
  paddingX={1}
>
  {/* Content floats to top */}
  <Box flexDirection="column">
    <DispatchTable dispatches={dispatches} ... />
  </Box>

  {/* Nav stays at bottom */}
  <Box justifyContent="center">
    <Text dimColor>↑/↓ navigate · l logs · d details · enter actions · q quit</Text>
  </Box>
</Box>
```

Yoga handles all spacing — no row counting, no padding math, no flicker. Content sits at the top, nav sits at the bottom, and the gap fills automatically.

**Fallback — explicit pad nodes (for sub-views like LogViewer):**
When you DO need to fill exact rows (e.g., scrollable log content), pad with real `<Text>` nodes:

```jsx
while (visible.length < visibleLines) visible.push('');
{visible.map((line, i) => (
  <Text key={i} wrap="truncate">{line || ' '}</Text>
))}
```

**Rule:** For main layout (content + nav), use `justifyContent="space-between"`. For scrollable content areas, pad with `<Text>` nodes. Never use `flexGrow` spacers. Never rely on manual row counting for the overall layout.

### 8b. Prevent Text Wrapping in Tables

**Problem:** At narrow terminal widths, long PR titles or issue refs wrap to extra lines, breaking row counts and making the table look messy.

**Fix:** Add `wrap="truncate"` to `<Text>` elements inside table cells:

```jsx
<Box key={col.key} width={col.width} paddingRight={1}>
  <Text bold={selected} wrap="truncate">
    {cells[col.key] ?? ''}
  </Text>
</Box>
```

**Rule:** Always use `wrap="truncate"` on `<Text>` inside fixed-width table columns. Let Ink truncate rather than wrap.

### 9. JSX Build Pipeline

Rally uses esbuild to compile JSX → JS. The `.js` files are what runs in production and tests.

```bash
# After ANY .jsx change:
node test/build-jsx.mjs

# Some .js outputs are gitignored — force-add them:
git add -f lib/ui/Dashboard.js lib/ui/components/LogViewer.js
```

**Rule:** Always rebuild after JSX changes. Always `git add -f` compiled `.js` files that are gitignored.

### 10. Testing Ink Components

**Timing:** Use `setImmediate` delays between keypress simulations:

```javascript
const delay = () => new Promise(r => setImmediate(r));
await delay();
instance.stdin.write('l'); // press 'l'
await delay();
```

**Escape key:** Send as raw ANSI: `instance.stdin.write('\u001B')`

**Assertions:** Use `lastFrame()` to get the current rendered output as a string, then check with `includes()`:

```javascript
const frame = instance.lastFrame();
assert.ok(frame.includes('Logs for'), 'should show log viewer');
```

**Timeouts:** UI tests need 30s+ timeout due to React rendering cycles.

---

## Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| `useInput(handler)` without isActive | `useInput(handler, { isActive: condition })` |
| `<Box height={N}>` to fill space | Render N explicit `<Text>` nodes |
| `<Box flexGrow={1}>` for spacers | `justifyContent="space-between"` on outer Box |
| Manual row counting for layout | `justifyContent="space-between"` — let Yoga handle gaps |
| Unwrapped text in table columns | `wrap="truncate"` on `<Text>` inside fixed-width cells |
| `useStdout()` in child components | Pass `terminalRows` as prop from parent |
| `stdout.rows` in render/memo deps | `useState` + resize listener → `termRows` |
| `setRefreshKey(k => k+1)` to refresh | Poll in `setInterval`, compare JSON before `setData` |
| Exit Ink for interactive prompts | Build Ink components for confirmations |
| Edit `.js` files directly | Edit `.jsx`, run `node test/build-jsx.mjs` |
| Empty string `''` in `<Text>` | Space `' '` (empty = zero height) |
| Single `useInput` for all views | Separate `useInput` per view with `isActive` guards |

---

## Debugging Checklist

When an Ink UI bug appears:

1. **Shortcuts broken?** → Check `useInput` has `{ isActive }` and only one view is active
2. **Old content visible after view switch?** → Wrap sub-view in `<Box height={termRows}>`
3. **Content doesn't fill terminal?** → Pad with `<Text>{' '}</Text>` nodes
4. **Crashes in tests?** → Check for `useStdout()` calls — move to parent, pass as prop
5. **JSX changes not taking effect?** → Run `node test/build-jsx.mjs`
6. **Flicker on refresh?** → Compare data JSON before `setData`, remove refresh counter state
7. **Flicker on arrow keys?** → Pad count must not depend on `selectedIndex`; avoid `flexGrow` spacers
8. **Layout wrong after terminal resize?** → Use `useState` + resize listener, not `stdout.rows` directly
9. **Header pushed off top?** → Use `justifyContent="space-between"` instead of manual padding; row counting is unreliable
10. **Table text wrapping?** → Add `wrap="truncate"` to `<Text>` inside table cells
