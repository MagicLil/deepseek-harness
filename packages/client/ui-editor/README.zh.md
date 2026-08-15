# @deepseek-ai/dsh-client-ui-editor

[English](README.md) | 中文

应用内代码编辑器：在会话 `'conversation.view'` slot 环中注册一个 tab，左侧是工作区文件树，右侧是 Monaco 编辑器——与 VSCode 同一个编辑器内核。文件树以会话的 `cwd` 为根；层级通过 `ctx.workspaces.listEntries` 惰性加载，点击"刷新"重新拉取。打开文件时通过 `ctx.workspaces.readFile` 读取完整 UTF-8 内容；二进制（`file-binary`）、超限（`file-too-large`）与不可读目标显示占位提示而非编辑器。保存（工具栏按钮或编辑器内 Ctrl/Cmd-S）通过 `ctx.workspaces.writeFile` 整体写回，后写覆盖先写。声明的会话 store 保存当前打开文件、已展开目录与每个文件的未保存缓冲，因此切换视图 tab 再回来会恢复相同的编辑状态；脏文件在树中带圆点标记，工具栏状态位显示"未保存"。Monaco 每页只启动一次，从前端 dist 携带的 `/monaco/vs` AMD 资产加载（apps/web 的 `copyMonacoAssets`），两个 surface 走同一条代码路径：web 上是 HTTP，桌面上是 `dsh://` 协议。语法高亮走官方 [`@shikijs/monaco`](https://github.com/shikijs/shiki)（与 VS Code / Cursor 同一套 TextMate 语法），主题为 `one-dark-pro` / `min-light`。Markdown 文件带在线预览（编辑 / 分栏 / 预览），渲染器复用会话里的 `MarkdownText`。侧栏 Git 页列出 `git status` 变更，并在文件树上画 SCM 字母。该包不提供服务，也不声明 Context 合并。

## Model Experience

None, as the editor reads and writes workspace files in the browser; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **无外部变更检测** —— 缓冲区不监听磁盘文件；agent 工具或外部编辑器写入同一文件不会被察觉，直到重新打开为止，保存时后写覆盖先写，无冲突提示。
- **整文件传输且有 2 MiB 上限** —— 读写每次传输完整文档；超过 host 上限的文件拒绝打开而非流式加载，切换文件时撤销历史会重置。
- **无文件管理动词** —— 文件树只做列出与打开；文件与目录的创建/重命名/删除仍归模型工具或宿主操作系统。
- **Monaco 资产随前端 dist 分发** —— 编辑器内核从 `/monaco/vs` 加载；在 copyMonacoAssets 步骤之前构建的 dist 会显示内核加载失败态，重新构建前端即可。平台拒绝同源 worker 时，Monaco 回退到主线程语言服务。
