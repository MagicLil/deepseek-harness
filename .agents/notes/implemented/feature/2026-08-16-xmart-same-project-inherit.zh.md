# Agent Note：本项目切换对话保持工作台

Status: implemented

[English](2026-08-16-xmart-same-project-inherit.md) | 中文

## 问题

工作台标签、资源管理器展开和左侧栏宽度都按 `sessionId` 持久化。在同一工作区文件夹里点另一条对话（或在那里新建空白会话）会恢复那条对话自己的空/旧界面，正在看的资源管理器和编辑器就跳了。只有点到另一个文件夹的对话，才该换项目上下文。

## 决策

`apply` 订阅 `ctx.sessions.list`。`current` 在共享同一项目键（工作区文件夹路径，否则 cwd）的两条会话之间移动时，`inheritSession` 覆盖目标的编辑器标签和活动项，`cloneExpanded` 覆盖其资源管理器展开，`inheritWorkbenchPersist` 拷贝开关/宽度并写进 `ctx.layout`。终端标签留在源会话，因为 PTY 绑在那条会话上。工作台铬是 `session-maybe`，切换时不再重挂（[闪屏修复](../bug-fix/2026-08-17-same-project-session-switch-flash.md)）；`keepLiveWidth` 仍跳过持久化恢复，宽度不会弹回目标默认值。换到别的文件夹仍加载那一侧自己的持久化。

按会话的键（`dsh.xmart.workbench.tabs.<sessionId>`、`dsh.xmart.workbench.files`、`dsh.xmart.workbench`）仍按 [标签注册表](2026-08-15-xmart-workbench-tabs.md) 那样存；同文件夹导航是拷进这些键，而不是把 store 升成工作区范围。

## 考虑过的替代

**只继承空白的新会话。** 否决：同一文件夹里点已有对话（`deepseek` →「你是谁」/「介绍这个项目」）编辑器还是会跳。

**改成工作区范围持久化，不再按会话存。** 否决：D6 要会话隔离；切换时拷贝能保住磁盘形态，另一个文件夹仍能恢复自己的界面。

**目标已经有标签就不动。** 否决：用户看到的就是这次跳变。同文件夹导航必须显示正在看的编辑器，而不是目标对话上次存下来的标签。

**把 `primarySidebar` 改成 `session-maybe` 避免重挂。** 当时只为宽度弹跳否决。后来的 [闪屏修复](../bug-fix/2026-08-17-same-project-session-switch-flash.md) 在 `session-maybe` 切换不再重挂之后做了这件事；persist 拷贝和 `keepLiveWidth` 仍在。

## 后果

同文件夹里点对话或新建会话，会留下已打开的文件、活动项、资源管理器展开和侧栏宽度。换到另一个工作区文件夹仍会跳。终端标签不跟走。覆盖会把源界面写进目标的持久化键，以后再回到那条对话，看到的是拷过去的标签，除非用户又改过。
