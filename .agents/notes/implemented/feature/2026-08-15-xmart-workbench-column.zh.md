# Agent Note: X-Mart 工作台列

Status: implemented

[English](2026-08-15-xmart-workbench-column.md) | 中文

## 问题

现有应用内编辑器占用会话 `conversation.view` 环中的一个 tab，用户无法同时阅读对话和编辑文件。社区里用 HTTP 路由和页面 WebSocket 解决该布局的工作台无法在桌面端运行，因为桌面 shell 只把 `/api/*` 桥到 IPC，没有 webserver 升级路径。产品仍然需要对话旁的第一方工作台，但第一刀必须先定布局、传输和 host 接缝，再落地编辑器、Git 或终端 UI。

## 决策

**外壳增加第四列 `workbench`。** `ui-layout` 声明一个会话作用域的 `workbench` slot，并求解 `sidebar | center | details | workbench`。详情栏仍是工具检查面板。侧边栏永不让步；让步链先收缩详情栏、自动关闭详情栏、再收缩工作台、自动关闭工作台，最后由中栏吸收剩余缺口。详情栏与工作台都可以推导到宽度 0，且不改写已存储的偏好。几何常量为 `WORKBENCH_MIN=320`、`WORKBENCH_MAX=720`、`WORKBENCH_DEFAULT=400`。

**由 `@deepseek-ai/dsh-client-ui-xmart-workbench` 持有占用方。** 插件 id `ui-xmart-workbench` 同时挂进 web-app 与 desktop-app 的 bundle patch。`WorkbenchColumn` 填充 `workbench`；`WorkbenchToggle` 填充 `shell.overlay`。新会话默认关闭。右缘浮层控件负责打开该列。占用方把开/关状态和最后一次非零宽度按会话记入 `dsh.xmart.workbench`；布局 store 保持瞬时，不持久化。切换会话会关闭详情栏，并留下工作台偏好供占用方恢复。现有 `ui-editor` tab 保持不变。

**后续阶段复用既有 host 接缝，不新增传输。** 会话流式仍走 `events.mux`。转发的 host/cordis 事件仍走 `events.host`。桌面端已经通过 IPC SSE（`IpcApiClient`）投递这些事件；Phase 4 的终端输出会新增一条 host 事件并列入 `API_REMOTE_FORWARDED_EVENTS`，而不是页面 WebSocket。`gitStatus` 已经位于 `packages/host/apiproxy`（`git-status.ts` → `host.gitStatus` → `ctx.workspaces.gitStatus`）；Phase 3 扩展 `host.git*` 与 workspaces，并且不增加 push/pull/fetch。`ctx.terminals` 仍是 exact-Agent 所有权；v1 UI 终端以会话 Agent 为 owner。Agent 写盘已经以 `tool/call` 和 `tool/result` 到达，工具名为 `write` / `edit` / `str_replace_editor`，参数 JSON 含 `file_path` 或 `path`——Phase 2 监听这些事件，不发明新的会话事件。

## 曾考虑的替代方案

**复用现有 `details` 列。** 不采用：详情栏已经负责工具调用检查。共用一条轨道会把两件无关的事压到同一个宽度偏好和同一个关闭手势上。

**直接安装或内置 DSH-better-sidebar。** 不采用：该插件的 host 半侧依赖 HTTP sidebar 路由和终端 WebSocket。桌面端两者都没有，而且复制另一套仓库的依赖栈会与本仓库的插件、RPC 和覆盖率规则冲突。

**把工作台几何持久化进布局 store。** 不采用：布局 store 按约定是瞬时查看偏好。会话记忆属于工作台占用方，这样重新加载可以恢复某一个会话，而不必让每一栏都变成持久状态。

**新会话默认打开工作台。** 不采用：已确认的 Phase 0 骨架保持关闭，只通过浮层控件打开，避免空栏在还没有内容时抢走对话宽度。

**把工作台放进 `conversation.view`。** 不采用：该环是互斥的。工作台存在的意义就是让对话和工具同时留在屏幕上。

**为终端输出新开 WebSocket。** 不采用：桌面端无法升级页面，且连接层已经通过 IPC SSE 转发 host 事件。

**在 Phase 0 引入 `UiOwner` 终端类型。** 不采用：为时尚早。v1 可以通过会话 Agent 持有 UI 终端；只有当 exact-Agent 规则真正挡住产品时，才再增加独立 owner 类型。

**把 Git 动词加到 Typert remotes。** 不采用：`gitStatus` 已经走 apiproxy / workspaces 路径。Phase 3 扩展这条接缝，而不是再立第二套 Git 表面。

## 后果

本笔记里的列位置已被 [Cursor 式整壳](2026-08-15-xmart-cursor-shell.md) 取代：`workbench` 是中间编辑器轨道，资源管理器 / Git / 任务在 `primarySidebar`。本笔记中的 host 接缝选择仍然成立。让步可以在窄视口隐藏仍为打开的左侧偏好，并在窗口变宽时恢复。后续阶段在本包和既有 host 接缝内加入文件、Git 与终端；不再重开「HTTP 还是 IPC」的选择。`conversation.view` 与 `agent-loop` 保持不动。
