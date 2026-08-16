# Agent Note: Git 图僵尸轨道

Status: implemented

English | [2026-08-16-git-graph-zombie-lanes.md](2026-08-16-git-graph-zombie-lanes.md)

## 问题

源代码管理的提交图会画出密密麻麻的彩色网格，和 Cursor 稀疏的几条轨不一样。`layoutGitGraph` 给每个 merge 的第二父提交新开一条轨。当前 `git log` 页里没有的父提交永远不会落到某行上，`slots` 和 `railCount` 就只增不减。

## 决策

还在本页后面的父提交继续占真轨道。页外的父提交只画一小段 hook，不占 slot。第一父提交若也在页外，清掉这条轨，不留下幽灵 hash。每一行 SVG 共用本页最大轨宽，提交说明才能对齐。

## 考虑过的替代

**画轨上限 6，多的藏掉。** 否决：真的本地分支会被裁掉。密是因为 merge 父提交没释放，不是活着的 tip 太多。

**只改样式：线细一点、间距窄一点。** 否决：二十条僵尸轨再细也还是网格。

## 后果

另一边父提交在下一页的 merge 只显示短 hook，不再继续往下画彩色竖线。桌面要重建 `ui-xmart-workbench` client 后才会看到稀疏图。
