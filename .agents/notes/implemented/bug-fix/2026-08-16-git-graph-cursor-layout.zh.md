# Agent Note: Git 图改成 Cursor 布局

Status: implemented

English | [2026-08-16-git-graph-cursor-layout.md](2026-08-16-git-graph-cursor-layout.md)

## 问题

源代码管理的图像彩色条码。`host.gitLog` 走了 `git log --all`，每个远程 tip 都开一条轨。每一行 SVG 再按本页最宽轨对齐，说明就被推到自己那个点右边很远的地方。点和线也比 Cursor 粗。

## 决策

只走当前 HEAD（`git log -n`，不要 `--all`）。合并父提交只在 16 行以内、且活轨少于 8 条时占真轨，否则画短 hook。每一行 SVG 只画到该行的点（和 hook）。线 1px，点半径 2.5。

## 考虑过的替代

**保留 `--all`，只限制画出来的轨数。** 否决：那些 tip 还在列表里；条码来自把所有远程都走一遍，Cursor 的历史列表不这么干。

**所有说明对齐到共享的图列右边。** 否决：左边轨上的提交正是被这块空白推开的。

## 后果

没合并进来的远程分支不再画成并行轨，切过去才会出现。桌面要重建 host `apiproxy` 和工作台 client，并彻底退出再开。
