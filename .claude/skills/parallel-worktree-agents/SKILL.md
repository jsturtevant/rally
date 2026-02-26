---
name: parallel-worktree-agents
description: Pattern for running multiple sub-agents in parallel using git worktrees. Use this when working on multiple issues/PRs simultaneously.
---

# Parallel Worktree Agents

Run multiple sub-agents in isolated git worktrees to parallelize work across issues and PRs. Each agent gets its own working copy so there are no file conflicts.

## When to Use

- Working on 2+ issues/PRs simultaneously
- Batch processing open issues or PR reviews
- Any parallelizable work that touches different files

## Setup: Create Worktrees

Create a worktree per issue/PR from `origin/main`. Use `/tmp/` if the repo's parent directory has restricted permissions:

```bash
cd <repo-root>
git fetch origin main
git worktree add /tmp/<repo>-<number> -b <branch-prefix>/<number>-<slug> origin/main
```

**Branch naming conventions:**
- Issues: `fix/<number>-<slug>`, `refactor/<number>-<slug>`, `feat/<number>-<slug>`
- PRs: `review/<number>-<slug>`
- Docs: `docs/<number>-<slug>`
- Deps: `chore/<number>-<slug>`

**Important:** Always create branches from `origin/main`, not from `HEAD`, to prevent cross-PR contamination when multiple agents work in parallel.

## Dispatch: Launch Agents

Use the `task` tool with `mode: "background"` and `agent_type: "general-purpose"` for each worktree:

```
task(
  agent_type: "general-purpose",
  mode: "background",
  description: "Fix #<number> <short-desc>",
  prompt: "Work in worktree `/tmp/<repo>-<number>` on branch `<branch>`..."
)
```

### Agent Prompt Template

Each agent prompt should include:
1. **Worktree path and branch name** — where to `cd` and what branch they're on
2. **Issue/PR description** — what to fix
3. **Codebase conventions** — import style, error patterns, test patterns
4. **Steps** — specific actions: edit, test, commit, push, create PR
5. **PR creation command** — include `gh pr create` with title, body, `--base main`

### Parallelism Limits

- **Max 5 agents at a time** to avoid resource contention
- Each agent is stateless — provide complete context in the prompt
- Agents cannot coordinate with each other — plan dependencies upfront

## Monitor: Wait for Completion

```
read_agent(agent_id: "agent-N", wait: true, timeout: 300)
```

Poll multiple agents in parallel:
```
read_agent(agent_id: "agent-1", wait: true, timeout: 300)
read_agent(agent_id: "agent-2", wait: true, timeout: 300)
# ... up to 5
```

## Review: Handle Copilot Feedback

After PR creation, Copilot reviews arrive within ~60-90 seconds. Check with:

```bash
gh pr view <number> --json reviews --jq '.reviews[] | "\(.author.login): \(.state)"'
```

Read review threads:
```
github-mcp-server-pull_request_read(method: "get_review_comments", pullNumber: <N>)
```

Dispatch a fix agent to the same worktree/branch to address comments, then resolve threads via GraphQL:

```bash
# Get thread IDs
gh api graphql -f query='{ repository(owner: "OWNER", name: "REPO") { pullRequest(number: N) { reviewThreads(first: 20) { nodes { id isResolved } } } } }'

# Resolve each thread
gh api graphql -f query='mutation { resolveReviewThread(input: {threadId: "THREAD_ID"}) { thread { isResolved } } }'
```

## Merge: Sequential Rebase

PRs that touch overlapping files must be merged **sequentially** — each merge changes `main`, so subsequent PRs need rebase:

```bash
# Merge first PR
gh pr merge <N> --squash --delete-branch --admin

# Rebase next PR in its worktree
cd /tmp/<repo>-<next>
git fetch origin main
git rebase origin/main
# Resolve conflicts if needed
GIT_EDITOR=true git rebase --continue  # headless rebase
git push --force-with-lease origin <branch>

# Then merge
gh pr merge <next> --squash --delete-branch --admin
```

**Merge order:** Security fixes → bug fixes → features → refactors → docs

## Cleanup: Remove Worktrees

After all PRs are merged:

```bash
cd <repo-root>
git worktree remove /tmp/<repo>-<number> --force
# Repeat for each worktree
```

The `--force` flag handles the case where the branch was already deleted by the merge.

## Tracking with SQL

Use the session SQL database to track agent work:

```sql
INSERT INTO todos (id, title, status) VALUES ('i42', '#42 Fix auth bug', 'pending');
-- Before dispatching:
UPDATE todos SET status = 'in_progress' WHERE id = 'i42';
-- After PR merged:
UPDATE todos SET status = 'done' WHERE id = 'i42';
```

## Common Pitfalls

1. **Worktree in restricted parent dir** — Use `/tmp/` prefix if `git worktree add` fails with permission errors
2. **Branch already exists** — Use `git worktree add /tmp/X -B branch origin/main` (capital `-B`) to force-reset
3. **Merge conflicts after prior merge** — Always `git fetch origin main && git rebase origin/main` in the worktree before merging
4. **Stale Copilot review on old base** — If a review flags something already fixed in main, reply explaining and resolve the thread
5. **Local branch deletion fails** — Expected when worktree still references it; the remote branch is deleted by `--delete-branch`
6. **Ink ESM exit delay** — UI tests need `--test-force-exit` flag due to ~35s delay from es-toolkit/compat
