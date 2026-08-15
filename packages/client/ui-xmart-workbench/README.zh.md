# @deepseek-ai/dsh-client-ui-xmart-workbench

[English](README.md) | 中文

X-Mart 工作台插件：填充框架声明的 `activityBar`、`primarySidebar`、`workbench`、`bottomPanel` 槽，做成 Cursor 式整壳。活动栏切换左侧边栏里的资源管理器 / Git / 任务（再点当前图标会收起该列），并开关编辑器正下方的终端占位。活动栏上的设置会点击现有的 `sidebar.settings` 触发器。`WorkbenchColumn` 占用中间编辑器轨道，只放文件 Tab；该轨道保持挂载。左侧边栏占用方把开/关状态以及最后一次非零宽度按会话记入 `dsh.xmart.workbench`（默认打开，260px）。活动项记在按会话隔离的 tab 持久化里（`dsh.xmart.workbench.tabs.<sessionId>.activity`）。布局 store 本身保持瞬时，不持久化。

`apply` 提供 `ctx.xmartWorkbench`。其他 client 插件通过 `registerTab` / `registerFileViewer` / `registerActivity` 注册 tab 类型、文件预览器和活动栏入口（每次调用返回供 fiber 使用的 disposer）。内置活动项是 `explorer`、`git`、`tasks`；市场插件再往上加。持久化里未知的 activity id 会显示成资源管理器。`openTab` / `closeTab` / `activateTab` / `openFile` / `setActivity` 改写按会话持久化的 tab 列表。设置 → 工作台为每个已注册类型提供一行开关（`dsh.xmart.workbench.prefs`）：关闭后该类型从 `+` 菜单消失，新的 `openTab` 会被拒绝；已经打开的标签保留。已打开但类型未注册的标签渲染占位卡。

内置壳类型对 `+` 隐藏：`explorer`（懒加载工作区树；会话有 cwd 时可用；标题行右侧刷新图标会重新读磁盘，新建文件/文件夹在行右键菜单里）、`git`（状态 / 暂存 / 提交 / 历史；会话 cwd 本身不是仓库时，会探测一层子目录）、`tasks`（当前回合、会话作业与子代理），以及 `terminal`（预留位——默认桌面包不挂 `ctx.terminals`）。`+` 里仍可见的是 `demo`。隐藏的文件 tab：`editor`（Monaco、草稿、Ctrl/Cmd+S、Markdown 预览）、`diff`（`host.gitDiff` 的 unified 文本）、`image` 与 `binary`（占位 + 系统打开），以及给旧持久化记录用的 `file` 占位。`openFile` 按 priority 降序、detect 先于扩展名匹配预览器，并打开 `editor` / `image` / `binary`（按 path 去重）。预览器：`binary-download`（NUL 嗅探）、`image`、`markdown`，以及兜底 `code`。资源管理器/编辑器的草稿和展开目录持久化在 `dsh.xmart.workbench.files`。Agent 文件工具事件会推高刷新计数和按路径的 reload token（D7），Git 面板也会跟着刷新。两个 bundle patch 都禁用了 `ui-editor`，对话视图环回到「对话 + 轨迹」。

壳槽由 ui-layout 声明，`settings.section` 由 ui-settings-general 声明，因此 `apply` 使用 `slots.inject()` 在声明生命周期内完成注册，并在目标 slot 的声明恢复后重新注册。

## 模型体验

无。工作台属于浏览器界面；这里没有任何内容进入模型请求。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

## 已知限制与暂缓事项

- **重命名和删除不可用** — workspaces remote 还没有文件系统重命名/删除；资源管理器菜单里这两行是禁用的。
- **对话里点路径仍走系统打开** — 拦截会话卡片上的 `workspaces.openPath` 需要改 `ui-conversation` 的宿主缝。资源管理器右键仍保留「用系统应用打开」。
- **图片 tab 是占位** — 栏内预览需要 host 的 `readFileBytes` RPC；当前只显示路径和系统打开按钮。
- **终端是预留底栏** — 交互式 PTY 需要主机终端 RPC，以及挂了 `ctx.terminals` 的安装包。面板会说明这一点，而不是假装有个壳。
- **后台作业仍没有实时输出或终止** — 这些动词还不在 client sessions 面上。当前回合可以用 `session.cancel` 停。子代理的停止/打开走 `ctx.sessions`。
- **差异是 unified 文本** — 不是 Monaco DiffEditor 双栏。Git 不做 push / pull / fetch，也绝不写 `user.name` / `user.email`。
- **描述符上没有 badge、urlTarget 和插件自有设置行** — v1 只保留启用开关。
- **启用表和文件界面状态在 localStorage，不走 `settingsScope`** — 不会跨设备同步。
- **布局偏好在占用方恢复之前是瞬时的** — 整页重新加载会把布局 store 中的左侧边栏宽度重置为默认打开尺寸；占用方在挂载后按会话持久化记录重新应用。
- **让步可能隐藏仍为打开的偏好** — 窄视口可能把左侧边栏轨道推导为零宽度而不清除已存储的偏好；窗口变宽后会恢复。
