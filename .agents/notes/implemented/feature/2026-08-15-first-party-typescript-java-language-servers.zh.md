# Agent Note: 第一方 TypeScript 与 Java 语言服务器

Status: implemented

[English](2026-08-15-first-party-typescript-java-language-servers.md) | 中文

## 问题

工作台已经用第一方语言服务器接了 Vue。公司和 `D:\mycode` 的 MES/QMS 主栈是 Java 17 + Spring Boot + Vue/TypeScript。应用市场下的 `.vsix` 仍然不会跑（AMD Monaco，没有扩展主机）。用户需要 `.ts` / `.js` / `.java` 的诊断和补全，Agent 的 `lsp` 工具也要能查这些文件。

## 决策

两个主机放进同一个 L2 包，避免连接/会话/进程池被复制一份（jscpd）。不激活 vsix。不替换 Monaco（D4）。不改 `ctx.lsp` 的四个操作。不认领 `.vue` 或 `.xml`。

## 形状

- L2 包 `packages/lsp/lsp-languages`（`@deepseek-ai/dsh-lsp-languages`）。
- 两个 `TypertRemoteService` 类，一份 `./remote` 贡献，两个命名空间：`tsLsp` 和 `javaLsp`。各自暴露 `open` / `change` / `close` / `complete` / `diagnostics`。
- TypeScript：npm 上的 `typescript-language-server` + `typescript`，启动规则与 Vue 相同（Electron / `DSH_NODE_EXEC_PATH`）。
- Java：Eclipse JDT LS 1.57.0，从 `DSH_JDTLS_HOME` 或 `~/.dsh/language-servers/jdtls` 解析；首次使用下载钉死的 milestone 压缩包。不进 git。
- 桌面和 Web bundle 在 `lsp-vue` 后面挂上 `lsp-languages`。
- 工作台 `EditorTab`：`.vue` → `vueLsp`，TS/JS → `tsLsp`，`.java` → `javaLsp`。组件看不到 `ctx`。
- 诊断不是 session 事件，也绝不会进入模型请求。

## 为什么不是两个包

再复制一份精简 JSON-RPC 连接会撞 jscpd。一个包，两个网关。

## 范围外

编辑器 hover / F12 / 重命名。Lombok agent。MyBatis `.xml`。Python。任意 VS Code 扩展。诊断进模型。

## 验证

- `pnpm exec vitest run packages/lsp/lsp-languages --coverage.enabled --coverage.include=packages/lsp/lsp-languages/src/**`
- `pnpm exec vitest run packages/client/ui-xmart-workbench/tests/monaco-host.client.spec.tsx packages/client/ui-xmart-workbench/tests/editor.client.spec.tsx packages/client/ui-xmart-workbench/tests/editor-lsp.client.spec.ts packages/client/ui-xmart-workbench/tests/vue-lsp.client.spec.ts`
- 重新启动 `pnpm dsh desktop`。打开一个 `.ts`（有项目 `tsconfig` 更准）和一个 `.java`（第一次可能下载约 50MB 的 JDT LS）。
