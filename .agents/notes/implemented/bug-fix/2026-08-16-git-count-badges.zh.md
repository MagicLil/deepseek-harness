# Agent Note：Git 绿色计数泡泡

Status: implemented

[English](2026-08-16-git-count-badges.md) | 中文

## 问题

源代码管理分区计数用了 `--dsw-alias-brand-primary`（没有改成万物智汇绿），看起来像发白的淡泡。活动栏 Git 图标上也没有合计。

## 决策

按 Cursor 的算法数暂存 / 未暂存（同一路径两边都出现就数两次）。分区标题右侧用绿色泡泡（`--dsw-alias-button-info-fill` / `#5BB73B`），Git 图标用同一个绿泡显示暂存 + 更改（1000 及以下显示原数，超过显示 `1k+`）。活动栏自己拉一次 status，资源管理器在前时图标也会更新。

## 考虑过的其他做法

**只改分区泡泡颜色。** 否决：用户还要图标汇总。

**等打开 Git 页再打标。** 否决：图标在每个活动项上都看得到。

## 后果

打开工作区时活动栏会在不挂 SCM 的情况下自己拉 `gitStatus`。泡泡现在按 Git 选择器里的每个仓库加总；见 [全仓徽章笔记](2026-08-17-git-badge-all-repos.md)。
