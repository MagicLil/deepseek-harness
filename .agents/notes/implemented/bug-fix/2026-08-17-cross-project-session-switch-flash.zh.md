# Agent Note: Cross-project conversation switch flash

Status: implemented

[English](2026-08-17-cross-project-session-switch-flash.md) | 中文

## 问题

[同项目铬保持挂载](2026-08-17-same-project-session-switch-flash.md) 之后，点进另一个文件夹的对话窗口仍会闪。左侧栏宽度被目标会话的 persist 盖掉（常常是关着的，或宽度不同），AppFrame 用 300ms 缓动 `grid-template-columns`。资源管理器按文件夹路径给 FileTree 当 key，新根空挂，先画出「加载中」。

## 决策

铬还挂着时，任何会话切换都保住当前侧栏宽度，并写进目标 persist。AppFrame 在切会话时打两帧 `data-settling`，网格不缓动（`transition: none`，和 `data-dragging` 一样）。资源管理器在换根时复用同一个 FileTree 实例，上一份已就绪的目录保持绘制，直到新根加载完成。

## 考虑过的其他做法

**按会话恢复记住的宽度。** 否决：整屏动画就是这么来的。宽度是活着的铬偏好，不是按文件夹的内容。

**FileTree 继续按文件夹路径当 key。** 否决：新实例从空 map 起步，组件内的旧画保留根本跑不到。

**全局关掉网格缓动。** 否决：收起/展开对话和侧栏仍该缓动。只有切会话落稳和拖拽跳过。

## 后果

点进另一个项目的对话时，资源管理器栏和上一棵树留在屏上，直到新目录列出。聊天正文仍重挂。桌面端要加载重建后的 `ui-layout`、`ui-xmart-workbench` 的 `lib/`，闪才会消失。
