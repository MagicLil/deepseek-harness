# @deepseek-ai/dsh-client-ui-xmart-workbench

[English](README.md) | 中文

X-Mart 工作台插件：填充框架声明的 `menuBar`、`activityBar`、`primarySidebar`、`workbench`、`bottomPanel` 槽，做成 Cursor 式整壳。产品应用菜单是「文件 / 编辑 / 转到 / 视图 / 终端 / 帮助」（新会话、打开工作区、保存、关闭编辑器、设置、查找、替换、在文件中查找、转到文件 / 行 / 定义 / 实现 / 引用、资源管理器 / 搜索 / Git、侧栏与终端）。桌面把同一套 HTML `menuBar` 画进 32px 标题轨道（下拉走 portal，避免被轨道裁掉）；快捷键仍走 Electron 应用菜单。文件 → 设置派发 `dsh:open-settings`；文件 → 保存派发 `dsh:workbench-save`；编辑 → 查找 / 替换派发 `dsh:workbench-find` / `dsh:workbench-replace` 给当前编辑器。编辑 → 在文件中查找（Ctrl+Shift+F）与视图 → 搜索会把左侧边栏切到搜索面板，并派发 `dsh:workbench-search` 让输入框聚焦。转到 → 文件派发 `dsh:workbench-quick-open`；转到 → 行 / 定义 / 实现 / 引用 / 悬停派发 `dsh:workbench-editor-action`。活动栏切换左侧边栏里的资源管理器 / 搜索 / Git（再点当前图标会收起该列）。Git 图标用绿色泡泡显示暂存 + 更改的合计；源代码管理分区标题右侧也是同样的计数。设置入口仍在最右侧会话栏。`WorkbenchColumn` 占用中间编辑器轨道，只放文件 Tab；该轨道保持挂载。左侧边栏占用方把开/关状态以及最后一次非零宽度按会话记入 `dsh.xmart.workbench`（默认打开，260px）。活动项记在按会话隔离的 tab 持久化里（`dsh.xmart.workbench.tabs.<sessionId>.activity`）。布局 store 本身保持瞬时，不持久化。

`apply` 提供 `ctx.xmartWorkbench`，并叠一层 `theme.overrideTokens`，把 DeepSeek 蓝铬强调色（选中页签、发送按钮、焦点环）以及对话列 `Xmarting...` 闪动仍直接绑定的静态档，改成万物智汇绿 `#5BB73B`。画布、侧栏、顶栏、选中行洗底和气泡改成真中性色（`#181818` / `#F5F5F5` 一族）。Markdown 链接停在正文色（`label-primary`），不用绿强调色。成功 / 失败 / 警告色不动。桌面上 `apply` 还会把已解析的浅/深方案推给 `window.__DSH_IPC__.setTitleBarOverlay`，让 Windows 系统按钮跟着外观走。其他 client 插件通过 `registerTab` / `registerFileViewer` / `registerActivity` 注册 tab 类型、文件预览器和活动栏入口（每次调用返回供 fiber 使用的 disposer）。内置活动项是 `explorer`、`search`、`git`；市场插件再往上加。持久化里未知的 activity id 会显示成资源管理器。`openTab` / `closeTab` / `activateTab` / `openFile` / `setActivity` 改写按会话持久化的 tab 列表。同一项目文件夹里切换对话（包括新建空白会话）会继承上一会话的编辑器标签、活动项、资源管理器展开状态和左侧栏宽度（终端标签不跟走）；换到别的文件夹则用那一侧自己的持久化。设置 → 工作台为每个已注册类型提供一行开关（`dsh.xmart.workbench.prefs`）：关闭后该类型从 `+` 菜单消失，新的 `openTab` 会被拒绝；已经打开的标签保留。已打开但类型未注册的标签渲染占位卡（写明类型 id，并带一个「关闭标签」按钮，不用等插件回来就能收拾干净）。

