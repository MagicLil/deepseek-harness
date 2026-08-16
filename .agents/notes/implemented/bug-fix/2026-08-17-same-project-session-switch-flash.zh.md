# Agent Note: Same-project conversation switch flash

Status: implemented

[English](2026-08-17-same-project-session-switch-flash.md) | 中文

## 问题

在同一项目里点另一条对话时，活动栏、资源管理器、编辑器、底栏和对话壳都会整棵重挂。FileTree 丢掉已加载的目录，Monaco 拆掉重来，窗口空一帧。 [同项目继承](../feature/2026-08-16-xmart-same-project-inherit.md) 已经拷过标签和宽度，但挡不住 React 本地状态随重挂清掉。

## 决策

工作台铬槽（`menuBar`、`activityBar`、`primarySidebar`、`workbench`、`bottomPanel`）改为 `session-maybe`。`SessionMaybeEntry` 在当前会话存在期间保持同一 incarnation：空白采纳第一个 id，之后切换只就地更新 hooks/props，只有丢掉会话才重挂。严格 `session` 槽（如 `conversation.session`）仍重挂，避免聊天本地状态串台。inject 工厂接受没有会话 id，并绑到 `EMPTY_SESSION_SOURCE`。

## 考虑过的其他做法

**工作台槽继续用 `session`，只拷 persist。** 否决：继承已经这么做了，闪还在，因为 `key={sessionId}` 仍会卸掉 FileTree 和 Monaco。

**改成 `root`。** 否决：左侧栏 persist 经 `storeOf(entry, sessionId)` 按会话隔离。root 会收成一份实例，破坏 D6。

**`session-maybe` 采纳之后切换仍重挂。** 否决：对话壳就是这么闪的。必须随切换重置的状态已经给子节点加了 `key={sessionId}`（如 `PermissionSelect`）。

## 后果

同项目里点对话时，资源管理器树、编辑器标签和活动栏保持挂载。换到另一个文件夹仍会改根；上一棵树留到新目录列出（[跨项目闪屏](2026-08-17-cross-project-session-switch-flash.md)）。聊天正文仍重挂。桌面端要加载重建后的 `ui-layout`、`web-react`、`ui-xmart-workbench` 的 `lib/`，闪才会消失。
