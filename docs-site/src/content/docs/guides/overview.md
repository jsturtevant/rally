---
title: Rally Overview
description: What Rally does and where it's headed
---

# Rally: AI-Powered Development at Any Scale

## The Vision

Rally enables development teams to grow from individual AI-assisted workflows to fully autonomous, continuously operating agent teams—powered by the same command, scaled to your infrastructure. It ensures those teams stay accountable to human oversight and organizational policy that GitHub provides.

---

## Part 1: Rally (Current)

**Challenge:** Effective AI assistance often requires cluttering your repository with AI configuration—prompt files, knowledge documents, agent definitions, and instruction sets. Many open source projects won't adopt that overhead. Reviewing, implementing, and managing multiple repositories, issues and work is difficult. 

**What it is:** Rally is a CLI tool that dispatches AI agent teams for GitHub issues and pull request reviews via Git worktrees. Individual developers use it to request AI assistance from Squad on code without requiring AI tools to be included in the project. It keeps everything separated and easy to manage. It allows the developer the ability to review everything before submitting to the repository, ensuring they add a Human touch to the workflow and reduce AI slop.

**How it works:** A developer runs `rally dispatch issue` or `rally dispatch pr` to assign an AI agent to several issues and PRs. The agent automatically creates isolated Git worktrees locally, completes the work, and notifies the developer when it is ready. The developer reviews locally and pushes the PR when ready.

**Simple workflow:**
```
Developer
    ↓
Rally CLI (dispatch multiple PRs/Issues)
    ↓
Developer gets coffee, goes to team meetings
    ↓
Git Worktree (isolated branch)
    ↓
AI agents work while the developer does other things
    ↓
Developer finished meeting and reviews, edits, adjusts the completed work
    ↓
User pushes and opens Pull Request when satisfied
```

Rally leverages Squad to keep a "memory" but it lives outside of the repository.  This enables the Agent to be as effective as it would be in a fully AI adopted project.

---

## Part 2: Rally Party

**What it is:** Party is a Kubernetes-native (other platform support could be added) orchestration system for running multiple AI agents in parallel at scale using GitHub as the source of truth. Teams and organizations use it for autonomous, continuous AI-driven development across their entire repository bringing in Humans to help clarify, and monitor changes to sensitive files with full traceability through GitHub.

**How it works:** AI Coordinators continuously monitor GitHub, triage incoming work, clarify requirements, and assign issues to ephemeral worker Jobs. Multiple levels of reviewer approval gates ensure quality before merging. Workers complete their assignments, open PRs, and upon merge send learnings back to coordinators via Squad Consult Mode - enabling the coordination team to accumulate knowledge across all completed tasks.

**Key capabilities:**
- Coordinator-driven work assignment with capacity management
- Multiple reviewer gates for quality control and verification
- Squad Consult Mode: workers send learnings back after merge — coordinators use these to brief future workers and improve coordination strategy
- Human approval gates for high-risk changes (security, dependencies, architecture, breaking changes)
- Full traceability
- Fine-grained GitHub PAT security

**Scalable workflow:**
```
GitHub Repository
    ↓
Coordinator StatefulSet (monitors & assigns)
    ↓
Worker Jobs (ephemeral, parallel execution)
    ↓
Pull Requests
    ↓
Review & Merge
    ↓
Consult Learnings (fed back to coordinators)
```

---

