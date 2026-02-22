# PR Review Process Skill Outline

**Created by:** Mal (Lead)  
**Date:** 2026-02-22  
**Last Updated:** 2026-02-22 (incorporated team reviewer requirement)  
**Status:** Outline (updated with team reviewer directive)  
**Based on:** Phase 2 PRs #30–#34 actual workflow + Phase 2 retrospective learnings + User directive 2026-02-22T171200Z

---

## Overview

This skill codifies the full pull request review workflow that Copilot agents follow when opening, reviewing, responding to feedback, and merging PRs in Rally. **NEW: Team member (Mal as Lead) performs a mandatory review in addition to Copilot.** The skill addresses:
- **What agents do** when opening a PR (naming, commits, descriptions, reviewer setup)
- **What agents do** while waiting for review (polling both Copilot and Mal)
- **What agents do** when feedback arrives (reading, responding, fixing, re-requesting review from both reviewers)
- **What agents do** when review passes (final checks, merge, issue closure)
- **What agents do** when review fails (coordination with lead, hand-off, revision pickup)
- **NEW: How Mal (Lead/team reviewer) conducts a thorough code review** (pulling diff, reviewing context, posting comments, enforcing "address or explain")
- **NEW: Out-of-scope issue handling** (opening GitHub issue, @copilot assignment)

