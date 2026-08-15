# Agent Note：Cursor 式 Git 暂存/更改列表

Status: implemented

[English](2026-08-15-git-scm-cursor.md) | 中文

## 问题

工作台 Git 页以前是扁平的 `M`/`U` 列表。暂存、取消暂存、还原、看差异都藏在右键里，看起来像没做。点一行打开的是文件，不是 diff。porcelain 的 `XY` 被收成一个 `status`，索引和工作区都脏的文件（`MM`）没法同时出现在 Cursor 的两栏里。

## 决策

**`host.gitStatus` 补上 `area`（L3）。** 解析器按 porcelain 一行吐出 `index` 和/或 `worktree`。`MM` 变成两行。这是现有 RPC 的 required-on-read 字段，不加新 host 方法。

**L2 Git 页对齐 Cursor 两栏。** 「暂存的更改 / 更改」带数量和全部暂存/全部取消暂存。行悬停露出 `+` / `−` / 还原。点击一行按该侧打开 `host.gitDiff`。提交图和源代码管理外观见[Git SCM 外观说明](2026-08-15-git-scm-chrome.md)。

**本片不做：** 同步和切分支见[同步说明](2026-08-15-git-sync-branch.md)。AI 写提交说明和从图上检出见 [AI/图表笔记](2026-08-15-git-scm-ai-graph.md)。

## 考虑过的替代

**搬一个 GitHub 上的 SCM webview。** 否决：桌面端没有页面 WebSocket，第三方面板也走不了 `host.git*` IPC。

**继续一行一个路径。** 否决：Cursor 的两栏需要 `MM` 的两侧。

## 后果

脏工作区能看到两栏、悬停操作、点击看 diff。此前的子目录仓库探测不变。手写 `GitChange` 的调用方必须带 `area`。
