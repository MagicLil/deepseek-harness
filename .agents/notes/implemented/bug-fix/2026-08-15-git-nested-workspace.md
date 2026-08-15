# Git status failed on a multi-project workspace

English | [中文](2026-08-15-git-nested-workspace.zh.md)

## Why

The session cwd for 安瑞森 is `D:\work\company\anruisen`. That folder is a VS Code multi-root parent (`anruisen.code-workspace` lists `xmart-backend` and `xmart-web`). It has no `.git`. The real repositories are the two children. The Git panel ran `git -C <cwd>`, which is not a work tree.

`Promise.all([gitStatus, gitLog])` also turned a log-side throw into the generic “Could not read git status” face, so a not-a-repo cwd looked like a hard failure.

## What changed

`GitTab` now probes immediate visible child directories when the cwd is `git-unavailable`. One or more child repos load; two or more get a repository picker. Status still renders if `gitLog` fails. Host error text is shown on the error face.

L2 only (`ui-xmart-workbench`).
