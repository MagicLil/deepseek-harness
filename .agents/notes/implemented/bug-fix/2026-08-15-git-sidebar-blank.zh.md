# 点 Git 后左侧栏是一块黑

[English](2026-08-15-git-sidebar-blank.md) | 中文

## 原因

活动栏 Git 图标能选中，但左侧主栏仍是一条黑带。两件事叠在一起：

1. `primarySidebar` 槽位外包是 `display: contents`。侧栏根节点如果只写 `flex: 1`、没有确定的 `height: 100%`，Git/资源管理器面板（`flex: 1; min-height: 0`）高度会算成 0，状态文案全被裁掉。
2. Git 面板没挂上或渲染抛错时以前什么都不画。框架的槽位错误边界会换成空的 `<div data-slot-error>`，看起来就像「Git 没做」。
3. `registerActivity` 以前在 `registerTab` 之后才跑，而且还要 `getTab('git')` 已经在。effect 还没冲刷时 Git 进不了活动注册表；后面再注册一次还会把 `apply` 打断，侧栏槽位根本装不上。

## 改动

`PrimarySidebar` 始终画活动标题，用 `height: 100%` 铺满列，并在面板未注册或抛错时留下说明（`ActivityPaneBoundary`）。`GitTab` 把同步抛出的 `gitLog`/`gitStatus` 收成错误态，也不再假定 `changes` / `log` 一定是数组。资源管理器 / Git / 任务现在在同一次 `ctx.effect` 里注册 tab 和活动。`AppFrame` 的 `primaryCol` 改成带定位的 flex 列，好让 contents 包装的占用者能铺满轨道。

见工作区 `FORK-PATCHES.md` 条目 7。
