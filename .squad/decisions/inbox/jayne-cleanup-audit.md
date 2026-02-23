# Cleanup Audit: test/ui/*.test.js — Ink render cleanup

**Author:** Jayne (Tester)
**Date:** 2026-02-22
**Branch:** rally/retro-actions

## Summary

Audited all 5 files in `test/ui/` for proper Ink `render()` cleanup. Found **1 file with missing cleanup** (already being addressed by Kaylee). All other files are clean.

## Findings

| File | render() calls | Cleanup method | Status |
|---|---|---|---|
| `StatusMessage.test.js` | 5 | `afterEach(() => { cleanup(); })` | ✅ Clean |
| `DispatchBox.test.js` | 3 | `afterEach(() => { cleanup(); })` | ✅ Clean |
| `Dashboard.test.js` | 5 | `instance.unmount()` in `afterEach` | ✅ Clean |
| `non-tty.test.js` | 0 (plain text only) | N/A — no Ink rendering | ✅ N/A |
| `DispatchTable.test.js` | 9 | **NONE** | 🔴 Missing |

## Details: DispatchTable.test.js

- **9 `render()` calls** across 7 tests, zero cleanup.
- No `afterEach` hook. No `cleanup()` import. No `unmount()` calls.
- Destructures only `lastFrame` from `render()`, discarding the instance handle.
- Lines 77, 80, 92, 95 chain `render(...).lastFrame()` with no reference retained at all.
- **Kaylee is already fixing this** — no action needed from anyone else.

## Details: Dashboard.test.js — acceptable pattern

- Uses `let instance` + `instance.unmount()` instead of `cleanup()`. This is fine — `unmount()` is per-instance cleanup, equivalent to calling `cleanup()` when only one instance is rendered at a time. All 5 renders are assigned to `instance` before the next `afterEach` fires.

## Recommendation

No additional files need cleanup fixes beyond DispatchTable.test.js (which Kaylee owns).