## Architecture: Rally

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Developer's Machine                           │
│                                                                      │
│  👤 Developer                                                        │
│   │                                                                  │
│   ├── rally dispatch issue 42                                        │
│   ├── rally dispatch issue 43                                        │
│   └── rally dispatch pr 12                                           │
│         │                                                            │
│         ▼                                                            │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │                    Rally CLI + Squad                         │     │
│  │   ┌──────────┐  ┌──────────┐  ┌──────────┐                 │     │
│  │   │ Worktree  │  │ Worktree  │  │ Worktree  │                │     │
│  │   │ issue-42  │  │ issue-43  │  │ pr-12     │                │     │
│  │   │           │  │           │  │           │                │     │
│  │   │ 🤖 Agent  │  │ 🤖 Agent  │  │ 🤖 Agent  │                │     │
│  │   │ (working) │  │ (working) │  │ (reviewing)│               │     │
│  │   └─────┬─────┘  └─────┬─────┘  └─────┬─────┘               │     │
│  │         │              │              │                      │     │
│  │  .squad/ memory (lives outside repo — no clutter)            │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                      │
│  👤 Developer returns, reviews & refines with AI                     │
│   │                                                                  │
│   ├── Reviews #42 → edits code, asks agent to revise  🔄            │
│   ├── Reviews #43 → looks good, approves as-is        ✅            │
│   └── Reviews PR #12 feedback → adjusts with agent    🔄            │
│   │                                                                  │
│   └── 👤 Developer decides what ships                                │
│         │                                                            │
└─────────┼────────────────────────────────────────────────────────────┘
          │  git push (human-approved only)
          ▼
┌──────────────────────┐
│       GitHub         │
│  - Pull Requests     │
│  - Code Review       │
│  - CI/CD             │
│  👤 Team reviews PRs │
└──────────────────────┘
```

**Human touchpoints:** Developer dispatches work, then reviews, edits, and iterates with AI before pushing — nothing ships without human judgment. Team reviews PRs on GitHub. The developer is always in the loop, not just at the end.

---

## Architecture: Rally Party

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Kubernetes Cluster                             │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │               Coordinator StatefulSet (3 pods)                    │  │
│  │                                                                   │  │
│  │  coordinator-0          coordinator-1         coordinator-2       │  │
│  │  (LEAD)                 (REVIEWER)            (REVIEWER)          │  │
│  │  - Monitors issues      - Reviews PRs         - Reviews PRs       │  │
│  │  - Triages & assigns    - Approval gate       - Approval gate     │  │
│  │  - Spawns workers       - 👤 Escalates to     - 👤 Escalates to   │  │
│  │  - Merges PRs ✅           human if needed       human if needed  │  │
│  │  - Receives learnings   - Cannot merge ⛔     - Cannot merge ⛔   │  │
│  │  - 👤 Escalates to                                                │  │
│  │    human if reqs unclear                                          │  │
│  └──────────┬──────────────────────▲─────────────────────────────────┘  │
│             │ assigns issue #       │ consult learnings (A2A)           │
│             ▼                       │                                   │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                     Worker Jobs (ephemeral)                       │  │
│  │                                                                   │
│  │  worker-42          worker-43          worker-44                  │  │
│  │  🤖 Does work       🤖 Does work       🤖 Does work              │  │
│  │  Opens PR           Opens PR           Opens PR                  │  │
│  │  Sends learnings    Sends learnings    Sends learnings           │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────┐  ┌──────────────────────────────────────┐    │
│  │  ConfigMap            │  │  Secret                              │    │
│  │  Copilot settings     │  │  Fine-grained GitHub PAT             │    │
│  └──────────────────────┘  └──────────────────────────────────────┘    │
│                                                                         │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │  GitHub API
                                ▼
                   ┌──────────────────────────┐
                   │         GitHub            │
                   │                           │
                   │  Issues → PRs → Reviews   │
                   │                           │
                   │  👤 Human gates:           │
                   │  - Unclear requirements    │
                   │  - High-risk changes      │
                   │  - Security & deps         │
                   │  - Architecture decisions  │
                   │  - Full audit trail        │
                   └──────────────────────────┘
```

**Human touchpoints:** AI Lead escalates to humans when issue requirements are unclear during triage. Reviewers flag security, dependency, and architecture changes for human approval. All activity is traceable through GitHub issues, PRs, and labels. Can enable autonomous changes for small PR or full Human Review before merging.
