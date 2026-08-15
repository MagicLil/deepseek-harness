# Agent Note: X-Mart 工作台资源管理器与编辑器

Status: implemented

[English](2026-08-15-xmart-workbench-explorer.md) | 中文

## 问题

Phase 1 交出的是空 Tab 条：`openFile` 一律打开隐藏的 `file` 占位，唯一可见内置页是演示。用户还是得离开对话才能浏览或编辑工作区文件，agent 写盘也不会刷新这一列里的任何东西。

## 决策

**资源管理器和编辑器就是普通的 `registerTab` 类型。** `explorer` 可见、`single`。只显示一棵树：右边当前对话所属的工作区（和 Git 同一套解析——先成员关系，再包含 cwd 的工作区，再不是已登记目录之父的 cwd，再最近，再第一个已登记路径）。轨上已经有文件夹的冷启动不必等 `session.cwd` 也有树。切对话就切树。`editor` / `image` / `binary` 隐藏，按 path 去重。`openFile` 匹配预览器（detect 先于扩展名，priority 降序）并路由到这些隐藏类型；旧的 `file` 占位只为 Phase 1 已持久化的标签保留。Tab 正文仍然只收到 `{ tab, visible, sessionId }` 加上 `apply` 闭包的回调，从不看见 `ctx`。

**文件界面状态是第二个持久化 store。** 展开目录和脏草稿在 `dsh.xmart.workbench.files`。reload token 和资源管理器刷新计数是瞬时的。Monaco 与 `ui-editor` 一样从 `/monaco/vs` 加载；本包复制树和宿主，而不是 import `ui-editor`（跨 UI 插件禁止 value import）。Markdown 预览用原语里的 `MarkdownText`。在 host 字节 RPC 落地之前，图片/二进制 tab 是带系统打开按钮的占位。

**D7 听会话事件，不自己做文件 watcher。** `conversationEvents.register` 看 tool-call 的 locations；更新的 seq 会推高树刷新和按路径的 reload token，打开的编辑器可以出重新加载条。重命名/删除菜单行保持禁用，因为 workspaces remote 没有这些方法。对话里点路径仍走 `workspaces.openPath`（系统应用）；拦截需要 `ui-conversation` 上的缝。

## 曾考虑的替代方案

**从 `ui-editor` import FileTree/Monaco。** 否决：client UI 插件不能互相 value-import。副本留在本包。

**这一刀就补 FS 重命名/删除和 `readFileBytes`。** 否决：那些是 host remote（L3）。资源管理器菜单和图片 tab 在产品里降级，而不是自开 HTTP 路由。

**现在就把聊天文件卡片开到工作台。** 否决：`ui-conversation` 写死调用 `workspaces.openPath`。`chatFileOpener` 缝是后续 L3 补丁，落地时再记账。

**工作台 Monaco 宿主上 Shiki。** v1 否决：从路径推 language id 够用；若编辑器退役阶段要对齐再补。

**把已登记的每个文件夹都堆进同一个资源管理器。** 否决：最右列是项目切换器。把 `bagu` / `Magiccode` / `hmdp` 倒进一栏会把不相干的树串在一起。一个会话，一棵树。

## 后果

只要当前会话有目录（cwd 或已登记工作区），就可以从 `+` 打开资源管理器、浏览那一棵树、新建文件/文件夹、把路径 @ 进输入框，并同时打开多个编辑器标签。保存走 `ctx.workspaces`。Agent 文件工具会刷新树，并给打开的编辑器出提示条。图片和二进制路径打开占位 tab。Git 和资源管理器共用同一个会话目录。`conversation.view` 与 `agent-loop` 保持不动。
