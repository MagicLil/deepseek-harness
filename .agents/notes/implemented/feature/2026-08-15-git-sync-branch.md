# Agent Note: User-clicked Git sync and branch switch

Status: implemented

English | [中文](2026-08-15-git-sync-branch.zh.md)

## Problem

The Cursor-style SCM lists could stage and commit, but `↑7` did nothing and there was no way to change branch. Daily Git still felt empty. Phase 3 / the v1 fence left push / pull / fetch out so the agent would not get network git verbs.

## Decision

**Add three host RPCs on the existing ApiProxy seam:** `host.gitSync` (`fetch` / `pull --ff-only` / `push`), `host.gitBranches`, `host.gitCheckout` (`git switch` / `git switch -c`). First push without an upstream retries as `git push -u origin HEAD`. Never force-push. Never write `user.name` / `user.email`. Remote verbs use a 120s child timeout.

**UI only, not an agent tool.** The methods sit on `ctx.workspaces` for the Git tab. They are not added to the inspect-catalog whitelist.

**The Git tab Sync button** fetches, then pulls if behind, then pushes if ahead. Branch `<select>` switches; a second row creates a branch. Failures stay on the panel as an action error instead of replacing the whole SCM list. Commit stays disabled until something is staged. The changes section has Discard All next to Stage All.

## Alternatives considered

**Give the model `git push`.** Rejected: that is the reason the v1 fence existed. User click is enough.

**`git pull` with merge/rebase.** Rejected: `--ff-only` fails closed when histories diverge.

## Consequences

A user can publish and update a branch from the desktop Git tab. Diverged histories and auth failures show the git stderr. The SCM chrome and commit-graph paint live in [the Git SCM chrome note](2026-08-15-git-scm-chrome.md). AI commit messages and checkout-from-graph live in [the AI/graph note](2026-08-15-git-scm-ai-graph.md).