The workflow is grounded in Rally Phase 2 (PRs #30–#34) where the Copilot-only review process was exercised with 8 review cycles across 5 PRs. **Phase 3+ will add the mandatory team reviewer (Mal) in parallel with Copilot.**

---

## 1. PR Creation

### 1.1 Branch Naming Convention

**Pattern:** `rally/<issue-number>-<slug>`

**Examples:**
- Issue #10 (Onboard command) → `rally/10-onboard`
- Issue #12 (Team selection) → `rally/12-team-selection`
- Issue #13 (Status command) → `rally/13-status`

**Why this pattern:**
- `rally/` prefix groups agent branches together in git
- Issue number links commits back to GitHub issues
- Slug is human-readable in git logs and GitHub branch listing

**Commands:**
```bash
git checkout -b rally/<issue-number>-<slug>
```

### 1.2 Commit Message Format

**Pattern:** 
```
feat/fix/refactor: <short description>

<optional detailed explanation>

Closes #<issue-number>
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

**Examples:**
- `feat: implement rally onboard for local repos\n\nCloses #10\nCo-authored-by: Copilot <...>`
- `fix: add missing test for worktree edge cases\n\nCloses #15\nCo-authored-by: Copilot <...>`

**Why:**
- Conventional commits make changelog/release notes automatic
- `Closes #X` auto-links commits to issues and auto-closes on PR merge
- Co-authored-by trailer credits Copilot per GitHub Copilot CLI standards

### 1.3 PR Description Template

**Structure:**
```
Closes #<issue-number>

## Changes
- **<file>**: <what this file does>
- **<file>**: <what this file does>
- **test/<file>**: <what tests cover>

## Acceptance Criteria
- [x] Criterion 1
- [x] Criterion 2
- [x] Criterion 3
- [x] Criterion 4

## Test Results
All <N> tests pass (X existing + Y new).
```

**Why:**
- Acceptance criteria checklist makes review concrete (not subjective)
- File-by-file summary helps reviewers understand scope quickly
- Test count (existing + new) shows test quality at a glance

**Real example (PR #32, Onboard command):**
```
Closes #10

## Changes
- **lib/onboard.js**: Onboard command for local repos — detects git repo, 
  reads config.yaml for team dir, creates symlinks, adds exclude entries
- **bin/rally.js**: Wired `rally onboard [path]` as Commander subcommand
- **test/onboard.test.js**: 11 tests covering all 4 acceptance criteria + 3 error cases

## Acceptance Criteria
- [x] Creates all required symlinks
- [x] Adds exclude entries
- [x] Registers project in projects.yaml
- [x] Idempotent on re-run

## Test Results
All 81 tests pass (70 existing + 11 new).
```

### 1.4 Linking to Issues

**Requirement:** Every PR must reference the issue it closes.

**Format in PR description:**
```
Closes #<issue-number>
```

**GitHub mechanics:**
- When merged, GitHub auto-closes the issue
- Issue appears in PR's "Linked issues" section
- Commit message `Closes #X` also creates the link

**Verification:**
```bash
gh pr view <number> --json body  # Check that PR body mentions "Closes #N"
```

### 1.5 Requesting Reviewers

**Policy (Post-Phase 2, Updated Phase 3+):**
- **@copilot** (automatic) — Copilot Code Review runs automatically on every PR
- **Mal** (manual) — Agent must request Mal as reviewer via `gh pr edit`

**Commands:**
```bash
# Request Mal as reviewer after PR creation
gh pr edit <number> --add-reviewer jsturtevant
```

**Why:**
- Copilot reviews automatically (GitHub Actions automation)
- Mal reviews manually (team reviewer, thorough code review with context)
- **Both reviews must complete before merge** — Copilot comments AND Mal comments must all be addressed
- Team reviewer provides human judgment, security review, architectural context

**Verification:**
```bash
# Check who's been requested
gh pr view <number> --json reviewRequests
```

---

## 1.6 Understanding the Dual-Review Process (Phase 3+)

**NEW: Two reviewers, two review flows, same merge gate.**

1. **Copilot Review (Automatic)**
   - Runs on PR creation automatically via GitHub Actions
   - Focuses on: code style, security patterns, edge cases, test coverage
   - Comments appear within 2–5 minutes
   - Typical comments: "Add error handling for X", "Consider security check for Y", "Test coverage gap in Z"

2. **Mal Review (Manual, Team Reviewer)**
   - Begins after Copilot comments are visible (Mal waits for Copilot to complete)
   - Pulls full diff with `gh pr diff <number>`
   - Reads related source files to understand context
   - Focuses on: architectural correctness, integration impact, design alignment with PRD, team code standards
   - Posts comments (general and line-level) via `gh pr review` or GitHub
   - Typical comments: "This breaks the worktree layout", "Doesn't follow the config pattern", "Need to handle Windows case here"

**All comments from both reviewers must be addressed before merge:**
- Every Copilot comment → agent responds with fix or explanation
- Every Mal comment → agent responds with fix or explanation
- No unresolved comments allowed (policy: **"address or explain"**)

---

## 2. Waiting for Review

### 2.1 Copilot Review (Automatic)

**What happens:**
1. PR is opened
2. GitHub Actions workflow `copilot-pr-review` is triggered automatically (if configured)
3. Copilot Code Review service reviews files and adds comments within 2–5 minutes

**What agent does:**
- **Wait for Copilot review before responding.** Don't push new commits yet.
- Check Copilot's review with `gh pr view <number> --json reviews`
- Read all Copilot comments before proceeding

**Commands:**
```bash
# Check review status (and wait for Copilot)
gh pr view <number> --json reviews

# Full PR view (includes all metadata, comments, reviews)
gh pr view <number>
```

**Expected Copilot comments:**
- File-by-file summary
- Specific code concerns (security, performance, edge cases)
- Test coverage gaps
- Examples from PRs #32–#34:
  - PR #32: Copilot flagged 7 issues (all addressed before Mal review)
  - PR #34: Copilot flagged 5 issues (all addressed before merge)

### 2.2 Polling Pattern (Check Review Status)

**Frequency:**
- First check: 3–5 minutes after opening PR (let Copilot run)
- Subsequent checks: every 5–10 minutes until Copilot reviews
- After Copilot reviews: every 10–30 minutes for Mal review

**Commands:**
```bash
# Quick status check (JSON output for scripting)
gh pr view <number> --json reviews,reviewRequests,statusCheckRollup

# Full view if needed
gh pr view <number>
```

**Sample polling script (for reference, not required):**
```bash
#!/bin/bash
PR_NUM=$1
WAIT_TIME=0
MAX_WAIT=$((30 * 60))  # 30 minutes

while [ $WAIT_TIME -lt $MAX_WAIT ]; do
  STATUS=$(gh pr view "$PR_NUM" --json reviews,statusCheckRollup --jq '.reviews[0].state')
  if [ "$STATUS" = "APPROVED" ]; then
    echo "✓ Review approved"
    break
  fi
  echo "⏳ Waiting for review... ($WAIT_TIME s)"
  sleep 30
  WAIT_TIME=$((WAIT_TIME + 30))
done
```

**What NOT to do:**
- Don't ping Mal; they see the PR in their queue
- Don't assume Copilot failed if it takes 5+ min; it's probably running
- Don't merge until both Copilot and Mal have approved

### 2.3 Check Copilot Comments (Phase 2 Pattern)

**From Phase 2 PRs:**
- PR #32: Copilot added 7 comments; Wash addressed all in a single commit (028084e)
- PR #34: Copilot added 5 comments; agent addressed all before re-requesting review
- Copilot comments were **always specific and actionable** (edge cases, path traversal, etc.)

**What agent should look for:**
1. Security/path traversal issues
2. Node.js version compatibility (Node 18 minimum)
3. Error handling gaps
4. Test coverage gaps
5. Windows symlink handling
6. TTY/non-TTY graceful degradation

**Example Copilot comment (from PR #32):**
```
File: lib/onboard.js
Line 42: Consider adding a check for symlink support on Windows.
The code assumes POSIX symlinks work everywhere. On Windows without Developer Mode,
this will fail. Consider checking symlink support upfront.
```

---

## 2.4 Team Reviewer (Mal) Workflow — Pulling Diff & Conducting Review (NEW)

**NEW Section: Mal's responsibilities as lead/team reviewer.**

### 2.4.1 Get the Diff: `gh pr diff`

**When Mal reviews a PR:**
1. Wait for Copilot to finish (so you review against the same code state)
2. Pull the full diff using GitHub CLI

**Commands:**
```bash
# Get the complete PR diff
gh pr diff <number>

# Save diff to file for reference
gh pr diff <number> > /tmp/pr-<number>.diff

# Get diff with stats (file-by-file summary)
gh pr diff <number> --stat
```

**Example output:**
```diff
diff --git a/lib/onboard.js b/lib/onboard.js
index 1234567..abcdefg 100644
--- a/lib/onboard.js
+++ b/lib/onboard.js
@@ -42,6 +42,15 @@ function onboard(repo, teamDir) {
   // Create symlinks
   createSymlinks(repo, teamDir);
+
+  // Validate team name (security: prevent path traversal)
+  if (!/^[a-zA-Z0-9_-]+$/.test(teamName)) {
+    throw new Error(`Invalid team name: ${teamName}`);
+  }
```

### 2.4.2 Pull Context: Read Related Files

**After reviewing the diff, pull context by reading related files:**
- The feature's entry point (e.g., `bin/rally.js` for new command)
- Related modules referenced in the diff
- Test files to understand acceptance criteria
- PRD sections that define the feature's scope

**Commands:**
```bash
# View a file
cat lib/onboard.js

# Or use GitHub CLI to view specific version
gh pr view <number> --json files  # See what files were changed
```

**Example context pull (for a dispatch command review):**
1. Read diff of `lib/dispatch.js`
2. Check `bin/rally.js` to understand CLI integration
3. Read test file to verify acceptance criteria coverage
4. Skim `docs/PRD.md` §3.3 to understand dispatch spec
5. Check `lib/worktree.js` to understand worktree interaction

### 2.4.3 Post Comments: General & Line-Level

**Mal posts review comments using GitHub CLI or GitHub directly.**

**Option A: General PR comment (for big-picture feedback)**
```bash
# Post a general comment to the PR
gh pr comment <number> --body "## Mal — Code Review ✅

### Summary
Changes look good. dispatch command properly handles Squad invocation.

### Questions
1. Line 45: Why not use `fs.existsSync()` for worktree check instead of try/catch?

### Suggestions
- Consider adding Windows Developer Mode check before symlink call (per PRD §9.7)
"
```

**Option B: Line-level comments (for specific code feedback)**
```bash
# Using GitHub API or web UI to post line comments
# (gh CLI doesn't have native line comment support; use web UI or GraphQL API)

# Alternatively, post a detailed comment with line references
gh pr comment <number> --body "
### Line-by-line feedback

**lib/dispatch.js:45** — Error handling for worktree creation
Currently: \`try { createWorktree(...) }\`
Suggestion: Catch and handle EEXIST separately (worktree already exists vs. permission denied)

**lib/dispatch.js:120** — Squad invocation
Currently: Launches with \`execFileSync('copilot-cli', ...)\`
Question: What if copilot-cli is not installed? Should we check \`which\` first?
"
```

**What Mal typically comments on:**
1. **Architectural alignment** — Does this follow the PRD? Does it break existing patterns?
2. **Integration correctness** — How does this interact with other modules? Worktree state? Config?
3. **Error handling** — Missing cases? Windows compat? TTY assumptions?
4. **Code quality** — Variable names, function structure, test clarity
5. **Process** — Acceptance criteria met? Test count reasonable? Is there technical debt?

### 2.4.4 Enforce "Address or Explain" Policy

**Rule: Every comment (from Copilot AND Mal) must be addressed.**

After Mal posts comments, agent responds by either:
1. **Fix the issue** — commit code change, push, reply in thread with evidence
2. **Explain why not fixing** — reply in thread with rationale (e.g., "This is a known limitation in v1", "Out of scope for this PR", "Blocked on decision #X")

**NO unaddressed comments allowed. Period.**

Examples of "address" vs "explain":
- ✅ **Address:** "Added Windows check with early return if symlinks not supported. Commit abc123."
- ✅ **Explain:** "TTY assumption is intentional per PRD §5. Non-TTY fallback is Phase 4 scope."
- ❌ **Neither:** Silence. (Not allowed.)

**Mal's verification step:**
- Before approving, verify every comment in threads has an agent response
- If any comment unaddressed after 24 hours, request changes explicitly

---

## 2.5 Handling Out-of-Scope Comments (NEW)

**NEW: When a review comment identifies work that shouldn't be in this PR.**

### Pattern

**If Mal (or Copilot) raises a concern that's valid but out-of-scope for the current PR:**

1. **Open a GitHub issue** for the out-of-scope work
2. **Link it in the review comment** as a follow-up
3. **Optionally assign @copilot** if it's a good fit (e.g., refactoring, new feature, test gap)
4. **Reply to the review comment** confirming the issue is filed

### Example

**Scenario:** PR #15 (dispatch command) includes code that creates a worktree. Mal's review comment:

```
lib/dispatch.js:120 — Worktree cleanup
Nice code, but I notice we don't have cleanup if the dispatched task fails.
Should we add a cleanup handler? This could be a separate phase 4 issue.
```

**Agent response:**

1. Open issue:
   ```bash
   gh issue create --title "Implement worktree cleanup on dispatch failure" \
     --body "When a dispatch task fails or is aborted, clean up the worktree. \
            Currently (PR #15), we don't handle this. Phase 4 scope." \
     --repo jsturtevant/rally
   ```
   → Issue #42 created

2. Reply in review thread:
   ```
   Good catch! This is out of scope for dispatch (PR #15), but I've opened #42 
   to track worktree cleanup. Assignment: @copilot (good fit for Phase 4 refactoring).
   ```

### When to Use This Pattern

- ✅ Valid concern, but PR is already large enough
- ✅ Requires coordination or decision with James
- ✅ Blocker for future work (like phase 4)
- ✅ Security/correctness gap (note: these usually require fix in current PR, not deferral)

### Commands

```bash
# Open a new issue (auto-assigns number)
gh issue create --title "<brief title>" \
  --body "<detailed description>" \
  --repo jsturtevant/rally

# Optionally assign to copilot
gh issue edit <issue-number> --add-assignee copilot

# Reply in PR review thread with issue link
gh pr comment <number> --body "Opened #<issue-number> to track this. ..."
```

---


## 3. Responding to Review Comments (From Both Copilot & Mal)

### 3.1 Read All Comments First (Both Reviewers)

**NEW: You now have TWO reviewers — Copilot (automatic) and Mal (manual/team reviewer).**

**Pattern:**
1. View PR with `gh pr view <number>` (or open on GitHub)
2. **Read ALL review comments from BOTH reviewers** before responding
3. List each distinct comment/concern from both Copilot and Mal
4. Plan responses (which require code fixes, which are clarifications, etc.)
5. **Address every single comment** — no exceptions

**Commands:**
```bash
# Get all review comments (structured output)
gh pr view <number> --json reviews,comments

# Or view on GitHub for better UX (open in browser)
gh pr view <number> --web

# Check specifically who reviewed
gh pr view <number> --json reviews --jq '.reviews[] | {author: .author.login, state: .state}'
```

**Why:**
- Prevents duplicate fixes (if both reviewers flag the same issue)
- Ensures you understand the full scope of feedback from both perspectives
- Allows you to batch-fix related concerns in one commit
- **NEW: Mal is a team reviewer, not an automated system. Mal's comments carry architectural weight.**

### 3.2 Address Each Comment Individually (ALL Comments, Both Reviewers)

**CRITICAL RULE: Every comment from Copilot AND every comment from Mal must be addressed.**

**Pattern for each comment:**
1. Understand the concern (re-read if unclear)
2. Decide: needs code fix, needs test, needs clarification, or explain why not fixing?
3. **You MUST respond in the GitHub thread.** No unaddressed comments allowed.
4. Response options:
   - **FIX IT:** Make code change, commit, push, reply with evidence (commit hash)
   - **EXPLAIN WHY NOT:** Reply with clear rationale (scope, design decision, blocked on X)
   - **CLARIFY:** Reply with explanation if reviewer misunderstood the code

5. Move to next comment

**Commit strategy:**
- **Option A (PR #32 pattern):** Fix all comments in ONE commit with message `chore: address code review comments`
- **Option B (PR #34 pattern):** Fix in separate commits, one per logical concern

**Reply examples:**

Example 1 — **Fix a Copilot security concern:**
```
Thanks for flagging this. Fixed in commit 028084e.
- Added `isValidTeamName()` regex to block path traversal
- Changed to execFileSync with array args to prevent command injection
- Added test case covering traversal attempts
```

Example 2 — **Address a Mal architectural comment:**
```
Good point. The dispatch context should follow the template format per PRD §9.4.
Fixed in commit d4c8f9e:
- Changed context file from YAML to Markdown
- Updated all tests to match template
- Verified with round-trip parsing
```

Example 3 — **Explain why not fixing (defer to another PR):**
```
Understood. Windows symlink detection is PRD §9.7 scope, but Phase 1 hard-errors per 
James's directive (enable Developer Mode msg). Opened issue #42 for proper Windows 
detection in Phase 4. For now, code matches spec.
```

Example 4 — **Clarify if reviewer misunderstood:**
```
The loop _does_ handle the case you mentioned. Line 45 checks `isDone()` before next 
iteration. The test at test/dispatch.test.js:120 covers this scenario. Let me know if 
the test isn't clear enough.
```

**The "address or explain" rule is absolute:**
- ✅ Fix the code
- ✅ Explain clearly why not fixing
- ❌ Ignore the comment
- ❌ "It's fine as-is" without explanation

### 3.3 Push Fixes and Reply to Threads (Both Reviewers)

**Command sequence:**
```bash
# Make code changes
# ... edit files ...

# Commit with clear message
git add .
git commit -m "fix: address code review comments"

# Push (--force-with-lease if rebasing, else plain push)
git push origin rally/<issue>-<slug>

# Reply in GitHub thread for each comment you addressed
# (Use web UI or gh pr comment command)
```

**What to include in reply:**
- What you fixed (brief)
- Why the fix is correct
- Test verification (if applicable)
- Link to commit hash if pushing new code
- If explaining (not fixing), state clear rationale

### 3.4 Re-request Review After Addressing Comments (Both Reviewers)

**After pushing fixes to address comments:**

**For Mal:**
```bash
# Explicitly re-request Mal's review
gh pr edit <number> --add-reviewer jsturtevant
```

**For Copilot:**
```bash
# Copilot typically re-reviews automatically on new commits
# If needed, can manually request via GitHub Actions or web UI
# (depends on Copilot workflow configuration)
```

**From Phase 2 experience (PR #34):**
- Wash pushed fixes (4173bae, 85a59695)
- Mal re-reviewed with "## Mal — Re-review ✅" comment
- Copilot re-reviewed with "no new comments" (implicit approval)

**Important:** Both reviewers will see your new commits and re-review. Mal will explicitly post a re-review comment (approval or additional feedback). Copilot's automation depends on workflow config.

---

## 3.5 Mal's Approval Decision (Team Reviewer Gate)

**NEW: How Mal decides to approve.**

### When Mal Approves

Mal approves after verifying:

1. **All Copilot comments addressed** (code fixed OR explained)
2. **All Mal comments addressed** (code fixed OR explained)
3. **CI green** (Node 18/20/22 tests pass, Squad CI passes)
4. **Acceptance criteria met** — test evidence in PR description
5. **Code quality** — no regressions, follows PRD patterns, integrates cleanly

### Approval Process

**Mal posts an approval comment:**
```bash
gh pr review <number> --approve --body "
## Mal — Approval ✅

### Review Summary
- All Copilot comments addressed
- Code follows worktree/config patterns per PRD
- Tests cover new command and error cases
- Windows compat validated (deferred to Phase X per plan)

Ready to merge.
"
```

Or posts via GitHub web UI (if already satisfied, simple "Approve" button).

### When Mal Requests Changes

If issues remain after comments + re-review:
```bash
gh pr review <number> --request-changes --body "
## Mal — Changes Requested ⚠️

### Blocking Issues
1. Dispatch context format doesn't match PRD §9.4 template
2. Test coverage gap: no test for timeout case
3. Config merging logic differs from onboard — should be DRY'd up

Please address and re-request review.
"
```

**Important:** Use request-changes sparingly. Goal is to catch blockers early (in review comments). Mal tries to prevent this state by being clear in initial review.

---

## 4. Review Approval & Merge (Dual Gate: Copilot + Mal)

**NEW: Merge requires approval from BOTH Copilot and Mal.**

### 4.1 Verify CI is Green (First Gate)

**Check before merge:**
```bash
gh pr view <number> --json statusCheckRollup
```

**Expected status:**
```json
{
  "statusCheckRollup": [
    { "name": "Node 18.x", "status": "PASS" },
    { "name": "Node 20.x", "status": "PASS" },
    { "name": "Node 22.x", "status": "PASS" },
    { "name": "Squad CI", "status": "PASS" }
  ]
}
```

**From Phase 2 PRs:**
- All 5 PRs (#30–#34) had all 4 checks green before merge
- Node version testing caught compatibility issues early

**What NOT to do:**
- Don't merge with failed CI (even if you think the failure is unrelated)
- Don't skip Squad CI check

### 4.2 Verify Both Reviewers Have Approved (Second Gate)

**Check reviewer status:**
```bash
# Check approvals (Copilot + Mal)
gh pr view <number> --json reviews

# Expected output shows 2 approvals (or compatible state):
# - @copilot: APPROVED
# - @jsturtevant: APPROVED
```

**Policy:**
- ✅ Both reviewers approved → Merge allowed
- ✅ Copilot + Mal approved, no outstanding "changes requested" → Merge allowed
- ❌ Only Copilot approved, Mal not yet reviewed → Don't merge
- ❌ Either reviewer requested changes → Don't merge, address feedback first
- ❌ Comments unaddressed in threads → Don't merge

**Important:** Verify there are **no unaddressed comments** in the PR. Every comment thread must have an agent response.

### 4.3 Verify Acceptance Criteria Met (With CI Log Evidence)

**Pattern:**
1. Re-read acceptance criteria in PR description
2. Check that test results show **passing tests**
3. Cross-reference specific test names with acceptance criteria
4. Mal verifies CI logs before approval (part of Mal's review)

**From PR #32 (actual verification by Mal):**
```
### Acceptance Criteria
- [x] Creates all required symlinks (.squad/, .squad-templates/, .github/agents/squad.agent.md)
- [x] Adds exclude entries to .git/info/exclude (including .worktrees/)
- [x] Registers project in projects.yaml
- [x] Idempotent on re-run — no duplicates, no throws

### Code Quality
- **Test coverage**: 16 tests covering all 4 acceptance criteria + 5 edge cases from Copilot review

### CI
All 86 tests passing on Node 18/20/22.
```

**Reviewer checklist (Mal's actual approach):**
- [ ] CI shows green (all 4 checks)
- [ ] Test count increased appropriately
- [ ] Test names map to acceptance criteria
- [ ] Node 18/20/22 all pass
- [ ] Squad CI green

### 4.4 Merge Strategy

**Policy for Rally:**
- **Strategy:** Squash + merge (default for feature branches)
- **Why:** Keeps main history clean, one commit per feature
- **Command:**
```bash
gh pr merge <number> --squash
```

**Alternative (if PR already well-structured):**
- Merge commit (preserves individual commits in the PR)
- Command: `gh pr merge <number> --create-branch`

**From Phase 2 PRs (#30–#34):**
- All used squash + merge (commits are atomic features, not incremental WIP)

### 4.5 Close Related Issue

**Automatic (if PR description has `Closes #N`):**
- GitHub auto-closes the issue when PR merges
- No manual action needed

**Verification:**
```bash
# After merge, check that issue is closed
gh issue view <issue-number> --json state
# Expected: { "state": "CLOSED" }
```

**From Phase 2:**
- PR #32 (`Closes #10`) → Issue #10 auto-closed
- PR #34 (`Closes #12`) → Issue #12 auto-closed
- All 5 PRs auto-closed their linked issues on merge

---

## 5. Review Rejection (Revision Workflow)

### 5.1 Coordinator Enforces Lockout

**Policy (Post-Phase 2):**
- **Original author cannot self-revise a rejected PR**
- Original author created the PR → if feedback requires major revision → **different agent picks up the work**
- Rationale: Fresh eyes, avoid sunk-cost bias, prevent scope creep

**Coordinator responsibilities:**
- Monitor open PRs for "changes requested" status
- Assign revision work to a different agent
- Provide context (review comments, what needs fixing)
- Update issue/PR to reflect new assignee

### 5.2 Different Agent Picks Up Revision

**Pattern:**
1. Original author's PR remains open (not closed)
2. Coordinator assigns revision task to Agent B
3. Agent B creates new branch off the original author's branch OR main (depends on scope)
4. Agent B addresses feedback, pushes new commits to original PR
5. Re-request reviews (Copilot + Mal)
6. Follow normal review cycle (§3–4)

**Branch strategy for revision:**
- **If feedback is minor (small fixes):** Agent B pushes to original author's branch directly
  ```bash
  git fetch origin rally/<issue>-<slug>
  git checkout rally/<issue>-<slug>
  # Make fixes
  git commit ...
  git push origin rally/<issue>-<slug>
  ```
- **If feedback is major (architecture changes):** Agent B creates new branch `rally/<issue>-<slug>-revision`
  ```bash
  git checkout -b rally/<issue>-<slug>-revision
  # Major rework
  git commit ...
  git push origin rally/<issue>-<slug>-revision
  gh pr create --base main --head rally/<issue>-<slug>-revision
  ```

### 5.3 Hand-off Context to New Agent

**What coordinator provides to Agent B:**
1. Link to original PR (with all feedback)
2. Excerpt of review comments (what specifically needs fixing)
3. Copy of current branch/code state
4. Reason for hand-off (scope, complexity, process discipline)

**Example (hypothetical):**
```
Agent B,

PR #32 (Onboard) has feedback from Mal requiring major architecture changes:
- Path traversal validation must happen earlier in flow
- Symlink fallback strategy needs re-design (Windows compat)

Instead of revising PR #32 directly, create a new PR:
- Branch: `rally/32-onboard-revision`
- Base: `main`
- Include: all original work + fixes for above concerns

Mal's full review: [link to PR #32]
Current state: [branch name]

Let me know if you have questions.
```

### 5.4 Phase 2 Experience

**Phase 2 had zero rejections** (all 5 PRs approved on first or second review cycle). This is rare and suggests:
- Good pre-submission quality (agents wrote tests, read requirements carefully)
- Reviewers were not overly strict (trade-off vs. perfection)
- Interactive behavior validation happened in review (PR #34 had second review, not rejection)

**If Phase 3 encounters rejections:**
- Follow the pattern above
- Coordinator enforces "different agent" rule strictly
- Track revision time to identify process gaps

---

## 6. Key Commands Reference

### 6.1 Create and Manage PR

```bash
# Push feature branch
git push origin rally/<issue>-<slug>

# Create PR
gh pr create --title "feat: <short title>" \
  --body "Closes #<issue>\n\n## Changes\n..." \
  --base main

# Request Mal as reviewer
gh pr edit <pr-number> --add-reviewer jsturtevant

# View PR details
gh pr view <pr-number>

# View reviews and comments from both Copilot and Mal
gh pr view <pr-number> --json reviews,comments

# View status checks
gh pr view <pr-number> --json statusCheckRollup

# View reviewer approvals/requests
gh pr view <pr-number> --json reviews
```

### 6.2 Mal's Review Commands (Team Reviewer)

```bash
# Pull the full PR diff
gh pr diff <pr-number>

# Get diff with stats
gh pr diff <pr-number> --stat

# Post a general approval/feedback comment
gh pr review <pr-number> --approve --body "Review complete. All feedback addressed."

# Post a "changes requested" comment
gh pr review <pr-number> --request-changes --body "Blocking issues: ..."

# Post a comment without approval
gh pr comment <pr-number> --body "Code review feedback: ..."
```

### 6.3 Respond to Review (Both Copilot & Mal)

```bash
# Push new commits to address feedback
git commit -m "fix: address code review comments"
git push origin rally/<issue>-<slug>

# Re-request Mal's review after fixes
gh pr edit <pr-number> --add-reviewer jsturtevant

# Reply in a specific review thread (via web UI or GraphQL API)
# (gh CLI doesn't support thread replies; use web UI)

# Merge PR (when both reviewers approved, CI green, all comments addressed)
gh pr merge <pr-number> --squash
```

### 6.4 Monitor Reviews in Progress (Wait for Both Reviewers)

```bash
# Quick check (Copilot + Mal status)
gh pr view <pr-number> --json reviews,reviewRequests,statusCheckRollup

# Full view
gh pr view <pr-number>

# Open in browser for full view
gh pr view <pr-number> --web

# Check if all comments are addressed (verify no unaddressed threads)
gh pr view <pr-number> --json comments
```

### 6.5 Out-of-Scope Issue Handling (New Feature)

```bash
# Open a new GitHub issue for out-of-scope work
gh issue create --title "<brief title>" \
  --body "<detailed description>" \
  --repo jsturtevant/rally

# Optionally assign to copilot
gh issue edit <issue-number> --add-assignee copilot

# Reply in PR review thread linking to new issue
gh pr comment <pr-number> --body "Opened #<issue-number> to track. ..."
```

---

## 7. Common Patterns & Anti-Patterns

### 7.1 What Works (Phase 2 Evidence)

✅ **Acceptance criteria as PR description checklist** — Clear, reviewer can verify point-by-point  
✅ **Test results in PR summary** — Gives confidence on first read  
✅ **Copilot comment reply with commit hash** — Traceable, reviewer can verify fix  
✅ **Re-request review after each commit** — Signals "ready for review" clearly  
✅ **Squash + merge for feature branches** — Keeps main history clean  
✅ **Auto-close via `Closes #N`** — Zero manual issue management  

### 7.2 What Doesn't Work (Learned from Phase 2)

❌ **Interactive behavior tested only in unit tests** (PR #34) — TTY prompts need end-to-end validation  
❌ **Missing edge case enumeration upfront** — Security/path traversal caught in review, not by test  
❌ **Copilot review not mandatory** — Some PRs had Copilot, some didn't (process inconsistency)  
❌ **Merging without Mal's explicit approval** — Risk of code quality regression  

---

## 8. Acceptance Criteria for This Skill

The outline now covers all sections for Phase 3+ implementation:

- [x] NEW sections covering Mal's review process (pull diff, post comments, enforce "address or explain")
- [x] NEW section on handling out-of-scope comments (open issues, @copilot assignment)
- [x] Dual-review gate explained (Copilot approval + Mal approval required for merge)
- [x] Command examples copy-paste ready (including Mal's gh review commands)
- [x] Pattern grounded in Phase 2 PRs #30–#34 (actual workflow evidence)
- [x] All anti-patterns and lessons learned incorporated
- [x] Coordinator responsibilities clear
- [x] All agent and reviewer responsibilities unambiguous
- [x] Process ready to test in Phase 3 (dispatch PRs #14–#19)

---

## 9. Next Steps

1. **Formalize into SKILL.md** — Create `.squad/skills/pr-review-process/SKILL.md` using this outline
2. **Update team documentation** — Link new skill from .squad/team.md
3. **Phase 3 implementation** — All dispatch PRs (#14–#19) follow dual-review process (Copilot + Mal)
4. **Enforce in practice** — Coordinator ensures no PR merges without both Copilot and Mal approval
5. **Iterate if needed** — After Phase 3, retrospective on review effectiveness, refine skill for v2.0

---

**Outline updated:** 2026-02-22T23:XX:XXZ (incorporated James's team reviewer directive)  
**Status:** Finalized, ready for SKILL.md formalization  
**Confidence:** Medium (first implementation, will refine after Phase 3 validates it)  
