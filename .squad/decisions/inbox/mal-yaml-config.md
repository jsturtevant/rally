# Decision: Config file format changed from JSON to YAML

**Date:** 2025-02-21
**Author:** Mal (Lead)
**Status:** Accepted

## Context

James requested that all Dispatcher config files (`config`, `projects`, `active`) use YAML format instead of JSON.

## Decision

- All three config files now use `.yaml` extension and YAML syntax in the PRD.
- The `config.js` module description in §4.3 now notes it will need a hand-rolled YAML parser/serializer.

## Rationale

YAML is more human-readable for config files, especially ones users may hand-edit. The flat/shallow structure of our config files makes hand-rolled parsing feasible.

## Consideration

This is a zero-dependency Node.js project. Node has no built-in YAML parser. The `config.js` module will need a hand-rolled YAML parser and serializer. Our config structures are simple (flat keys, one-level arrays of objects), so a minimal parser covering only the subset we use is practical. If config complexity grows, this decision should be revisited.

## Scope of change

- `docs/PRD.md` only — no code changes.
- `package.json` and Squad export files (`.json`) were intentionally left unchanged.
