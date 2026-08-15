# Git diff failed on a multi-project workspace

English | [中文](2026-08-16-git-diff-nested-root.zh.md)

## Why

`GitTab` already probes child repos when the session cwd is not a work tree (安瑞森: `D:\work\company\anruisen` → `xmart-backend` / `xmart-web`). Status, stage, and commit use `status.root`. The hidden diff tab did not.

Clicking a change or a graph row opened `host.gitDiff` with `getCwd(sessionId)` — the parent folder. `git -C <parent>` is not a repository, so the tab showed “Could not read the diff.”

## What changed

Diff tab seeds now carry the selected repository root (`side:file` / `commit:<hash>` plus an RS-separated absolute root). `DiffTab` prefers that root over the session cwd. `GitTab` passes `status.root` into `openDiff` / `openCommit`.

L2 only (`ui-xmart-workbench`).
