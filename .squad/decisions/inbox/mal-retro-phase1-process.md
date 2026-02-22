# Retrospective: Phase 1 Implementation Sprint — Process Failure Analysis

**Facilitated by:** Mal (Lead)  
**Date:** 2026-02-22  
**Status:** Complete  
**Request from:** James Sturtevant

---

## Executive Summary

Phase 1 implementation reveals a critical workflow failure: **all code was committed directly to `main` instead of via feature branches and PRs.** The directive was clear ("Every PR must include tests. CI runs on every PR. Full review before merge. No code without tests"), but the execution bypassed that entire workflow entirely. This retro diagnoses why, and proposes a concrete branching and PR strategy for Phase 2.

---

## What Went Wrong

### Facts (Observable)

1. **All Phase 1 code committed directly to main.** Commits are on `main` branch only. No feature branches exist. No PRs were created.
   - `3cc1279 feat: scaffold Rally CLI project (#1)` — direct to main
   - `2a35033 feat: implement CI workflow and comprehensive tests for worktree/github modules (#5, #6)` — direct to main
   - `dd81552 docs: add comprehensive testing strategy (#8)` — direct to main

2. **CI workflow exists but was never triggered.** `.github/workflows/ci.yml` is in the repo but has zero PR runs. Can't verify it works because no PR exercised it.

3. **Code review was skipped.** Mal never reviewed code. Jayne never reviewed tests. No approval gate, no feedback, no iteration.

4. **Only 1 issue closed via normal workflow.** Issue #1 (scaffold) is done. Issues #2–#8 are still open, despite code for them being in main already. GitHub issue/commit linkage is broken.

5. **5 agents worked in parallel but all on same branch.** Merge conflicts waiting to happen. Coordination via commit messages, not pull requests.

### Why This Happened

**Root cause: Coordinator's execution model bypassed the intended workflow.**

- **The coordinator spawned agents with instructions to `git commit` directly.** No mention of feature branches. No mention of opening PRs. The task said "implement Phase 1" and agents took that to mean "commit to main."
- **No branch strategy was defined upfront.** PRD describes workflow but doesn't specify the operational git commands. Agents improvised.
- **Agents defaulted to simplest path.** `git commit -m "message"` and `git push` is simpler than `git checkout -b`, `git push`, `gh pr create`. No incentive to do extra work without explicit instruction.
- **No gate checking for PRs.** No tool enforced the "must be a PR" rule. No one (not even Mal) validated it upfront.
- **Coordinator didn't communicate review expectation to agents.** They knew tests were required but didn't know Mal would review code or Jayne would review tests.

---

## Root Cause Analysis

### Process Failure Points

| Point | What Should Have Happened | What Actually Happened |
|-------|---------------------------|------------------------|
| **Pre-sprint briefing** | Mal briefs agents: "Every change = feature branch → PR → review → merge" | Agents got task descriptions but no workflow diagram |
| **Branch strategy** | Defined: "one branch per issue, `rally/<issue>-<slug>` naming" | No explicit instruction; agents did whatever was simplest |
| **Agent instructions** | "Create a feature branch, open a PR, request review" | "Implement feature X and commit to main" |
| **Review gate** | Mal/Jayne assigned as reviewers, agents wait for approval | No pull request step = no review opportunity |
| **CI integration** | Agents see: "PR created → CI runs → tests must pass → review → merge" | No PR = CI never runs = no validation before main |
| **Issue tracking** | Each PR closes the linked issue (e.g., `Fixes #2`) | Issues and commits decoupled; issues still open |

### Contributing Factors

1. **This is a solo-dev project with AI agents.** Typical team workflows (branch → PR → review → merge) weren't enforced because "one person + 5 bots" feels informal.
2. **Agents are autonomous.** No human standing between commit and push. Once an agent gets `git commit` permission, they use it.
3. **No CI blocker.** The workflow file exists but because no PR triggers it, there's no automated "stop if tests fail" gate.
4. **Onboarding gap.** Agents weren't explicitly shown what a "correct" workflow looks like in this project.

---

## What James Is Asking

1. **Why were there no PRs and code reviews?**  
   → Because the coordinator (and Mal) didn't explicitly require them in agent task instructions. Agents defaulted to direct commits.

2. **Can we use worktrees to split work and create proper PRs?**  
   → Yes. Worktrees are designed exactly for this: one worktree per feature branch, agents can work in parallel without stepping on each other.

3. **What's the best workflow for GitHub with PRs going forward?**  
   → See "Proposed Workflow for Phase 2" below.

---

## Proposed Workflow for Phase 2 & Beyond

### Recommended Approach: Option C (Parallel Worktrees per Agent)

**Why Option C (not A or B):**
- **Option A (one branch per issue):** Simple but creates 20+ tiny PRs. Code review overhead, slower merge cycle.
- **Option B (one branch per batch):** Fewer PRs but higher risk of conflicts. Sequential review.
- **Option C (parallel worktrees per agent):** Maximum parallelism. Each agent works independently on their own branch/worktree. Reviews are sequential (Mal reviews in order), merge is immediate after approval. This is the sweet spot for an AI team.

