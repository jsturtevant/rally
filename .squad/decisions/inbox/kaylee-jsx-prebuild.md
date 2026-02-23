# Decision: JSX Pre-Build Replaces Loader Hook

**Author:** Kaylee (Core Dev)  
**Date:** 2026-02-23  
**Branch:** rally/25-non-tty

## Context

The `--loader ./test/jsx-loader.mjs` approach caused `node --test` to re-initialize esbuild in every child process (~36s per file). With 5 UI test files, that's ~3 minutes of pure startup overhead.

## Decision

Replaced `--loader` with a pre-build step (`test/build-jsx.mjs`) that compiles all `.jsx` → `.js` files once before tests run. All imports now reference the compiled `.js` files. The `--loader` flag and `jsx-loader.mjs` hooks are no longer used by tests.

## Impact

- **Test script:** `node test/build-jsx.mjs` runs before all tests
- **All `.jsx` imports changed to `.js`** in `lib/ui/index.js`, `bin/rally.js`, and test files
- **`test/jsx-loader.mjs` retained** but no longer referenced by test script (can be removed in a future cleanup)
- **`bin/rally.js`** now imports compiled `.js` files — the build step must run before the CLI dashboard command works
- **Compiled `.js` files are gitignored** — `npm install && npm run build` (or `npm test`) needed to generate them

## Team Action

- If adding new `.jsx` components, add them to the `jsxFiles` array in `test/build-jsx.mjs`
- Consider adding `"prepare": "node test/build-jsx.mjs"` to auto-build after install
