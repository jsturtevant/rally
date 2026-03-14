# Dashboard Tests

Tests for the `rally dashboard` command in a fresh Rally environment with no onboarded projects or active dispatches.

## `rally dashboard --help`

Shows dashboard usage and options.

```expected
Usage: rally dashboard [options]

Show active dispatch dashboard

Options:
  --json            Output as JSON instead of interactive UI
  --project <name>  Filter by project (repo name)
  -h, --help        display help for command
```

## `rally dashboard --json`

Outputs empty dashboard data as JSON in a fresh environment.

```expected
{
  "dispatches": [],
  "onboardedProjects": []
}
```

## `rally dashboard --project nonexistent --json`

Filtering by a missing project still returns valid empty dashboard JSON.

```expected
{
  "dispatches": [],
  "onboardedProjects": []
}
```
