# Decision: Git & GitHub CLI Safety Patterns (execFileSync, Path Resolution)

**By:** Wash (Integration Dev)  
**Date:** 2026-02-22  
**Status:** Accepted

## Context

Implementing `lib/worktree.js` and `lib/github.js` required establishing patterns for safely calling external commands (git, gh CLI) without shell injection risks.

## Decision

**Use `execFileSync` (not `execSync`) for all git and gh commands:**
- No shell interpretation — command and args are separate
- Explicit args array prevents injection
- Example: `execFileSync('git', ['worktree', 'add', path, '-b', branch], {cwd})`

**Always resolve paths to absolute with `path.resolve()`:**
- Git worktree commands require consistent absolute paths
- Prevents ambiguity with relative paths across different cwd contexts
- All worktree functions return absolute paths

**Parse structured output over text scraping:**
- Use `git worktree list --porcelain` for machine-readable output
- Use `gh --json` with `--jq` for structured data
- Only parse JSON after validation

**Wrap errors with user-friendly context:**
- Catch all execFileSync errors and re-throw with context
- Include: path, repo, number, or specific instructions in error message
- Example: `"Failed to create worktree at ${path}: ${error.message}"`

## Rationale

1. **Security** — `execFileSync` eliminates shell injection vectors entirely
2. **Reliability** — Absolute paths prevent git worktree state corruption
3. **Debuggability** — Porcelain/JSON output is stable across git/gh versions
4. **UX** — User-friendly errors reduce support burden

## Impact

- All git/gh calls in Rally must follow these patterns
- Kaylee (Core Dev): Use these patterns in dispatch.js and onboard.js
- Jayne (Tester): Test suite can safely mock execFileSync without shell concerns
- Future maintainers: Consistent, auditable command invocation

## Examples

```javascript
// ✅ Good — execFileSync with explicit args
execFileSync('git', ['worktree', 'add', absolutePath, '-b', branchName], {cwd: repoPath});

// ❌ Bad — execSync with shell string
execSync(`git worktree add ${path} -b ${branch}`, {cwd: repoPath});

// ✅ Good — absolute path resolution
const absoluteWorktreePath = path.resolve(worktreePath);

// ✅ Good — user-friendly error wrapping
catch (error) {
  throw new Error(`Failed to create worktree at ${absolutePath}: ${error.message}`);
}
```

## Related

- `lib/worktree.js` — Reference implementation
- `lib/github.js` — Reference implementation
- `docs/TESTING.md` — Mocking patterns for tests