### The Workflow: Phase 2 & Forward

#### 1. Sprint Planning (Mal)

- **Assign issues to agents** by capability (Kaylee: core, Wash: integration, Jayne: tests)
- **Create a dispatch plan** document (e.g., `.squad/phase-2-dispatch-plan.md`) listing:
  - Which agent owns which issue(s)
  - Branch name each agent will use (`rally/<issue>-<slug>`)
  - Dependency order (if X must be done before Y)
  - Estimated review order

**Example:**
```
Phase 2 Dispatch Plan

Kaylee:
  - #9 (setup command) → rally/9-setup
  - #10 (onboard local) → rally/10-onboard-local

Wash:
  - #11 (GitHub URL cloning) → rally/11-onboard-github-url
  - Depends on: #10 complete

Jayne:
  - #12 (team selection prompt) → rally/12-team-selection
  - Depends on: #10 complete
```

#### 2. Agent Onboarding (Mal → Each Agent)

**Before agents start work:**

```
Checkpoint: Rally Phase 2

You are assigned issues: #9, #10
Branch names: rally/9-setup, rally/10-onboard-local
Workflow you MUST follow:

1. Create a worktree:
   git worktree add .worktrees/rally-9 --track origin/main -b rally/9-setup

2. Do your work in the worktree (not main):
   cd .worktrees/rally-9
   [implement feature]
   npm test  # must pass
   git add .
   git commit -m "feat: implement setup command (#9)"

3. Push and open a PR:
   git push -u origin rally/9-setup
   gh pr create --title "feat: setup command (#9)" --body "Closes #9" --draft

4. WAIT for Mal's review (DO NOT MERGE):
   gh pr view 42 --json status,reviews

5. After approval, remove draft status and merge:
   gh pr ready 42
   gh pr merge 42 --admin --delete-branch

6. Clean up your worktree:
   cd ../..
   git worktree remove .worktrees/rally-9

IMPORTANT:
- Every commit must have tests (npm test passes locally)
- Every PR must pass CI (wait for GitHub Actions)
- Every PR must be reviewed by Mal (code) and may be reviewed by Jayne (tests)
- Do NOT merge without approval
- Do NOT commit to main directly
```

#### 3. Parallel Development (Agents)

- **Each agent has their own worktree** → no conflicts, can work truly in parallel
- **Independent branches** → isolated changes
- **Local testing before push** → high quality PRs

#### 4. Code Review (Mal)

