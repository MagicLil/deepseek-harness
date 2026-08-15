# Agent Note: 第一方 Vue 语言服务器

Status: implemented

[English](2026-08-15-first-party-vue-language-server.md) | 中文

## 问题

从 Open VSX 下载 Vue Official（`Vue.volar`）没有效果：编辑器是 AMD Monaco，不是 VS Code 扩展宿主。用户仍然需要 `.vue` 的诊断和补全，而且 Agent 已有的 `lsp` 工具也应当能对这类文件做 hover / definition / references / implementation。

## 决策

做第一方 `@vue/language-server` 主机。每个工作区一个常驻进程，编辑器和 `ctx.lsp` 共用。不激活 vsix。不替换 Monaco（D4）。不改 `ctx.lsp` 的四个操作。不抢占 `.ts` / `.tsx`。

## 形态

- L2 包 `packages/lsp/lsp-vue`（`@deepseek-ai/dsh-lsp-vue`）。
- 精简 JSON-RPC 连接，复用 `dsh-lsp-stdio` 的成帧，并捕获 `textDocument/publishDiagnostics`（通用连接会丢掉服务器通知）。
- `VueLspGateway` 在 `ctx.lsp` 上注册 `.vue` → `vue`，并发布 Remote 命名空间 `vueLsp`：`open` / `change` / `close` / `complete` / `diagnostics`。
- 桌面和 Web bundle 挂上 `lsp` + `lsp-vue` + `tool-lsp`。
- 工作台 `MonacoHost` 只在存在 `remote.vueLsp` 且文件是 `.vue` 时画标记、注册补全。组件看不到 `ctx`。
- 诊断不是 session 事件，也绝不会进入模型请求。

## 为什么不对 lsp-stdio 做 L3

`LspConnection.dispatch` 是私有的，会丢掉服务器通知。子类钩不到诊断。新包里写精简连接，避免改通用主机。

## 范围外

编辑器 hover / F12 / 重命名。TypeScript 语言服务。任意 VS Code 扩展。诊断进模型。

## 验证

- `pnpm exec vitest run packages/lsp/lsp-vue packages/client/ui-xmart-workbench/tests/monaco-host.client.spec.tsx packages/client/ui-xmart-workbench/tests/editor.client.spec.tsx packages/client/ui-xmart-workbench/tests/vue-lsp.client.spec.ts`
- 重启桌面端后打开 `.vue`；项目里有 Vue `tsconfig` 时应当出现波浪线和补全。
