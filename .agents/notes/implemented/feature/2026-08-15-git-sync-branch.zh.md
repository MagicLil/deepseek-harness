# Agent Note：用户点击的 Git 同步和切分支

Status: implemented

[English](2026-08-15-git-sync-branch.md) | 中文

## 问题

Cursor 式两栏已经能暂存和提交，但 `↑7` 点不了，也不能换分支。日常 Git 还是空的。Phase 3 / v1 栅栏故意不做 push / pull / fetch，是怕模型拿到会联网的 git 动词。

## 决策

**在现有 ApiProxy 缝上加三个 host RPC：** `host.gitSync`（`fetch` / `pull --ff-only` / `push`）、`host.gitBranches`、`host.gitCheckout`（`git switch` / `git switch -c`）。没有上游的第一次 push 会重试 `git push -u origin HEAD`。不 force-push。不写 `user.name` / `user.email`。远程动词子进程超时 120 秒。

**只给 UI，不当 agent 工具。** 方法挂在 `ctx.workspaces` 上给 Git 页用。不进 inspect catalog 白名单。

**Git 页的「同步」** 先 fetch，落后就 pull，超前再 push。分支下拉框切换；第二行创建分支。失败留在面板上的操作错误里，整页 SCM 列表不换掉。没有暂存时提交按钮是灰的。更改区在「全部暂存」旁边有「全部还原」。

## 考虑过的替代

**把 `git push` 给模型。** 否决：这正是 v1 栅栏存在的原因。用户点击就够了。

**`git pull` 做 merge/rebase。** 否决：`--ff-only` 在分叉时直接失败，更安全。

## 后果

用户可以在桌面 Git 页发布和更新分支。分叉历史和认证失败会显示 git stderr。SCM 外观和提交图见[Git SCM 外观说明](2026-08-15-git-scm-chrome.md)。AI 写提交说明和从图上检出见 [AI/图表笔记](2026-08-15-git-scm-ai-graph.md)。
