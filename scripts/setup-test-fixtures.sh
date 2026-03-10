#!/usr/bin/env bash
# setup-test-fixtures.sh — Create and populate the Rally e2e test fixture repo.
#
# Usage:
#   ./scripts/setup-test-fixtures.sh
#   RALLY_TEST_OWNER=myorg ./scripts/setup-test-fixtures.sh
#
# Prerequisites: gh CLI authenticated with repo + issue write scopes.
set -euo pipefail

OWNER="${RALLY_TEST_OWNER:-jsturtevant}"
REPO="rally-test-fixtures"
FULL_REPO="$OWNER/$REPO"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

echo "==> Setting up test fixture repo: $FULL_REPO"

# ── Prerequisites ────────────────────────────────────────────────────────────
command -v gh >/dev/null 2>&1 || { echo "Error: gh CLI is required but not installed."; exit 1; }
command -v git >/dev/null 2>&1 || { echo "Error: git is required but not installed."; exit 1; }

# ── 1. Create the repo if it doesn't exist ───────────────────────────────────
if gh repo view "$FULL_REPO" &>/dev/null; then
  echo "Repo $FULL_REPO already exists, skipping creation."
else
  echo "Creating repo $FULL_REPO ..."
  gh repo create "$FULL_REPO" --public \
    --description "Test fixtures for Rally e2e tests. Do not modify manually."
  echo "Repo $FULL_REPO created."
fi

# Clone into temp dir for any file operations
gh repo clone "$FULL_REPO" "$WORK_DIR/$REPO" -- --quiet 2>/dev/null || true
cd "$WORK_DIR/$REPO"

# Seed initial content if the repo is empty (no commits yet)
if ! git rev-parse HEAD &>/dev/null; then
  echo "Initializing repo with seed files ..."
  cat > README.md <<'EOF'
# Rally Test Fixtures

This repo exists for Rally e2e test automation. **Do not modify manually.**

Issues and PRs in this repo are consumed by the Rally CI pipeline.
EOF

  mkdir -p src
  cat > src/example.js <<'EOF'
// Placeholder file used for PR fixture testing.
module.exports = { hello: () => "world" };
EOF

  git add .
  git commit -m "Initial test fixture setup"
  git push origin main
  echo "Seed files pushed."
else
  echo "Repo already has commits, skipping seed."
fi

# ── 2. Create issues if they don't already exist ─────────────────────────────
ISSUE_COUNT=$(gh issue list --repo "$FULL_REPO" --state all --limit 100 --json number --jq 'length')

if [ "$ISSUE_COUNT" -ge 2 ]; then
  echo "Issues already exist ($ISSUE_COUNT found), skipping issue creation."
else
  echo "Creating test issues ..."

  if [ "$ISSUE_COUNT" -lt 1 ]; then
    gh issue create --repo "$FULL_REPO" \
      --title "[E2E Test] Dispatch issue test" \
      --body "This issue is used by Rally e2e tests for dispatch-issue testing.

## Task
Say hello and confirm the dispatch ran successfully.

Do not close manually."
    echo "  Issue #1 created."
  fi

  if [ "$ISSUE_COUNT" -lt 2 ]; then
    gh issue create --repo "$FULL_REPO" \
      --title "[E2E Test] Second dispatch issue" \
      --body "This issue is used by Rally e2e tests for multi-dispatch testing.

## Task
Just say hi from the squad, tell me who the team is and what agent you are running as. then run a retro with the team and save one new skill and have the scribe record.

Do not close manually."
    echo "  Issue #2 created."
  fi
fi

# ── 3. Create PR if one doesn't already exist ────────────────────────────────
PR_COUNT=$(gh pr list --repo "$FULL_REPO" --state open --limit 100 --json number --jq 'length')

if [ "$PR_COUNT" -ge 1 ]; then
  echo "Open PR(s) already exist ($PR_COUNT found), skipping PR creation."
else
  echo "Creating test PR ..."
  PR_BRANCH="test/sample-pr"

  # Make sure we're on main and up to date
  git checkout main 2>/dev/null || git checkout -b main
  git pull origin main --quiet 2>/dev/null || true

  # Create feature branch with a trivial change
  git checkout -b "$PR_BRANCH" 2>/dev/null || git checkout "$PR_BRANCH"
  cat > src/example.js <<'EOF'
// Placeholder file used for PR fixture testing.
module.exports = { hello: () => "world", version: 2 };
EOF

  git add src/example.js
  git commit -m "test: trivial change for PR fixture" --allow-empty
  git push origin "$PR_BRANCH" --force-with-lease

  gh pr create --repo "$FULL_REPO" \
    --head "$PR_BRANCH" \
    --base main \
    --title "[E2E Test] Sample PR for review dispatch" \
    --body "This PR is used by Rally e2e tests for dispatch-pr testing.

Contains a trivial change to \`src/example.js\`.

Do not merge or close manually."
  echo "  PR #1 created."
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "========================================"
echo " Test Fixture Setup Complete"
echo "========================================"
echo " Repo:    https://github.com/$FULL_REPO"
echo ""
echo " Issues:"
gh issue list --repo "$FULL_REPO" --state open --json number,title --jq '.[] | "   #\(.number)  \(.title)"'
echo ""
echo " Pull Requests:"
gh pr list --repo "$FULL_REPO" --state open --json number,title --jq '.[] | "   #\(.number)  \(.title)"'
echo "========================================"
