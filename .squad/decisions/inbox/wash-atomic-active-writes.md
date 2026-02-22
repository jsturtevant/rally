# Decision: active.yaml uses atomic writes via temp+rename

**By:** Wash (Integration Dev)
**Date:** 2026-02-22
**Status:** Implemented

## Decision

`lib/active.js` writes active.yaml atomically: write to `.active.yaml.tmp`, then `renameSync` to `active.yaml`. This prevents partial/corrupt files if the process crashes mid-write.

Other config files (`config.yaml`, `projects.yaml`) in `lib/config.js` still use direct `writeFileSync`. If atomicity matters there too, same pattern applies.

## Impact

- `lib/active.js` owns all dispatch CRUD — don't bypass with raw `writeActive()` from config.js
- The `.active.yaml.tmp` file should be in `.gitignore` if it ever appears in a repo context
