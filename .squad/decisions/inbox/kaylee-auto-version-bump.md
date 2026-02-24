# Decision: Auto-bump patch version on PR merge

**Date:** $(date +%Y-%m-%d)
**Author:** Kaylee (Core Dev)
**Issue:** #157
**PR:** #160

## Context
James needs to track which version he's running as development moves fast.

## Decision
Every PR merged to `main` automatically bumps the patch version in `package.json` via GitHub Actions. No manual version bumps needed.

## Details
- Workflow: `.github/workflows/version-bump.yml`
- Infinite loop prevention via commit message prefix check
- Version bump commits include `[skip ci]` to avoid unnecessary CI
- Committer: `github-actions[bot]`

## Implications
- No one should manually bump the patch version — it happens automatically
- Minor/major bumps should still be done manually when needed
- The version in `package.json` on `main` is always the latest
