---
title: Security Overview
description: Security model and best practices
---

## Security Model

Rally implements defense-in-depth security:

1. **Read-Only by Default** — Copilot cannot edit files without explicit trust
2. **Worktree Isolation** — Each dispatch is isolated in its own worktree
3. **Path Isolation** — Copilot is prevented from writing to temp directories outside the worktree
4. **Docker Sandbox** — Optional containerized execution
5. **Trust Checks** — Confirmation before granting write access
6. **Secure File Handling** — Restrictive permissions on sensitive files

## Security Features

### Read-Only Dispatch Policy

By default, Rally runs Copilot with `--deny-tool` flags that prevent:
- File editing (`edit`, `create`)
- Command execution (`bash`)
- File deletion

This allows Copilot to analyze code and propose changes without making them.

See [Read-Only Policy](/rally/security/read-only-policy/) for details.

### Path Isolation

Rally passes the `--disallow-temp-dir` flag to the Copilot CLI by default, preventing Copilot from writing files to temporary directories outside the worktree (such as `/tmp` or the system temp directory). This ensures all work stays inside the worktree for easier cleanup and isolation.

Configure in `~/rally/config.yaml`:
```yaml
settings:
  disallow_temp_dir: true   # Default: prevents temp directory writes
  disallow_temp_dir: false  # Allow temp directory writes (not recommended)
```

This feature:
- **Improves isolation** — All files created during a dispatch remain in the worktree
- **Simplifies cleanup** — No orphaned temp files after dispatch completion
- **Reduces exposure** — Prevents accidental data leakage via shared temp directories

### Docker Sandbox

Run dispatches in a Docker container for additional isolation:

```bash
rally dispatch issue 42 --sandbox
```

Or configure in `~/rally/config.yaml`:
```yaml
settings:
  docker_sandbox: always
```

See [Docker Sandbox](/rally/security/docker-sandbox/) for details.

### Trust Checks

Before granting write access, Rally can require confirmation:

```yaml
settings:
  require_trust: always    # Always ask
  require_trust: ask       # Ask first time
  require_trust: never     # Never ask (not recommended)
```

See [Trust Checks](/rally/security/trust-checks/) for details.

## File Permissions

Rally uses restrictive permissions for sensitive files:

| File | Permissions | Reason |
|------|-------------|--------|
| `~/rally/config.yaml` | `0600` | Contains settings |
| `~/rally/active/*` | `0600` | Contains session data |
| Log files | `0600` | May contain sensitive output |

## Input Validation

Rally validates all user-provided inputs:

- **Session IDs** — Must match UUID or alphanumeric pattern
- **File paths** — Checked for path traversal attacks
- **Configuration** — Validated against allowed values

## Best Practices

1. **Use read-only mode** for unfamiliar code
2. **Enable Docker sandbox** for untrusted repositories
3. **Review changes** before committing
4. **Keep Rally updated** for security fixes
5. **Use `require_trust: always`** for shared machines

## Reporting Security Issues

Report security vulnerabilities to the maintainers via GitHub Security Advisories.
