# Agent Note: Git picker scoped to the current workspace

Status: implemented

English | [中文](2026-08-17-git-repo-picker-current-workspace.zh.md)

## Problem

The Source Control repository dropdown listed every registered Workspace and every child repo under those folders. With many rail projects (`sanmu`, `jianghuawei`, `worldCoffee`, …) the picker mixed unrelated repositories. Explorer already shows only the conversation's folder; Git did not. The earlier [add-Workspace picker](2026-08-17-git-workspace-repo-picker.md) walked every registry path so a newly added sibling could appear without changing the session — that is what filled the list.

## Decision

`gitWorkspaceSeeds` keeps the session cwd (the same folder `resolveExplorerRoots` uses) and registered paths under it. Parent folders, siblings, and other rail projects are dropped before `discoverGitRoots` runs. `apply` also passes only the current explorer root into `getWorkspacePaths`, so the tab does not even list foreign Workspaces. One-level child discovery still runs when the current folder is not a work tree (`sanmu` → `sanmu_hd` / `sanmu_qd`).

## Alternatives considered

**Keep probing every registered Workspace and add a filter box on the picker.** Rejected: the right rail already is the project selector. A second filter would duplicate it and still spend RPCs on every other repo.

**Treat a registered parent of the current repo as a seed (see siblings).** Rejected: that is the previous add-Workspace behavior and is what mixed `dsh-cursor-acp` into a `deepseek-harness` session. Switch the conversation to the parent project when those children should appear.

## Consequences

The Git dropdown matches the selected right-rail project. Adding an unrelated Workspace no longer grows the current session's picker. Switching conversations to another folder changes the seed. `discoverGitRoots` itself is unchanged; only its inputs are scoped.