资源管理器每一行和中间编辑器 Tab 使用完整的 [Material Icon Theme](https://github.com/material-extensions/vscode-material-icon-theme)（精确文件名、复合扩展名、`src` / `.github` 这类特殊文件夹）。对照表和 SVG 生成进 `icon-theme-data.ts` 并打进 client 包，因为插件服务器只提供 `client.js`。

内置壳类型对 `+` 隐藏：`explorer`（懒加载树，只显示当前会话那个目录，解析规则与 Git 相同；标题行右侧刷新图标会重新读磁盘，新建文件/文件夹在行右键菜单里）、`git`（Cursor 式源代码管理：文件名 + 淡目录行、绿色计数泡泡标在「暂存的更改 / 更改」右侧和活动栏 Git 图标上、悬停暂存/取消暂存/还原、分区全部暂存/全部还原、点击打开 unified 差异、提交前清单会生成本轮改动摘要、按脏文件推荐 `package.json` 门禁并展示命令/状态，用户勾选确认后才能创建提交，失败项可一键交给当前会话 Agent；闪光按钮向宿主要一条辅助提交说明，本地会先填一条 `type: 中文` 草稿；切/建分支、用户点击同步（fetch / ff-only pull / push）、带作者名、不显示短哈希的彩色提交图；点一行打开该次提交的按文件差异，引用标签仍负责切换或分离 HEAD；会话 cwd 本身不是仓库时，会探测一层子目录；差异标签会带上当前选中的仓库根，避免对父目录跑 git），以及 `terminal`（通过 `host.terminal*` 的按行主机 PTY；每个会话最多 6 个；收起底栏不会杀掉 PTY）。底栏还挂单例 **问题** 与 **检查** Tab（视图 → 问题 / 检查）：问题汇总已打开编辑器的 LSP 标记与最近一次检查解析；检查从根 `package.json` 约定探测 `typecheck` / `lint` / `test` / `build`，经 `remote.workspaceChecks` 跑命令并展示完整 argv，支持只跑 Git 脏文件相关项，最近日志写入 `localStorage`，会话 `running` 结束后可自动重跑失败项，失败行可交给 Agent。`search` 活动项是 Cursor 式全局文本搜索，作用于当前会话目录，背后是 `host.search`（打包自带的 ripgrep 二进制——和 agent 的 grep 工具同一个）：输入防抖 250ms（回车立即搜索），开关覆盖区分大小写 / 全字匹配 / 正则，省略号一行展开要包含 / 要排除的 glob，结果按文件分组并高亮命中片段，点一行在编辑器里打开并定位到该行。结果有上限（默认 500），被截断时会明说；查询和结果按会话留在内存里，切活动栏再回来还在。`+` 里仍可见的是 `demo`。隐藏的文件 tab：`editor`（Monaco + Shiki、草稿、Ctrl/Cmd+S、Ctrl+F/H 查找、Ctrl+P 打开文件、Ctrl+G 转到行、F12 / Ctrl+点击跳转定义、Ctrl+F12 转到实现、悬停文档、Shift+F12 查找引用，适用于 `.java` / `.ts` / `.js` / `.vue`；打开项目文件夹时就会预热语言服务，不必等打开第一个源文件；Markdown 预览；Gradle / ignore / `.npmrc` / `.prettierrc` / `.env*` 按文件名选语法）、`diff`（`host.gitDiff` 的 unified 文本，增删行用编辑器同一套 Shiki 上色，红绿只铺底）、`image` 与 `binary`（占位 + 系统打开），以及给旧持久化记录用的 `file` 占位。`openFile` 按 priority 降序、detect 先于扩展名匹配预览器，并打开 `editor` / `image` / `binary`（按 path 去重）。预览器：`binary-download`（NUL 嗅探）、`image`、`markdown`，以及兜底 `code`。资源管理器/编辑器的草稿和展开目录持久化在 `dsh.xmart.workbench.files`。Agent 文件工具事件会推高刷新计数和按路径的 reload token（D7），Git 面板也会跟着刷新。两个 bundle patch 都禁用了 `ui-editor`，对话视图环回到「对话 + 轨迹」。

Git 仓库选择器会探测每个已注册 Workspace 路径，并在 Workspace 注册表变化时更新。当前会话仓库保持选中，新出现的有效仓库会进入同一个选择器；同一仓库内的多个 Workspace 路径会按 `host.gitStatus` 返回的规范仓库根去重。

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
- **差异是 unified 文本** — 不是 Monaco DiffEditor 双栏。Git 同步只接受用户点击（fetch、`--ff-only` pull、push），不 force-push，也不写 `user.name` / `user.email`。Git 面板创建提交同样不会 push、不会改 Git 身份：提交前清单要求用户确认。提交图跟当前 HEAD（不是 `git log --all`），细轨加四分之一圆的合并弯角画在共享列里，合并提交是双圆、其余是实心圆，另一边父提交很远时只画短 hook；点一行走 `host.gitDiff` 的 `commit`（first-parent patch）。远程/标签药丸仍可以分离 HEAD。它不是完整 Git Graph 扩展（没有章鱼布局或交互式 rebase）。对话输入框上方的 Cursor 式 **审查条**（`agentReview` Host Remote）按回合列出 Agent `write`/`edit` 影子，以及不透明子代理（`cursor_agent` / `subagent*`）经 git status 差导入的文件，支持保留/撤销且不自动暂存。闪光按钮走 `host.gitSuggestCommit`；提示词由宿主组装，并记 `session/git-commit-llm-request`。输入框会先填一条本地 conventional-commit 草稿（`feat`/`fix`/`chore` + 中文说明）。
- **描述符上没有 badge、urlTarget 和插件自有设置行** — v1 只保留启用开关。
- **启用表和文件界面状态在 localStorage，不走 `settingsScope`** — 不会跨设备同步。
- **布局偏好在占用方恢复之前是瞬时的** — 整页重新加载会把布局 store 中的左侧边栏宽度重置为默认打开尺寸；占用方在挂载后按会话持久化记录重新应用。
- **让步可能隐藏仍为打开的偏好** — 窄视口可能把左侧边栏轨道推导为零宽度而不清除已存储的偏好；窗口变宽后会恢复。
