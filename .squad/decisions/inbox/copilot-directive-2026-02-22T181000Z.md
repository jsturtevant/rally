### 2026-02-22T18:10:00Z: User directive
**By:** James Sturtevant (via Copilot)
**What:** Mal must pull the actual PR diff (`gh pr diff`), review the code line-by-line, and post inline review comments on specific file lines using `gh api` to create pull request review comments — NOT general PR comments or messages. Use `gh pr review` with the `--body` for the overall verdict, but all specific feedback must be posted as inline comments on the exact file and line. Always use claude-opus-4.6 for reviews.
**Why:** User request — Mal's previous reviews posted general comments instead of inline code review comments. This defeats the purpose of code review. Line-level comments let the author see exactly what needs fixing in context.
