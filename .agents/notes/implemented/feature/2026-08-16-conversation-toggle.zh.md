# Agent Note：标题栏对话收起

Status: implemented

[English](2026-08-16-conversation-toggle.md) | 中文

## 问题

对话列没有关闭动作（`setConversation` 最低 320px）。不能像 Cursor 那样把对话收起来。最小化/最大化/关闭是 Windows 原生标题栏，HTML 按钮不改 overlay 就靠不到最小化旁边。

## 决策

`ctx.layout` 增加 `openConversation` / `closeConversation` / `toggleConversation`（0 = 关闭；再打开恢复 380px）。桌面窗口用 `titleBarStyle: 'hidden'` 加 32px `titleBarOverlay`，系统三个按钮还在。AppFrame 在叠加条里画对话气泡，紧挨最小化左边。视图菜单「切换对话」（`Ctrl+Alt+B`）走同一动作。

## 考虑过的替代

**只做在对话列标题行。** 否决：列一关按钮就没了。

**留着原生标题栏，按钮放内容区右上角。** 否决：那不是最小化旁边，用户点名要这个位置。

## 后果

桌面要重建 `ui-layout`（`lib/client.js`）和桌面主进程（`title-bar` / `shell`），叠加条和按钮才会出现。需要重启 `pnpm dsh desktop`。标题栏不再画窗口标题文字（任务栏仍用 `document.title`）。
