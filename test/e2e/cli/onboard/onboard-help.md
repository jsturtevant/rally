# Onboard Tests

Tests for `rally onboard` commands. Help tests only — no network or filesystem needed.

## `rally onboard --help`

Shows onboard usage, arguments, options, and subcommands.

```expected
Usage: rally onboard [options] [command] [path]

Onboard a repo to Rally (local path, GitHub URL, or owner/repo)

Arguments:
  path                        Path, GitHub URL, or owner/repo (defaults to current directory)

Options:
  --team <name>               Use a named team (skips interactive prompt)
  --fork <owner/repo>         Set origin to your fork and upstream to the main repo
  -h, --help                  display help for command

Commands:
  remove [options] [project]  Remove an onboarded project from Rally
```

## `rally onboard remove --help`

Shows remove subcommand usage.

```expected
Usage: rally onboard remove [options] [project]

Remove an onboarded project from Rally

Arguments:
  project     Project name to remove (interactive picker if omitted)

Options:
  --yes       Skip confirmation prompt
  -h, --help  display help for command
```
