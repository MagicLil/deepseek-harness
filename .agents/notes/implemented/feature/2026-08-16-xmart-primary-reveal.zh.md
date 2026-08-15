# Agent Note：对话拖到 2/3 后点开资源管理器

Status: implemented

[English](2026-08-16-xmart-primary-reveal.md) | 中文

## 问题

对话列拖到窗口三分之二后，`computeColumns` 会把左侧栏让到宽度 0。活动栏点击仍会调用 `openWorkbench`，但偏好已经是 260 时这个动作直接 return。资源管理器 / Git / 任务看起来像点了没反应。

## 决策

继续走公开的 `ctx.layout.openWorkbench()`。AppFrame 把当前框架宽度写进布局 store。`openWorkbench` / `toggleWorkbench` 的打开一侧改问 `planPrimaryReveal`：剩余空间够就按 260px 默认打开；对话列挡路就收一点对话，让资源管理器与编辑器对分剩余空间（优先 400/400）。

## 考虑过的替代

**在 `ILayout` 上新开 `revealPrimary`。** 否决：活动栏和菜单调用方已经都走 `openWorkbench`。改现有打开路径，资源管理器、Git、任务一起修好。

**剩余空间很大时也强制 50/50。** 否决：普通点击会丢掉 260px 默认，还会和工作台的按会话记忆打架。

## 后果

用户显式点击资源管理器 / Git / 任务时，可能会改写对话列偏好。窗口缩放时的让步链仍然不改偏好。桌面端要先重建 `ui-layout`（`lib/client.js`），点击才会生效。
