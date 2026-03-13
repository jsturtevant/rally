# Status Tests

Tests for the `rally status` command in a fresh Rally environment with no onboarded projects or active dispatches.

## `rally status --help`

Shows status usage and options.

```expected
Usage: rally status [options]

Show Rally configuration and active dispatches for debugging

Options:
  --json      Output as JSON
  -h, --help  display help for command
```

## `rally status`

Displays config paths, directories, and empty project/dispatch lists.

```expected
Rally Status
============

Config Paths:
  ✓ config: $RALLY_HOME/config.yaml
  ✗ projects: $RALLY_HOME/projects.yaml
  ✗ active: $RALLY_HOME/active.yaml

Directories:
  configDir:     $RALLY_HOME
  personalSquad: $HOME/.config/squad/.squad
  projectsDir:   $RALLY_HOME/projects

Onboarded Projects (0):
  (none)

Active Dispatches (0):
  (none)
```

## `rally status --json`

Outputs full config state as JSON. Setup already ran so no setup output here.

```expected
{
  "configDir": "$RALLY_HOME",
  "configPaths": {
    "config": {
      "path": "$RALLY_HOME/config.yaml",
      "exists": true
    },
    "projects": {
      "path": "$RALLY_HOME/projects.yaml",
      "exists": false
    },
    "active": {
      "path": "$RALLY_HOME/active.yaml",
      "exists": false
    }
  },
  "personalSquad": "$HOME/.config/squad/.squad",
  "projectsDir": "$RALLY_HOME/projects",
  "projects": [],
  "dispatches": []
}
```
