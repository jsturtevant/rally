---
clone: jsturtevant/rally-test-fixtures
setup: setup-squad.js
---

# Dashboard Onboarded Projects

Verifies that onboarding repositories makes them appear in the dashboard JSON output, that project filtering works across multiple onboarded repos, and that removing them clears the dashboard.

## `rally onboard . --team default`

Onboard the cloned test fixtures repo.

```expected
✓ Updated .git/info/exclude
✓ Registered project: $PROJECT_NAME
```

## `rally onboard jsturtevant/rally --team default`

Onboard a second repo by URL — rally handles the clone.

```expected
⬇ Cloning https://github.com/jsturtevant/rally.git → $RALLY_HOME/projects/rally
✓ Cloned jsturtevant/rally
✓ Updated .git/info/exclude
✓ Registered project: rally
```

## `rally dashboard --json`

Dashboard should now show both onboarded projects.

```expected
{
  "dispatches": [],
  "onboardedProjects": [
    "jsturtevant/rally-test-fixtures",
    "jsturtevant/rally"
  ]
}
```

## `rally dashboard --project rally-test-fixtures --json`

Filtering by rally-test-fixtures should show only that project.

```expected
{
  "dispatches": [],
  "onboardedProjects": [
    "jsturtevant/rally-test-fixtures"
  ]
}
```

## `rally dashboard --project rally --json`

Filtering by rally should show only the rally project.

```expected
{
  "dispatches": [],
  "onboardedProjects": [
    "jsturtevant/rally"
  ]
}
```

## `rally dashboard --project nonexistent --json`

Filtering by a name that doesn't match should show empty.

```expected
{
  "dispatches": [],
  "onboardedProjects": []
}
```

## `rally onboard remove $PROJECT_NAME --yes`

Clean up — remove the fixtures project.

```expected
✓ Removed project: $PROJECT_NAME (jsturtevant/rally-test-fixtures)
```

## `rally onboard remove rally --yes`

Clean up — remove the rally project.

```expected
✓ Removed project: rally (jsturtevant/rally)
```

## `rally dashboard --json`

After removing both, dashboard should show empty projects.

```expected
{
  "dispatches": [],
  "onboardedProjects": []
}
```
