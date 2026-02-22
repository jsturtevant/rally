# Zero-Dependency Reference Cleanup

**By:** Mal (Lead)  
**Date:** 2026-02-22  
**Status:** Complete

## Summary

Fixed all stale "zero-dependency" references across team documentation following the PRD review. The Dependency Pivot decision (adopted Ink, Chalk, Ora, Commander, js-yaml, @inquirer/prompts) made the zero-dependency claims factually incorrect.

## Changes Made

### 1. `.squad/team.md` (line 25)
**Was:** `Stack: Node.js (zero dependencies, node:test)`  
**Now:** `Stack: Node.js with CLI production stack (Ink, Chalk, Ora, Commander, js-yaml, @inquirer/prompts; node:test for testing)`

### 2. `.squad/agents/kaylee/charter.md` (line 21)
**Was:** `- Zero runtime dependencies — Node.js built-ins only`  
**Now:** `- Production CLI stack: Ink, Chalk, Ora, Commander, js-yaml, @inquirer/prompts — no hand-rolled UI or parsing`

### 3. `.squad/agents/kaylee/charter.md` (line 53)
**Was:** `Follows the squad-conventions skill to the letter. Will remind you about zero-dep if you forget.`  
**Now:** `Follows the squad-conventions skill to the letter. Uses the production CLI stack (Ink, Chalk, Ora, Commander, js-yaml, @inquirer/prompts) — no hand-rolled modules.`

### 4. `.squad/agents/jayne/charter.md` (line 20)
**Was:** `- Use node:test and node:assert/strict — no test frameworks`  
**Now:** `- Use node:test and node:assert/strict for unit tests; ink-testing-library for UI component tests`

### 5. `.squad/agents/scribe/history.md` (line 5)
**Was:** `- Stack: Node.js (zero dependencies, node:test)`  
**Now:** `- Stack: Node.js with CLI production stack (Ink, Chalk, Ora, Commander, js-yaml, @inquirer/prompts; node:test for testing)`

### 6. `.squad/skills/squad-conventions/SKILL.md` (lines 1-10)
**Status:** This skill documents conventions for Squad (create-squad), not Dispatcher. Deprecated with note explaining it's about the wrong project. Added pointer to Dispatcher-specific guidance in `.squad/agents/*/charter.md` and `.squad/decisions.md` → Dependency Pivot.

### 7. `.squad/decisions.md` (appended new entry)
**Added:** Follow-up note (append-only) documenting that js-yaml supersedes the hand-rolled YAML parser mentioned in Decision #3. Did NOT modify the original decision — preserved for historical record.

## Verification

- Searched entire `.squad/` and `docs/` for remaining stale references: "zero-dep", "zero dep", "hand-roll", "hand roll", "no dependencies", "zero dependencies"
- `docs/PRD.md` is clean — dependency pivot already reflected
- History files preserved as-is (historical records)
- No breaking changes to team workflows or conventions

## What This Resolves

Fixes the four critical findings from the PRD review conducted by Mal, Wash, Kaylee, and Jayne:
- Removed contradiction between PRD (lists npm deps) and team docs (claimed zero-dep)
- Updated all agent charters to match the dependency pivot decision
- Clarified testing strategy (node:test + ink-testing-library)
- Marked obsolete skill as deprecated with clear redirect to Dispatcher docs
