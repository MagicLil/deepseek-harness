# Agent Note：左侧栏改成 Cursor 式分隔条

Status: implemented

[English](2026-08-16-cursor-sash.md) | 中文

## 问题

左侧栏（资源管理器 / Git / 任务）看起来不能往右拖宽。缩放提示是窗口正中间一颗 12×32 的浮动胶囊。鼠标停在列边上（Cursor 放分隔条的位置）看不到线。手柄 `z-index: 2`，压在 `shell.overlay`（`z-index: 20`）下面。左侧栏上限 420px，Git 图表不够用。

## 决策

胶囊换成 Cursor / VS Code 分隔条：每条缩放边一条 8px 命中带，悬停/拖动画出通高 2px 的 `--dsw-alias-state-business-primary` 线。手柄升到 `z-index: 21`，避免 overlay 抢走指针。`WORKBENCH_MAX` 从 420 提到 800。让步顺序不变：拖左侧栏仍然先吃编辑器列。

## 考虑过的替代

**留着胶囊，只抬 z-index。** 否决：胶囊在高窗口正中间，眼睛盯着 Git 图表右缘的人找不到。

**编辑器已经 400px 时，拖左侧栏接着吃对话列。** 这次不做：那不是 Cursor（每条分隔条只改相邻两列）。编辑器已经到底就去拖对话列。

## 后果

桌面端要先重建 `ui-layout`（`lib/client.js`），新分隔条才会画出来。已经记住 260–420 宽度的会话保持原偏好，直到用户再拖一次。