- **Review PRs in order of dependency** (e.g., review #9 before #10)
- **Checklist:**
  - ✓ Feature works as described
  - ✓ Tests are present and pass
  - ✓ No breaking changes
  - ✓ Code style matches project (see `.squad/skills/code-style/SKILL.md` if exists)
  - ✓ Commit message references issue number
- **Approve or request changes** via `gh pr review <pr-number> --approve` or `--request-changes`

#### 5. Test Review (Jayne)

- **Optional secondary review** of test quality
- **Checklist:**
  - ✓ Tests cover happy path
  - ✓ Tests cover error cases
  - ✓ Tests are readable and maintainable
  - ✓ Coverage is adequate (aim for >80% of changed code)
- **Comment on PR if issues found, don't block merge** (Mal can address in follow-up)

#### 6. Merge (Mal)

- **After approval**, mark PR as ready (if draft) and merge to main
- **GitHub Actions must pass** before merge (CI is a hard gate)
- **Delete branch after merge** (keep repo clean)

#### 7. Issue Tracking

- **Each PR closes 1–3 related issues** via commit message: `Fixes #9, #10` or `Closes #11`
- **GitHub auto-closes issue when PR merges** (verify on issue page)

---

## Git Worktree Mechanics (For Agents)

### Why Worktrees?

- Multiple branches can be checked out simultaneously without `git stash` gymnastics
- Agents can work on different branches at the exact same time
- Zero merge conflict risk (separate working directories)
- Easy cleanup (remove worktree, branch remains for git history)

### Workflow for Each Agent

```bash
# Agent gets assigned issue #9

# Step 1: Create worktree + branch
git worktree add .worktrees/rally-9 --track origin/main -b rally/9-setup
cd .worktrees/rally-9

# Step 2: Do work
# ... edit files, write tests, commit ...
git add .
git commit -m "feat: implement setup command (#9)"

# Step 3: Push branch and open PR
git push -u origin rally/9-setup
gh pr create --title "feat: setup command (#9)" --body "Closes #9" --draft

# Step 4: Wait for approval (in another shell or polling)
# ... Mal reviews, approves ...

# Step 5: Ready and merge
gh pr ready 42
gh pr merge 42 --admin --delete-branch

# Step 6: Clean up worktree
cd ../..
git worktree remove .worktrees/rally-9
```

### Coordinator's Role (Spinning Up Phase 2)

```bash
# For each agent/issue:
git worktree add .worktrees/rally-<issue> --track origin/main -b rally/<issue>-<slug>
# Push empty branch so agents can track it
git push -u origin rally/<issue>-<slug>
# Tell agent: "Your worktree is ready at .worktrees/rally-<issue>, branch is rally/<issue>-<slug>"
```

---

## Action Items for Phase 2

### Immediate (Before Phase 2 Sprint Starts)

1. **Mal:** Write "Rally Phase 2 Dispatch Plan" to `.squad/phase-2-dispatch-plan.md`
   - Assign issues #9–#13 to agents (Kaylee core, Wash integration, Jayne tests)
   - Specify branch names
   - Call out dependencies

2. **Mal:** Create a "Rally Development Workflow" guide (e.g., `.squad/skills/rally-development-workflow/SKILL.md`)
   - Copy the "Proposed Workflow" above verbatim
   - Add examples of branch names for common issue types
   - Include gotchas (don't merge own PR, wait for CI)

3. **Coordinator:** Set up worktrees for Phase 2 agents
   - Create `.worktrees/rally-9`, `.worktrees/rally-10`, etc.
   - Push empty branches so agents can track them
   - Notify agents: "Your branch is ready"

4. **Mal:** Update `.squad/agents/mal/history.md` with this retrospective
   - Include root cause analysis
   - Include the recommended workflow
   - Reference this retro document

### Before Each PR Merge

1. **Agent:** Ensure `npm test` passes locally before pushing
2. **CI:** Automatically run on PR creation (GitHub Actions)
3. **Mal:** Review and approve (or request changes)
4. **Jayne:** Optionally review test coverage
5. **Agent:** Merge PR after approval + green CI

### Ongoing (Process Discipline)

- **No direct commits to main.** Every change goes through a PR.
- **Every PR requires at least one approval** (Mal's code review).
- **Every PR must have passing tests.** `npm test` must pass locally and in CI.
- **Link PRs to issues.** Include `Fixes #N` in commit message or PR body.
- **Review in dependency order.** If #10 depends on #9, don't merge #10 before #9.

---

## Why This Will Work

### For Agents (Why They'll Follow the Workflow)

1. **Explicit instructions.** Clear task assignment with workflow steps.
2. **Worktrees make it easy.** No git gymnastics, just `git worktree add` and they're ready.
3. **Safety gate.** CI won't pass without proper branch + PR + tests.
4. **Immediate feedback.** They know Mal will review and approve quickly.

### For Mal (Why Reviews Will Happen)

1. **Async workflow.** Mal can review PRs on their schedule (no blocking meetings).
2. **Clear criteria.** Know what to check for (from review checklist above).
3. **Bottleneck is OK.** Reviews are sequential, not parallel, so one person can handle 5 agents.
4. **Issues close automatically.** No manual issue tracking overhead.

### For James (Why Process Integrity Will Stick)

1. **Worktrees prevent merge conflicts.** Agents don't fight over the same branch.
2. **PRs + CI = quality gate.** Code doesn't land without tests passing + review.
3. **Transparent progress.** Every PR is visible on GitHub (open, closed, merged).
4. **Parallelism retained.** 5 agents work simultaneously, still hitting the review gate in order.

---

## Comparison: Then vs. Now

| Aspect | Phase 1 (What Happened) | Phase 2 (Proposed) |
|--------|------------------------|-------------------|
| **Commits** | Direct to main | Via feature branches |
| **Review** | None | Mandatory (Mal) |
| **Testing** | Code exists but not linked to issue | Tests required before PR, CI validates |
| **Parallelism** | 5 agents on same branch (risky) | 5 agents on separate worktrees (safe) |
| **Issue tracking** | Commits and issues decoupled | PR closes issue automatically |
| **CI** | Workflow exists, never triggered | Runs on every PR, required gate |
| **Merge authority** | No gate | Mal approves, GitHub Actions must pass |

---

## Key Learnings

1. **Explicit workflow instructions matter.** Agents are smart but not telepathic. If you want PRs, specify "open a PR" as a task step.

2. **Worktrees solve parallelism cleanly.** Instead of fighting git stash/cherry-pick, give each agent their own working directory.

3. **Review bottleneck is OK for small teams.** Mal being the review gate is fine — she can handle 5 parallel PRs reviewed sequentially (one PR at a time, waiting for CI to pass, then merge).

4. **Process > hope.** Phase 1 hoped agents would do the right thing. Phase 2 will enforce it via workflow steps + tooling (CI gate).

---

## Files to Update / Create

1. **Create** `.squad/phase-2-dispatch-plan.md` — Dispatch plan for Phase 2 issues #9–#13 (Mal to write)
2. **Create** `.squad/skills/rally-development-workflow/SKILL.md` — Development workflow guide (Mal to write)
3. **Update** `.squad/agents/mal/history.md` — Add retro findings under "## Learnings" (Mal to append)
4. **Update** `docs/PRD.md` — Add a new section §7 (before §8) on the development workflow (optional, Mal to decide)

---

## Closing

Phase 1 was a learning opportunity, not a failure. The code quality is good; the process wasn't. Phase 2 will lock in the workflow with explicit instructions, worktrees, and review gates. By the time Phase 3 starts, this will be second nature.

**Rally's value proposition is managing git workflows for AI teams. It's fitting that we get our own workflow right before building it for users.**
