# Work Routing

How to decide who handles what.

## Routing Table

| Work Type | Route To | Examples |
|-----------|----------|----------|
| Architecture, CLI design, scope | Mal | Command structure, workflow design, decisions |
| Git/GitHub integration, worktrees | Wash | Worktree management, GitHub API, gh CLI, issue lifecycle |
| CLI commands, orchestration logic | Kaylee | Command implementation, argument parsing, output formatting |
| Code review | Mal | Review PRs, check quality, suggest improvements |
| Testing | Jayne | Write tests, find edge cases, verify fixes |
| Scope & priorities | Mal | What to build next, trade-offs, decisions |
| Session logging | Scribe | Automatic — never needs routing |

## Issue Routing

| Label | Action | Who |
|-------|--------|-----|
| `squad` | Triage: analyze issue, assign `squad:{member}` label | Mal |
| `squad:{name}` | Pick up issue and complete the work | Named member |

## Rules

1. **Eager by default** — spawn all agents who could usefully start work, including anticipatory downstream work.
2. **Scribe always runs** after substantial work, always as `mode: "background"`. Never blocks.
3. **Quick facts → coordinator answers directly.** Don't spawn an agent for factual questions.
4. **When two agents could handle it**, pick the one whose domain is the primary concern.
5. **"Team, ..." → fan-out.** Spawn all relevant agents in parallel as `mode: "background"`.
6. **Anticipate downstream work.** If a feature is being built, spawn the tester to write test cases from requirements simultaneously.
