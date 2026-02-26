---
name: "PR Review Process for Rally"
description: "Dual-review PR workflow: Copilot automated code review + Mal manual team review. All comments must be addressed (fix or explain). Out-of-scope work opens GitHub issues with @copilot assignment."
domain: "workflow, code-review, process, github"
confidence: "medium"
source: "phase-2-validation, user-directive-2026-02-22"
tools: ["gh", "git"]
---

## Context

Rally's PR review process evolved from Phase 2 implementation (PRs #30–#34) where Copilot-only automated review identified code issues across 8 review cycles. **Phase 3+ incorporates a mandatory team reviewer (Mal, Lead) in addition to Copilot.** Both reviewers must approve before merge. This skill formalizes the complete workflow, including how to handle out-of-scope feedback by opening GitHub issues.

**Key change:** From single-path (Copilot automatic) to dual-gate (Copilot automatic + Mal manual). All agent and reviewer responsibilities are explicit.

---

## Patterns

### 1. PR Creation: Branch Naming, Commits, Description, Reviewers

**Branch naming convention:** `rally/<issue-number>-<slug>`
- Links commits back to GitHub issues
- Spaces grouped by repo prefix (`rally/`)
- Example: Issue #14 (dispatch issue) → `rally/14-dispatch-issue`

**Commit message format:**
```
feat/fix/refactor: <short description>

<optional detailed explanation>

Closes #<issue-number>
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

**PR description template:**
```
Closes #<issue-number>

## Changes
- **<file>**: <what this file does>
- **test/<file>**: <what tests cover>

## Acceptance Criteria
- [x] Criterion 1
- [x] Criterion 2
- [x] Criterion 3

