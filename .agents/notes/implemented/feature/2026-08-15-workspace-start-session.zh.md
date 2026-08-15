# Agent Note: 新会话跟随工作区

Status: implemented

[English](2026-08-15-workspace-start-session.md) | 中文

## 问题

加文件夹只会出现在工作区列表里，当前对话和 Git 仍停在上一个会话的 cwd。顶栏 **新会话** 和项目行 **＋** 都走 `startSession`：它复用停着的空白会话，再 `open` 已经是当前的 id——空操作，所以点击看起来没反应。

## 决策

**已连接的空白会话就是当前会话时，`startSession` 再铸一条。** 可选 `{ preferExisting: true }` 只聚焦工作区、不新铸；若当前会话已属于该工作区则直接返回，这样展开/收起项目行不会跳到该工作区的空白会话。`{ forceNew: true }` 总是在目标工作区新铸一条——项目行 **＋** 用它，点别的项目不会变成复用空操作。

**`workspaces.create` 以 `preferExisting` 启动刚登记的工作区。** 新加的文件夹会打开（或复用）该项目的对话，Git 跟着它的路径走。工作区浏览器选择器的 `onPick` 只关对话框；那里再调一次 `startSession` 会多铸一条空白会话。点击项目行走 `preferExisting`；行内 **＋** 和侧栏 **新会话** 不传这个旗标。

## 曾考虑的替代方案

**保持只复用的 `startSession`，让侧栏自己传「强制新建」旗标。** 否决：所有新会话入口（侧栏、行 ＋、preset）共用 `IWorkspaces.startSession`。再铸必须放在这一个方法里，不能变成每个按钮的特例。

**给 Git 单独做工作区选择器。** 否决：Git 已经读当前会话 cwd。切会话就够了；再加一个真相源会和输入框脱节。

**`create` 之后仍让 `onPick` 调 `startSession`。** 否决：`create` 已经启动该工作区。第二次不带 `preferExisting` 的调用会给同一个文件夹再铸一条空白会话。

## 后果

添加文件夹会打开该项目的对话和 Git。**新会话** 和项目行 **＋** 总会给目标工作区再开一条对话。点击项目行会切换对话和 Git，不多铸。`connectWorkspace` 的复用规则和 `agent-loop` 保持不动。
