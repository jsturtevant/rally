### 2026-02-23T21:04:00Z: User directive
**By:** James Sturtevant (via Copilot)
**What:** Copilot launched via rally dispatch must NOT take actions on the target repo (no commits, no PR creation, no issue comments, no gh CLI mutations). It should only analyze and prepare the worktree for human review. Restrict Copilot's access to gh CLI and MCP tools if possible.
**Why:** User request — safety constraint. Rally dispatches Copilot to analyze issues, not to autonomously modify repos. Human review gate is required before any repo mutations.
