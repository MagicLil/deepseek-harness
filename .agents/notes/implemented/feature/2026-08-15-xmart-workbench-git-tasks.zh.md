# Agent Note: 万物智汇工作台 Git、任务与旧编辑器退役

Status: implemented

[English](2026-08-15-xmart-workbench-git-tasks.md) | 中文

## 问题

Phase 2 已经有资源管理器和多文件编辑。用户还是不能在栏里暂存/提交，看不到会话旁的后台任务，旧的 `ui-editor` 标签仍占着对话视图环。真 Windows PTY 比这一刀要大。

## 决策

**Git 动词沿着现有 ApiProxy 缝往下加。** `host.gitDiff` / `gitStage` / `gitUnstage` / `gitCommit` / `gitDiscard` / `gitLog` 跟 `host.gitStatus` 坐在一起。只调 git CLI，绝不写 `user.name` / `user.email`，也不做 push / pull / fetch。客户端失败仍是 `GitAccessError`。Git 标签是普通 `registerTab`；隐藏的 `diff` 标签显示 unified 文本（不是 Monaco DiffEditor）。D7 的文件工具刷新计数也会重读 Git 状态。

**任务留在 L2。** 任务标签读当前回合（`SessionSummary.running` 加上已绑定会话的 `runningCalls`）、`jobsBySession` 和 `subagentsByParent`。停止当前回合或子代理走 `ctx.sessions`。不 import `ui-jobs` / `ui-subagent`。列内分栏已去掉（[去掉工作台分栏](../simplification/2026-08-15-drop-workbench-split.md)）。预留终端体占用 AppFrame 的 `bottomPanel` 轨道；真 PTY 仍推迟（[Cursor 式整壳](2026-08-15-xmart-cursor-shell.md)）。

**终端是老实的预留位。** 默认 web/桌面包不挂 `ctx.terminals`，桌面也没有页面 WebSocket。底栏把这件事说清楚，而不是假装有个壳。

**Phase 6 走 L1。** 两个 bundle patch 都把 `ui-editor` 设成 `disabled: true`。对话视图环回到「对话 + 轨迹」。文件归工作台列。

## 考虑过的替代

**这一刀就上真 xterm + ConPTY。** 否决：`ctx.terminals` 只在 host、不在默认桌面名册里，实时输出还要新的 `events.host` 帧。那是后续 L3，不是假终端。

**v1 就上 Monaco DiffEditor。** 否决：双栏需要两份文件缓冲，host 还没跟 `gitDiff` 配好。`git diff` 的 unified 文本够验收暂存/提交。

**后台任务的终止/实时输出。** 否决：这些动词还不在 client sessions 面上。把快照里已有的列出来，是 L2 能做的上限。

## 后果

有 cwd 的会话可以从 + 打开 Git，暂存一个文件，Ctrl+Enter 提交，并打开 unified 差异标签。任务页列出当前回合、作业和子代理。两个安装包里的旧编辑器标签都没了。交互终端、作业终止/输出、对话里点路径进工作台、图片字节、重命名/删除仍不在范围内。
