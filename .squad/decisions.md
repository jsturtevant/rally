# Decisions

Team decisions that affect how we work. All agents read this before starting work.

<!-- Scribe merges entries from .squad/decisions/inbox/ into this file. -->

---

## Decision: PRD Draft — Architecture & State Management

**By:** Mal (Lead)  
**Date:** 2026-02-21  
**Status:** Proposed

### Decision

Drafted the initial PRD (`docs/PRD.md`) establishing:

1. **Three-file state model** under `~/.dispatcher/`: `config.yaml`, `projects.yaml`, `active.yaml`. File-based, zero dependencies, human-readable, YAML format.
2. **Symlink + exclude as the core pattern.** `onboard` creates symlinks and writes `.git/info/exclude`. This is the foundational technique — everything else builds on it.
3. **Worktrees inside the repo** at `.worktrees/dispatcher-<N>/` with `dispatcher/<N>-<slug>` branch naming.
4. **Module-per-command structure** in `lib/` with shared utilities.

**Update (2026-02-21 22:47):** Config file format changed from JSON to YAML per user directive. See Decision: Config file format changed from JSON to YAML below.

### Open Questions (need team input)

- How does Dispatcher invoke Squad after worktree setup? (Option A: just set up + print instructions, Option B: invoke Squad CLI, Option C: open VS Code)
- Per-project vs. shared team state?
- Windows symlink fallback strategy?

### Impact

All agents should read `docs/PRD.md` before implementing any command. It has CLI specs, error cases, and state formats.

---

## Decision: PRD Target Users & No CI/CD

**By:** Mal (Lead)  
**Date:** 2026-02-21  
**Status:** Accepted

### Decision

Updated `docs/PRD.md` §2 (Target Users) and removed all CI/CD references per user directive:

1. **Target users are individual developers on shared repos.** Not teams adopting Squad together — it's one person using Squad where the rest of the team doesn't. Examples: open source projects, large repos where committing `.squad/` isn't appropriate.

2. **No CI/CD integration.** Dispatcher will not integrate with GitHub Actions, CI pipelines, or any automated triggers. Removed the "Secondary: CI/CD pipelines" section and all related mentions.

### Impact

All agents must treat these as hard constraints:
- Don't design features assuming CI/CD triggers or pipeline integration
- Target the solo-developer-on-shared-repo use case, not team adoption
- Reference the updated PRD before implementing any command

---

## Decision: Config file format changed from JSON to YAML

**By:** Mal (Lead)  
**Date:** 2026-02-21  
**Status:** Accepted

### Context

User directive received: use YAML for config files instead of JSON.

### Decision

All three config files now use `.yaml` extension and YAML syntax in PRD:
- `~/.dispatcher/config.yaml` (was config.json)
- `~/.dispatcher/projects.yaml` (was projects.json)
- `~/.dispatcher/active.yaml` (was active.json)

### Rationale

YAML is more human-readable for config files, especially ones users may hand-edit.

### Key Consideration: Hand-rolled YAML Parser

**Node.js has no built-in YAML parser.** This is a zero-dependency project. The `config.js` module will need a hand-rolled YAML parser and serializer. Our config structures are simple (flat keys, one-level arrays of objects), so a minimal parser covering only what we use is practical and keeps us zero-dependency.

If config complexity grows in future, revisit this decision.

### Scope

- `docs/PRD.md` only — all config references and code examples updated to YAML syntax
- `package.json` and Squad export files (`.json`) remain unchanged per deliberate choice
