# @deepseek-ai/dsh-client-ui-xmart-workbench

[English](README.md) | 中文

X-Mart 工作台插件：填充框架声明的 `menuBar`、`activityBar`、`primarySidebar`、`workbench`、`bottomPanel` 槽，做成 Cursor 式整壳。产品应用菜单是「文件 / 编辑 / 视图 / 终端 / 帮助」（新会话、打开工作区、保存、关闭编辑器、设置、资源管理器 / Git / 任务、侧栏与终端）。桌面把这一行装成 Electron 应用菜单；HTML `menuBar` 只给 web。文件 → 设置派发 `dsh:open-settings`；文件 → 保存派发 `dsh:workbench-save` 给当前编辑器。活动栏切换左侧边栏里的资源管理器 / Git / 任务（再点当前图标会收起该列）。设置入口仍在最右侧会话栏。`WorkbenchColumn` 占用中间编辑器轨道，只放文件 Tab；该轨道保持挂载。左侧边栏占用方把开/关状态以及最后一次非零宽度按会话记入 `dsh.xmart.workbench`（默认打开，260px）。活动项记在按会话隔离的 tab 持久化里（`dsh.xmart.workbench.tabs.<sessionId>.activity`）。布局 store 本身保持瞬时，不持久化。

`apply` 提供 `ctx.xmartWorkbench`。其他 client 插件通过 `registerTab` / `registerFileViewer` / `registerActivity` 注册 tab 类型、文件预览器和活动栏入口（每次调用返回供 fiber 使用的 disposer）。内置活动项是 `explorer`、`git`、`tasks`；市场插件再往上加。持久化里未知的 activity id 会显示成资源管理器。`openTab` / `closeTab` / `activateTab` / `openFile` / `setActivity` 改写按会话持久化的 tab 列表。设置 → 工作台为每个已注册类型提供一行开关（`dsh.xmart.workbench.prefs`）：关闭后该类型从 `+` 菜单消失，新的 `openTab` 会被拒绝；已经打开的标签保留。已打开但类型未注册的标签渲染占位卡。

内置壳类型对 `+` 隐藏：`explorer`（懒加载树，只显示当前会话那个目录，解析规则与 Git 相同；标题行右侧刷新图标会重新读磁盘，新建文件/文件夹在行右键菜单里）、`git`（Cursor 式源代码管理：文件名 + 淡目录行、悬停暂存/取消暂存/还原、分区全部暂存/全部还原、点击打开 unified 差异、有暂存才能提交、闪光按钮向宿主要一条辅助提交说明、切/建分支、用户点击同步（fetch / ff-only pull / push）、带作者名、不显示短哈希的彩色提交图；点一行打开该次提交的按文件差异，引用标签仍负责切换或分离 HEAD；会话 cwd 本身不是仓库时，会探测一层子目录）、`tasks`（当前回合、会话作业与子代理），以及 `terminal`（通过 `host.terminal*` 的按行主机 PTY；每个会话最多 3 个；收起底栏不会杀掉 PTY）。`+` 里仍可见的是 `demo`。隐藏的文件 tab：`editor`（Monaco、草稿、Ctrl/Cmd+S、Markdown 预览）、`diff`（`host.gitDiff` 的 unified 文本）、`image` 与 `binary`（占位 + 系统打开），以及给旧持久化记录用的 `file` 占位。`openFile` 按 priority 降序、detect 先于扩展名匹配预览器，并打开 `editor` / `image` / `binary`（按 path 去重）。预览器：`binary-download`（NUL 嗅探）、`image`、`markdown`，以及兜底 `code`。资源管理器/编辑器的草稿和展开目录持久化在 `dsh.xmart.workbench.files`。Agent 文件工具事件会推高刷新计数和按路径的 reload token（D7），Git 面板也会跟着刷新。两个 bundle patch 都禁用了 `ui-editor`，对话视图环回到「对话 + 轨迹」。

壳槽由 ui-layout 声明，`settings.section` 由 ui-settings-general 声明，因此 `apply` 使用 `slots.inject()` 在声明生命周期内完成注册，并在目标 slot 的声明恢复后重新注册。

## 模型体验

无。工作台属于浏览器界面；这里没有任何内容进入模型请求。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

## 已知限制与暂缓事项

- **重命名和删除不可用** — workspaces remote 还没有文件系统重命名/删除；资源管理器菜单里这两行是禁用的。
- **对话里点路径仍走系统打开** — 拦截会话卡片上的 `workspaces.openPath` 需要改 `ui-conversation` 的宿主缝。资源管理器右键仍保留「用系统应用打开」。
- **图片 tab 是占位** — 栏内预览需要 host 的 `readFileBytes` RPC；当前只显示路径和系统打开按钮。
- **终端是按行发送** — 回车发一行并等到空闲。验收标准是 Python REPL；全屏 TUI（vim/htop）不在范围内。会话 agent 没有 `ctx.terminals` 时显示不可用说明，而不是假装有个壳。
- **后台作业仍没有实时输出或终止** — 这些动词还不在 client sessions 面上。当前回合可以用 `session.cancel` 停。子代理的停止/打开走 `ctx.sessions`。
- **差异是 unified 文本** — 不是 Monaco DiffEditor 双栏。Git 同步只接受用户点击（fetch、`--ff-only` pull、push），不 force-push，也不写 `user.name` / `user.email`。提交图会画合并线和引用标签；点一行走 `host.gitDiff` 的 `commit`（first-parent patch）。远程/标签药丸仍可以分离 HEAD。它不是完整 Git Graph 扩展（没有章鱼布局或交互式 rebase）。没有 Agent Review 栏。闪光按钮走 `host.gitSuggestCommit`；提示词由宿主组装，并记 `session/git-commit-llm-request`。
- **描述符上没有 badge、urlTarget 和插件自有设置行** — v1 只保留启用开关。
- **启用表和文件界面状态在 localStorage，不走 `settingsScope`** — 不会跨设备同步。
- **布局偏好在占用方恢复之前是瞬时的** — 整页重新加载会把布局 store 中的左侧边栏宽度重置为默认打开尺寸；占用方在挂载后按会话持久化记录重新应用。
- **让步可能隐藏仍为打开的偏好** — 窄视口可能把左侧边栏轨道推导为零宽度而不清除已存储的偏好；窗口变宽后会恢复。
