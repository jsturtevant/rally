---
name: squad-sdk-local-build
description: Workaround for installing Squad SDK from GitHub branches that don't have dist/ committed
confidence: high
---

# Squad SDK Local Build Workaround

## Problem

When installing the Squad SDK (`@bradygaster/squad`) from a GitHub branch, npm does NOT:
- Install devDependencies of the package
- Run `prepare` scripts that require devDependencies (like TypeScript)

This means branches without a committed `dist/` folder will fail to import because the compiled JavaScript doesn't exist.

**Error symptom:**
```
Cannot find module '@bradygaster/squad/packages/squad-sdk/dist/index.js'
```

## Why npm flags don't help

| Flag | What it does | Why it doesn't help |
|------|-------------|---------------------|
| `--include=dev` | Installs YOUR project's devDeps | Doesn't affect installed package's devDeps |
| `--install-links` | Changes symlink handling | Doesn't trigger build scripts |
| Global TypeScript | Makes `tsc` available | npm doesn't run `prepare` for GitHub tarballs |

## Workaround

1. Clone the SDK repo locally and build it:
   ```bash
   cd /tmp
   git clone https://github.com/jsturtevant/squad-pr.git
   cd squad-pr
   git checkout consult-mode-impl
   npm install
   npm run build
   ```

2. Update package.json to use the local path:
   ```bash
   npm pkg set dependencies.@bradygaster/squad="file:/tmp/squad-pr"
   npm install
   ```

3. Verify:
   ```bash
   ls node_modules/@bradygaster/squad/packages/squad-sdk/dist/
   # Should show: index.js, index.d.ts, etc.
   ```

## When to use this

- Testing SDK changes before they're published to npm
- Using feature branches that have TypeScript source but no `dist/`
- Any branch where `setupConsultMode()` or other new features aren't in the published npm version

## Permanent fix (for SDK team)

The SDK team should do ONE of:
1. **Commit `dist/` to branches** — simplest, works immediately
2. **Publish to npm** — proper solution for releases
3. **Add `prepublishOnly` that builds** — already exists, but only runs on `npm publish`

## Current state

- `package.json` uses `file:/tmp/squad-pr`
- Local build at `/tmp/squad-pr` includes `dist/` folder
- Tests pass (104/104)
