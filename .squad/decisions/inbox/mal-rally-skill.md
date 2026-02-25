# Decision: Agent skill path convention

**Author:** Mal
**Date:** 2025-07-24
**Issue:** #332

## Context

We needed a skill file to teach AI agents how to use Rally. Both Claude Code and GitHub Copilot CLI support `.claude/skills/` as a skill discovery path.

## Decision

Use `.claude/skills/rally/SKILL.md` as the single skill file location. Both Claude Code and Copilot CLI read from this path, so one file serves both tools. No need to duplicate into `.github/skills/`.

## Impact

Any future skill files should follow this pattern: `.claude/skills/<tool>/SKILL.md`. This keeps skills discoverable by both AI coding tools without duplication.
