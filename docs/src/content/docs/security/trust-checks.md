---
title: Trust Checks
description: Confirming trust before write access
---

## What Are Trust Checks?

Trust checks are confirmation prompts that appear before Rally grants Copilot write access to your code.

## Configuration

```yaml
# ~/rally/config.yaml
settings:
  require_trust: always    # Always ask before each dispatch
  require_trust: ask       # Ask once per project (default)
  require_trust: never     # Never ask (use with caution)
```

## The Trust Prompt

When trust is required, Rally shows:

```
⚠️  Trust Required

Project: owner/myrepo
Issue:   #42 - Fix login timeout

Granting trust allows Copilot to:
  • Edit and create files
  • Run shell commands
  • Make changes to your code

Do you want to grant trust? [y/N]
```

## Trust Levels

### `always`

Every dispatch requires confirmation. Most secure.

Best for:
- Shared machines
- Unfamiliar codebases
- Maximum control

### `ask`

Ask once per project. Subsequent dispatches remember the choice.

Best for:
- Personal development
- Familiar projects
- Balance of security and convenience

### `never`

Never ask for confirmation. Least secure.

Best for:
- Automated workflows
- Trusted environments
- When you always want write access

## CLI Override

Override the configuration per-dispatch:

```bash
rally dispatch issue 42 --trust       # Skip trust prompt
rally dispatch issue 42 --no-trust    # Force read-only mode
```

## Revoking Trust

To revoke trust for a project, edit the project entry in `~/rally/projects.yaml` or remove and re-onboard the project.

## Security Recommendations

1. Use `always` on shared machines
2. Use `ask` for personal development
3. Avoid `never` unless you have a specific need
4. Review the issue/PR before granting trust
