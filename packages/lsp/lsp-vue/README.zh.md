# @deepseek-ai/dsh-lsp-vue

[English](README.md) | 中文

X-Mart 的第一方 Vue 语言服务器主机。一个插件实例为每个工作区拉起**一个常驻的 `@vue/language-server` 进程**，并在 AMD Monaco 编辑器（诊断与补全）和现有的 `ctx.lsp` 缝（仅对 `.vue` 提供 hover / definition / references / implementation）之间共享它。

它**不会**激活 VS Code 扩展、替换 Monaco，也不会改 `ctx.lsp` 的四个操作。`.ts` / `.tsx` / `.js` 由 [`dsh-lsp-languages`](../lsp-languages/README.md) 认领。

默认导出插件（`VueLspGateway`）。它注入 `lsp`、`fs` 和 `subprocess`，注册 `vue` 提供方，并发布 `vueLsp` Remote 命名空间（`open` / `change` / `close` / `complete` / `diagnostics` / `definition` / `hover` / `references` / `implementation` / `warmup`）。Client 包通过 [`api-remotes`](../../api/remotes/README.md) 组合消费这些 Remote。不新增 HTTP 路由或 WebSocket。

## 功能

- 首次使用时解析本包自带的 `@vue/language-server` 入口和 `typescript/lib`。子进程不走 shell：主机 Node 二进制（Electron 下是 `DSH_NODE_EXEC_PATH`，否则是 `process.execPath`）加上 `--stdio` 和 `--tsdk`。
- 用 `typescript.tsdk` 做 initialize，让服务器加载本包的 TypeScript，而不是 `PATH` 上碰巧有的那份。
- 编辑器缓冲区保持打开（`didOpen` / 全文 `didChange` / `didClose`）并维护版本。Agent 查询会复用已经打开的文档；否则像 `dsh-lsp-stdio` 一样临时打开。
- 在 JSON-RPC 连接上捕获 `textDocument/publishDiagnostics`（通用 stdio 主机会忽略服务器通知）。诊断**不是** session 事件，也绝不会进入模型请求。
- 用静态配置回答 `workspace/configuration`，接受生命周期记账请求，并拒绝 `workspace/applyEdit`。

## 模型体验

间接，通过 `dsh-tool-lsp`：它把本提供方对 `.vue` 的规范化结果暴露给模型；本主机自己不贡献提示词或 schema。编辑器 Remote 不对模型可见。

#### KV Cache 影响

编辑器路径无影响。Agent 结果遵循 `dsh-tool-lsp`。

## 已知限制与暂缓事项

- **没有 Vue `tsconfig` 时结果会变弱** —— 这是语言服务器的限制，不是主机的 bug。
- **编辑器重命名仍不做** —— hover、F12 和查找引用已接到编辑器 Remote；重命名没有。
- **这里没有 `.ts` / `.tsx` 语言服务** —— 那些键属于 [`dsh-lsp-languages`](../lsp-languages/README.md)。
- **任意 VS Code 扩展仍然不会运行。**
