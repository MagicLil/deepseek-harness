# Agent Note: Cursor 式 X-Mart 整壳

Status: implemented

[English](2026-08-15-xmart-cursor-shell.md) | 中文

## 问题

Phase 0 的工作台在对话右侧第四列。想要 Cursor 式编码面的用户会看到对话居中、工具在最右，编辑器永远不像主窗格。资源管理器、Git、任务和预留终端仍和打开的文件挤在同一条 Tab 上。浮层「重新打开工作台」假定中间列可以关掉。2026-08-15 的产品决定用整壳对换替换原 D2，且不得重开 `conversation.view` 或 `agent-loop`。

## 决策

**AppFrame 画六条水平轨道，外加只铺在编辑器下的底栏。** 顺序是活动栏（48px）| 左侧边栏 | 编辑器（`workbench`）| 对话 | 详情 | 会话列表。现有槽位 id 保留，只改画位，因此 `ui-sidebar` 仍 inject `sidebar`，工作台插件仍 inject `workbench`。新声明是 `activityBar`、`primarySidebar`、`bottomPanel`（均为 session / single）。让步顺序是详情 → 对话 → 左侧边栏；活动栏永不让；关闭的会话列收成 56px 轨。编辑器地板 400px。`openWorkbench` / `closeWorkbench` / `setWorkbench` 驱动左侧边栏宽度，这样现有的 `openFile` → `attachPanel` 仍能露出一列。`toggleSidebar` 仍表示最右会话列。

**`ui-xmart-workbench` 占用新座位，不再把资源管理器放进编辑器 Tab 条。** `ActivityBar` 填 `activityBar`。`PrimarySidebar` 填 `primarySidebar`，按会话 `activity` 字段渲染已注册的 `explorer` / `git` / `tasks` 体。`BottomPanel` 填 `bottomPanel`，挂预留的 `terminal` 体。`WorkbenchColumn` 仍在 `workbench`，去掉关闭铬，从 Tab 条滤掉壳类型，并保持挂载。这四种类型注册为 `hidden: true`。活动项跟会话 tab store 一起持久化；左侧开/关和宽度仍记在 `dsh.xmart.workbench`。浮层开关已去掉。活动栏上的设置点击现有的 `sidebar.settings` 触发器。

本笔记取代 [Phase 0 工作台列笔记](2026-08-15-xmart-workbench-column.md) 里的列位置。该笔记中的 host 接缝（IPC、`host.git*`、不新开页面 WebSocket）仍然成立。

## 曾考虑的替代方案

**对话继续居中，只重绘右侧工作台。** 否决：已批准的产品选择是整壳对换，不是给 Phase 0 第四列换皮。

**把 `sidebar` / `workbench` 改名以匹配新画位。** 否决：这两个 id 是 `ui-sidebar` 和现有工作台占用方的 inject 目标。为了名字去大面积改 L3 不值。

**给编辑器单独的开关偏好。** 否决：中列是产品的常驻窗格。再给它关闭能力，等于把刚拿掉的浮层开关请回来。

**为活动栏新开 HTTP 或 WebSocket。** 否决：桌面端没有页面 webserver。新座位是走 `ctx.layout` 的槽位占用方。

## 后果

桌面端和 web 端都渲染 活动栏 | 左侧 | 编辑器 | 对话 | 详情 | 会话。编辑器列不能关。底栏终端位在后续 PTY 切片之前只是占位。`ui-sidebar` 未改。Fork 台账条目 7 登记了 `ui-layout` 的 L3。真 PTY、对话路径点击改道、Git push/pull 不在本改动里。
