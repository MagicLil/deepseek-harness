# @deepseek-ai/dsh-lsp-languages

[English](README.md) | 中文

X-Mart 的第一方 TypeScript 与 Java 语言服务器主机。一个插件为每个工作区挂上**两个**常驻进程——`typescript-language-server` 和 Eclipse JDT LS——并在 AMD Monaco 编辑器（诊断与补全）和现有的 `ctx.lsp` 缝之间共享它们。

它**不会**激活 VS Code 扩展、替换 Monaco，也不会改 `ctx.lsp` 的四个操作。它**不**认领 `.vue`（由 [`dsh-lsp-vue`](../lsp-vue/README.md) 所有）或 `.xml`。

默认导出插件（`apply`）。它再挂上 `TsLspGateway` 和 `JavaLspGateway`；二者注入 `lsp`、`fs` 和 `subprocess`，注册 `typescript` 与 `java` 提供方，并发布 `tsLsp` / `javaLsp` Remote 命名空间（`open` / `change` / `close` / `complete` / `diagnostics`）。Client 包通过 [`api-remotes`](../../api/remotes/README.md) 组合消费这些 Remote。不新增 HTTP 路由或 WebSocket。

## 功能

- **TypeScript / JavaScript** —— 首次使用时解析本包自带的 `typescript-language-server` 入口和 `typescript/lib`。子进程不走 shell：主机 Node 二进制（Electron 下是 `DSH_NODE_EXEC_PATH`，否则是 `process.execPath`）加上 `--stdio`。`initialize` 传入 `tsserver.path`，让服务器加载本包的 TypeScript。
- **Java** —— 从 `DSH_JDTLS_HOME` 或 `~/.dsh/language-servers/jdtls` 解析 Eclipse JDT Language Server 1.57.0。若目录不存在，首次使用会下载钉死的 milestone 压缩包（约 50MB）并解压。启动命令是 `JAVA_HOME/bin` 或 `PATH` 上的 `java`，加上 Equinox launcher jar、平台 `config_*`，以及 `~/.dsh/jdtls-data/` 下按工作区区分的 `-data` 目录。
- 编辑器缓冲区保持打开（`didOpen` / 全文 `didChange` / `didClose`）并维护版本。Agent 查询会复用已经打开的文档；否则像 `dsh-lsp-stdio` 一样临时打开。
- 在 JSON-RPC 连接上捕获 `textDocument/publishDiagnostics`（通用 stdio 主机会忽略服务器通知）。诊断**不是** session 事件，也绝不会进入模型请求。
- 用静态配置回答 `workspace/configuration`，接受生命周期记账请求，并拒绝 `workspace/applyEdit`。

## 模型体验

间接，通过 `dsh-tool-lsp`：它把这些提供方对 `.ts` / `.js` / `.java` 的规范化结果暴露给模型；本主机自己不贡献提示词或 schema。编辑器 Remote 不对模型可见。

#### KV Cache 影响

编辑器路径无影响。Agent 结果遵循 `dsh-tool-lsp`。

## 已知限制与暂缓事项

- **没有项目 `tsconfig` 时 TypeScript 结果会变弱** —— 这是语言服务器的限制，不是主机的 bug。
- **没有 Lombok 和 Maven/Gradle 导入时 Java 诊断会很吵** —— v1 不挂 Lombok agent。若你已经有一份准备好的 JDT LS 树，设 `DSH_JDTLS_HOME` 即可。
- **第一次打开 Java 文件可能下载约 50MB** —— 只需联网一次；之后复用 `~/.dsh/language-servers/jdtls`。
- **编辑器 hover、F12 和重命名不在 v1 范围** —— Agent 的 `lsp` 工具已经覆盖导航。
- **任意 VS Code 扩展仍然不会运行。**
