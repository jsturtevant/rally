# Session Log: 2026-02-21 — PRD: Onboard + Dispatch Expansion

**Date:** 2026-02-21  
**Lead:** Mal (Lead)  
**Duration:** Two sessions (22:47–22:51)  
**Outcome:** Onboard command expanded with GitHub URL + team selection; dispatch restructured as subcommands

## Summary

Updated `docs/PRD.md` to expand onboarding workflow and restructure dispatch command syntax:

1. **Onboard expansion (§3.2):** Added GitHub URL support (`https://github.com/owner/repo` and `owner/repo`), configurable projects directory, and team selection prompt (shared vs. project-specific). `projects.yaml` schema expanded to track team type and location.

2. **Dispatch restructuring (§3.3–3.4):** Replaced implicit+flag syntax with explicit subcommands (`dispatch issue <num>` and `dispatch pr <num>`), both supporting `--repo <owner/repo>` flag with inference fallback.

3. **State layout:** `~/.rally/` gains `teams/` (project-specific) and `projects/` (cloned repos). §8.2 (per-project vs shared team) partially resolved.

## Decisions Filed

- `mal-onboard-expansion.md` — Onboard command expansion
- `mal-dispatch-subcommands.md` — Dispatch subcommand syntax

## Next

Implementation team (Kaylee, Wash) to implement onboard GitHub clone + team selection and dispatch subcommand routing.
