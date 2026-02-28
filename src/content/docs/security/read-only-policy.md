---
title: Read-Only Policy
description: How Rally restricts Copilot's capabilities
---

## Default Restrictions

By default, Rally runs Copilot with restricted tools. This is a safety measure that allows Copilot to analyze code without making changes.

### Denied Tools (Default)

```
bash, edit, create, delete, mv, cp
```

Copilot can:
- ✅ Read files
- ✅ Search code
- ✅ Navigate the codebase
- ✅ Propose changes (in conversation)

Copilot cannot:
- ❌ Edit or create files
- ❌ Run shell commands
- ❌ Delete files

## Enabling Write Access

### Per-Dispatch

```bash
rally dispatch issue 42 --trust
```

### Configuration

```yaml
# ~/rally/config.yaml
settings:
  require_trust: never    # Don't ask, always allow writes
```

### In Dashboard

Press `a` to attach to a session, then respond to the trust prompt.

## Custom Tool Restrictions

Configure which tools to deny:

```yaml
# ~/rally/config.yaml
settings:
  deny_tools_copilot:
    - bash
    - edit
    - create
  deny_tools_sandbox:
    - bash          # More permissive in sandbox
```

**Note:** Empty arrays are not allowed — defaults will be applied.

## Use Cases

### Read-Only Exploration

Use read-only mode to:
- Understand unfamiliar codebases
- Get code review feedback
- Plan implementation approaches

### Trusted Development

Enable write access when:
- Working on your own code
- You've reviewed the issue/PR
- You're ready for Copilot to implement

## Security Rationale

Read-only by default because:
1. **Prevents accidents** — Copilot can't break things without permission
2. **Enables review** — You see proposals before they're applied
3. **Builds trust** — Start restricted, expand as needed
