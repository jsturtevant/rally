---
title: Configuration
description: Rally configuration options
---

## Configuration File

Rally stores configuration in `~/rally/config.yaml`.

## Settings Reference

| Setting | Values | Default | Description |
|---------|--------|---------|-------------|
| `docker_sandbox` | `always`, `never`, `ask` | `ask` | Run dispatches in Docker sandbox |
| `require_trust` | `always`, `never`, `ask` | `ask` | Require trust confirmation before dispatch |
| `review_template` | path string | none | Custom review template file |
| `deny_tools_copilot` | array of tool names | defaults | Tools to deny in normal mode |
| `deny_tools_sandbox` | array of tool names | defaults | Tools to deny in sandbox mode |
| `disallow_temp_dir` | boolean | `true` | Prevent Copilot from writing to temp directories outside the worktree |

## Example Configuration

```yaml
settings:
  docker_sandbox: ask
  require_trust: always
  review_template: review-template.md
  disallow_temp_dir: true
  deny_tools_copilot:
    - bash
    - edit
    - create
  deny_tools_sandbox:
    - bash
```

## Configuration Precedence

CLI flags override config file settings:

```bash
# Config says docker_sandbox: never, but CLI overrides
rally dispatch issue 42 --sandbox
```

## File Locations

| File | Purpose |
|------|---------|
| `~/rally/config.yaml` | User configuration |
| `~/rally/projects.yaml` | Registered projects |
| `~/rally/active/` | Active dispatch tracking |
| `~/rally/logs/` | Session logs |

## Team Configuration

Team files are symlinked from a shared location:
- `.squad/` — Team state and settings
- `.squad-templates/` — Issue/PR templates
- `.github/agents/` — Agent configurations

## Environment Variables

| Variable | Description |
|----------|-------------|
| `RALLY_DEBUG` | Enable debug output |
| `RALLY_HOME` | Override Rally home directory (default: `~/rally`) |
| `GH_TOKEN` | GitHub token (usually set by `gh auth`) |

## Security Notes

- Config files are created with `0600` permissions (owner read/write only)
- `review_template` paths are validated to prevent path traversal
- `deny_tools_*` arrays cannot be empty (defaults apply)

See [Security Overview](/rally/security/overview/) for more details.
