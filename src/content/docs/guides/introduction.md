---
title: Introduction
description: What is Rally and why use it?
---

# Rally <sub>your</sub> Squad

Rally is a CLI tool for dispatching AI coding agents ([Squad](https://bradygaster.github.io/squad/) teams) to GitHub issues via git worktrees.

## Why Rally?

Rally is for individual developers using Squad on shared repos — solo devs, open source maintainers, or anyone on a codebase where committing `.squad/` files isn't appropriate.

It automates the full Squad workflow — from GitHub issues to pull requests — without polluting your repository, eliminating ~15 manual steps:
- Creating branches
- Setting up worktrees
- Symlinking Squad state
- Managing multiple parallel dispatches

![Animated demo of Rally CLI automating Squad workflows in a terminal](https://github.com/user-attachments/assets/0dfda827-17c7-4a8e-8adb-6a6474faa43b)

## Requirements

- Node.js >= 20.0.0
- [git](https://git-scm.com/)
- [GitHub CLI (`gh`)](https://cli.github.com/)

## Next Steps

- [Install Rally](/rally/guides/installation/)
- [Quick Start Guide](/rally/guides/quickstart/)
