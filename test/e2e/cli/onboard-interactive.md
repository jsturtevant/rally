---
repo: local
---

# Interactive Onboard Tests

Tests for `rally onboard .` without `--team` flag — exercises the interactive squad creation flow via PTY.

## `rally onboard .`

Onboards the current directory. Without `--team`, triggers interactive squad creation
(since no personal squad exists yet). The PTY steps answer the prompts automatically.

```pty
match: Would you like to create one now?
send: y

match: What kind of team do you need?
send: {enter}
```

```expected
✓ Updated .git/info/exclude
✓ Registered project: $PROJECT_NAME
```
