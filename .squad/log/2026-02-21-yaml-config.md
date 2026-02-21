# Session Log: YAML Config Format Update

**Date:** 2026-02-21  
**Topic:** yaml-config  
**Lead:** Mal  

## Summary

Mal updated `docs/PRD.md` per user directive to use YAML for all config files (config, projects, active) instead of JSON. Flagged that `config.js` module will need hand-rolled YAML parser.

## Decisions Filed

- `.squad/decisions/inbox/mal-yaml-config.md` — config file format change with YAML parser consideration
- `.squad/decisions/inbox/copilot-directive-2026-02-21T22-47.md` — user directive capture

## Cross-Agent Impact

All agents should update their mental model: config files are YAML, not JSON.
