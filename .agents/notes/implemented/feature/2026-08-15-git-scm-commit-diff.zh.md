# Agent Note：Cursor 式提交图外观，以及点开看 diff

Status: implemented

[English](2026-08-15-git-scm-commit-diff.md) | 中文

## 问题

提交图行首还挂着短哈希，作者名没画出来，点一行会走 `git switch --detach`。Cursor 是在中间编辑器轨道打开那次提交的按文件 unified diff。

## 决策

**点一行打开隐藏的 `diff` 标签。** 种子路径是 `commit:<hash>`。`workspaces.gitCommitDiff` 复用现有 `host.gitDiff`，带上可选的 `commit`。宿主跑 `git show --format= --first-parent --patch`，根提交也能出 patch，合并提交只看 first-parent。`side` 对旧客户端仍必填；有 `commit` 时忽略它。

**图表外观对齐 Cursor。** 行首不再写短哈希，作者名跟在说明后面并淡化，轨道更高，HEAD 节点加一圈环。本地分支药丸仍 `git switch`。远程/标签药丸仍分离 HEAD。HEAD 药丸不响应。

**差异标签按文件切开。** 每个 `diff --git` 变成可折叠头（文件名、淡目录、A/M/D/R）加带行号的增删行。Monaco DiffEditor 仍暂缓。

新的 `commit` 字段和 `gitCommitDiff` 不是 agent 工具，也不进 inspect catalog 白名单。

## 考虑过的替代

**行上继续 detach，另加「查看」按钮。** 否决：那不是这块面板在学的 Cursor 手势。

**`hash~1` / `git diff HEAD^`。** 否决：根提交没有父提交。

**新开 `host.gitShow` RPC。** 否决：在现有 required-on-read 的 `host.gitDiff` 上加可选 `commit`，分叉成本更小。

## 后果

点历史打开该次提交的 diff；检出仍只走引用标签。章鱼布局、带语法高亮的 Monaco 差异、Agent Review 仍不在范围内。