## Test Results
All <N> tests pass (X existing + Y new).
```

**Request reviewers:**
```bash
# Copilot runs automatically
# Request Mal manually
gh pr edit <number> --add-reviewer jsturtevant
```

**Why:** Acceptance criteria checklist makes review concrete. File summary helps reviewers quickly understand scope. Test count shows quality.

---

### 2. Dual-Review Process: Wait for Both Copilot & Mal

**Timeline:**
1. **Copilot review** (automatic, 2–5 minutes) — GitHub Actions triggers, leaves code comments
2. **Mal review** (manual, 5–30 minutes) — Pulls diff, reads context, posts comments
3. **Agent responds** (parallel) — Addresses all comments from both reviewers

**What agent does while waiting:**
- Poll every 5–10 minutes with `gh pr view <number> --json reviews`
- Read Copilot comments when they arrive (don't wait for Mal)
- Wait for Mal to post (typical: 10–30 min depending on queue)
- Don't push new commits until all comments are visible

**What Mal does (team reviewer):**
1. Waits for Copilot to finish (same code state)
2. Pulls full diff: `gh pr diff <number>` — read every changed line
3. Reads related source files for context (bin/, lib/, test/, PRD)
4. **Posts INLINE review comments on specific file+line** — NOT general PR comments.
   Use the GitHub PR review API to attach comments to the exact line of code:
   ```bash
   # Submit a review with inline comments (preferred):
   gh api repos/{owner}/{repo}/pulls/{number}/reviews \
     --method POST \
     -f event=COMMENT \
     -f body="Overall review summary" \
     --jsonc '{"comments": [
       {"path": "lib/dispatch.js", "line": 42, "body": "This needs null-checking"},
       {"path": "lib/active.js", "line": 15, "body": "Use atomic write pattern here"}
     ]}'
   
   # Or create individual inline comments:
   gh api repos/{owner}/{repo}/pulls/{number}/comments \
     --method POST \
     -f path="lib/dispatch.js" \
     -F line=42 \
     -f side=RIGHT \
     -f body="This needs null-checking" \
     -f commit_id="$(gh pr view {number} --json headRefOid -q .headRefOid)"
   ```
   **NEVER use `gh pr comment` for code feedback** — that posts a general PR comment
   with no file/line context. Only use `gh pr comment` for non-code discussion.
5. Monitors agent responses in threads
6. Posts approval/request-changes via `gh pr review`:
   ```bash
   gh pr review <number> --approve --body "LGTM — all criteria met"
   gh pr review <number> --request-changes --body "See inline comments"
   ```

**Mal's review checklist:**
- [ ] All Copilot comments addressed (code fixed OR explained)
- [ ] Architecture aligns with PRD
- [ ] Integration correct (worktree state, config, error handling)
- [ ] Windows compat considered (or explicitly deferred)
- [ ] Test coverage adequate
- [ ] Code quality (naming, structure)
- [ ] No unaddressed comments in threads

---

### 3. The "Address or Explain" Rule: Every Comment Must Get a Response

**CRITICAL:** Zero unaddressed comments allowed. Period.

**For each comment from Copilot OR Mal:**

1. **FIX IT** — Make code change, commit, push, reply with evidence (commit hash)
   ```
   Fixed in commit abc123.
   - Added `validateInput()` check
   - Added test case: test/config.test.js:42
   ```

2. **EXPLAIN WHY NOT** — Reply with clear, specific rationale
   ```
   Windows symlink handling is PRD §9.7 Phase 1 scope: hard error with Developer Mode 
   message (per James directive). Proper Windows detection deferred to Phase 4.
   ```

3. **CLARIFY** — Reply if reviewer misunderstood
   ```
   The loop does handle this case (line 45 checks isDone()). Test at test/worktree.test.js:102 
   covers this scenario. Let me know if the test name could be clearer.
   ```

**What NOT to do:**
- ❌ Ignore the comment
- ❌ Say "it's fine as-is" without explanation
- ❌ Mark resolved without a thread reply
- ❌ Let a comment sit unaddressed for >24 hours

**Mal's enforcement:**
- Before approving, verify every comment thread has an agent response
- If unaddressed after 24 hours, request changes explicitly

---

### 4. Out-of-Scope Comments: Open Issues, @copilot Assignment

**When a review comment identifies valid work that shouldn't be in this PR:**

1. **Open a GitHub issue** for the out-of-scope work
   ```bash
   gh issue create --title "Implement worktree cleanup on failure" \
     --body "When dispatch task fails, clean up worktree. Currently (PR #15) we don't handle this. Phase 4 scope." \
     --repo jsturtevant/rally
   ```

2. **Optionally assign @copilot** if it's a good fit
   ```bash
   gh issue edit <issue-number> --add-assignee copilot
   ```

3. **Reply in the review thread** linking the new issue
   ```
   Good catch! This is out of scope for dispatch (PR #15). Opened #42 to track 
   worktree cleanup. Assignment: @copilot (good fit for Phase 4).
   ```

**When to use this pattern:**
- ✅ Valid concern, but PR is already large
- ✅ Requires coordination or decision with James
- ✅ Blocker for future work (e.g., Phase 4)
- ❌ Security/correctness gaps (these require fix in current PR, not deferral)

---

### 5. Responding to Comments: Fix, Push, Re-request Review

**Command sequence:**

```bash
# Edit files to address feedback
# ... make changes ...

# Commit
git add .
git commit -m "fix: address code review comments"

# Push
git push origin rally/<issue>-<slug>

# Reply in GitHub thread (via web UI or gh pr comment)
gh pr comment <number> --body "Fixed in commit abc123. ..."

# Re-request Mal's review
gh pr edit <number> --add-reviewer jsturtevant
```

**Copilot re-reviews automatically** on new commits (depends on workflow automation).

**Mal sees new commits** and will post re-review comment (approval or additional feedback).

**Both reviewers must approve** before merge.

---

### 6. Merge Gate: CI Green + Both Approvals + All Comments Addressed

**Before merging, verify all gates are met:**

1. **CI is green:**
   ```bash
   gh pr view <number> --json statusCheckRollup
   # Expected: all 4 checks (Node 18/20/22 + Squad CI) PASS
   ```

2. **Both reviewers have approved:**
   ```bash
   gh pr view <number> --json reviews
   # Expected: @copilot APPROVED, @jsturtevant APPROVED
   ```

3. **No unaddressed comments:**
   ```bash
   gh pr view <number> --json comments
   # Verify each comment thread has an agent response
   ```

4. **Acceptance criteria met:**
   - Re-read criteria in PR description
   - Verify test count matches (existing + new)
   - Verify test names map to criteria

**Merge with squash:**
```bash
gh pr merge <number> --squash
```

**GitHub auto-closes linked issue** (if PR description has `Closes #N`).

**Verify closure:**
```bash
gh issue view <issue-number> --json state
# Expected: { "state": "CLOSED" }
```

---

### 7. Revision Workflow: Original Author Cannot Self-Revise

**If Mal requests changes (rare, should be caught early):**

- **Original author cannot revise the PR**
- **Coordinator assigns revision to a different agent**
- New agent addresses feedback on original branch (minor fixes) or creates revision branch (major rework)
- Follows same dual-review process
- Re-requests approval from both reviewers

**Example:** PR #32 requires architecture changes. Coordinator assigns to Agent B (not original author).
```bash
git fetch origin rally/32-onboard
git checkout rally/32-onboard
# Agent B makes fixes
git commit -m "fix: ..."
git push origin rally/32-onboard
# Both reviewers re-review
```

**Rationale:** Fresh eyes, avoid sunk-cost bias, prevent scope creep.

---

## Key Commands

**Create & manage PR:**
```bash
git push origin rally/<issue>-<slug>
gh pr create --title "feat: ..." --body "Closes #<issue>\n\n## Changes\n..." --base main
gh pr edit <number> --add-reviewer jsturtevant
```

**Mal's review (team reviewer) — INLINE comments required:**
```bash
# 1. Pull the full diff — read every line
gh pr diff <number>
gh pr diff <number> --stat

# 2. Post inline review comments on specific file+line (REQUIRED)
#    Submit a review with inline comments:
gh api repos/{owner}/{repo}/pulls/{number}/reviews \
  --method POST \
  -f event=COMMENT \
  -f body="Review summary" \
  --jsonc '{"comments": [
    {"path": "lib/file.js", "line": 42, "body": "Comment on this line"}
  ]}'

# 3. Or create individual inline comments:
gh api repos/{owner}/{repo}/pulls/{number}/comments \
  --method POST \
  -f path="lib/file.js" \
  -F line=42 \
  -f side=RIGHT \
  -f body="Comment text" \
  -f commit_id="$(gh pr view {number} --json headRefOid -q .headRefOid)"

# 4. Final verdict (approve or request changes)
gh pr review <number> --approve --body "..."
gh pr review <number> --request-changes --body "See inline comments"
```
**⚠️ NEVER use `gh pr comment` for code feedback — it has no file/line context.**
Only use `gh pr comment` for non-code discussion (e.g., "opened issue #X to track").

**Respond to review:**
```bash
git commit -m "fix: address code review comments"
git push origin rally/<issue>-<slug>
gh pr edit <number> --add-reviewer jsturtevant
gh pr comment <number> --body "Fixed in commit abc123. ..."
```

**Verify merge readiness:**
```bash
gh pr view <number> --json statusCheckRollup
gh pr view <number> --json reviews
gh pr view <number> --json comments
gh pr merge <number> --squash
```

**Handle out-of-scope work:**
```bash
gh issue create --title "..." --body "..." --repo jsturtevant/rally
gh issue edit <issue-number> --add-assignee copilot
gh pr comment <number> --body "Opened #<issue-number> to track. ..."
```

---

## Examples (Grounded in Phase 2)

### Example 1: Copilot Comment → Fix → Approval

**PR #32 (Onboard command):**
- Copilot comment: "Path traversal risk in team name validation"
- Wash's response: Fixed in commit 028084e, added regex `isValidTeamName()`, added test
- Mal review: Verified fix, approved
- Merge: Squash + merge

### Example 2: Mal Comment → Explain → Approval

**PR #34 (Team Selection):**
- Mal comment: "Interactive prompt unreachable — gated by _select hook"
- Wash's response: "Good catch. Moved selectTeam() call earlier, now always shows. Test at test/onboard.test.js:89."
- Mal re-review: Verified, approved
- Merge: Squash + merge

### Example 3: Out-of-Scope Comment → Open Issue → Continue

**Hypothetical PR #15 (Dispatch):**
- Mal comment: "Should we cleanup worktree on failure?"
- Agent response: "Out of scope for Phase 3. Opened #42 to track. Assigned @copilot."
- Mal approval: "Good. #42 is a solid Phase 4 issue."
- Merge: Squash + merge

---

## Anti-Patterns

❌ **Unaddressed comments** — Comment sits in thread without reply. Merge blocked.  
❌ **Merging with Mal's review still pending** — Only Copilot approved. Incomplete gate.  
❌ **CI failures ignored** — "It's probably unrelated." Merge blocked.  
❌ **Self-revision after rejection** — Original author re-revises. Use different agent instead.  
❌ **Deferring security issues to new PR** — Security bugs are this-PR blockers, not out-of-scope.  

---

## Acceptance Criteria

This skill is complete when:
- [x] Dual-review process documented (Copilot + Mal both required)
- [x] "Address or explain" rule is explicit
- [x] Out-of-scope handling documented (open issues, @copilot assignment)
- [x] Merge gate includes all three checks (CI, both approvals, all comments addressed)
- [x] Commands are copy-paste ready (gh, git)
- [x] Mal's team reviewer role is clear
- [x] Revision workflow prevents self-revision
- [x] Phase 2 examples are included

---

## Validation

**Phase 3 dispatch PRs (#14–#19)** will validate this skill:
- All PRs require Copilot + Mal approval before merge
- All comments must be addressed (fix or explain)
- Out-of-scope feedback opens GitHub issues
- Merge gate enforced (no exceptions)

**Retrospective after Phase 3** will refine this skill for v2.0 (high confidence).

---

**Skill created:** 2026-02-22T23:XX:XXZ  
**Status:** Formalized from outline, confidence: medium (Phase 3 will validate)  
**Domain:** PR workflow, code review, process discipline  
**Applies to:** All Rally agents opening PRs, Mal as team reviewer
