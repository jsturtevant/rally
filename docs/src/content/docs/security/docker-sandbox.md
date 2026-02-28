---
title: Docker Sandbox
description: Running dispatches in isolated containers
---

## What is the Docker Sandbox?

The Docker sandbox runs Copilot in an isolated Docker container. This provides:

- **Filesystem isolation** — Container can't access host filesystem
- **Network isolation** — Limited network access
- **Resource limits** — CPU and memory constraints
- **Clean environment** — No access to host credentials

## Enabling the Sandbox

### Per-Dispatch

```bash
rally dispatch issue 42 --sandbox
```

### Configuration

```yaml
# ~/rally/config.yaml
settings:
  docker_sandbox: always    # Always use sandbox
  docker_sandbox: ask       # Ask each time (default)
  docker_sandbox: never     # Never use sandbox
```

## Requirements

- Docker installed and running
- User in the `docker` group (or using `sudo`)

```bash
# Add yourself to docker group
sudo usermod -aG docker $USER
# Log out and back in
```

## What Runs in the Container?

The container includes:
- Node.js runtime
- Git
- GitHub CLI (`gh`)
- Copilot CLI

The project worktree is mounted into the container.

## Tool Restrictions in Sandbox

The sandbox uses a separate deny list:

```yaml
settings:
  deny_tools_sandbox:
    - bash          # Still restricted
```

By default, the sandbox is more permissive than normal mode since the container provides isolation.

## Limitations

- **Slower startup** — Container initialization adds overhead
- **Limited tools** — Only tools in the container image
- **Mount restrictions** — Some paths may not be accessible

## When to Use Sandbox

Use the sandbox when:
- Working with untrusted code
- Running on shared machines
- Experimenting with risky changes

Normal mode is fine when:
- Working on your own code
- You trust the repository
- You need faster iteration
