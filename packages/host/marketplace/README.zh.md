# @deepseek-ai/dsh-host-marketplace

[English](README.md) | 中文

X-Mart 市场侧栏的 Host Remote。`MarketplaceGateway` 注册 `marketplace` 服务，并发布八个由 Typert 生成的直接 Remote：DSH 插件的搜索 / 列表 / 安装 / 卸载，以及 Open VSX 扩展的搜索 / 列表 / 安装 / 卸载。

插件安装复用 CLI `dsh plugin add` 的语义：在当前正在运行的 profile 目录里执行 `pnpm add` / `pnpm remove`（Electron 下是 `desktop`，否则是 `DSH_PROFILE` 或 `web`），再调和 `dsh.profile.bundles`。除非调用方打开 `allowBuilds`，否则不跑生命周期脚本。需要 webserver 或 WebSocket 的插件在桌面端会被拒绝。插件变更成功后一律返回 `needsRestart: true` —— Host 不会热加载不可信代码。

扩展安装只走 [Open VSX](https://open-vsx.org/)（不用 Microsoft Marketplace）。下载的 `.vsix` 落到 `~/.dsh/extensions`，并写一份本地清单。它们**不会被激活**：编辑器仍是 AMD Monaco。卡片带兼容性标签（`pending-host`、`needs-node-host` 或 `unsupported`）。Remote SSH、Dev Containers、WSL、VS Code 语言包以及 Cursor 专用 id 属于 `unsupported`，不能安装。

该服务仅供 Remote 使用，不声明同进程 Cordis `Context` merge。Client 包通过 [`api-remotes`](../../api/remotes/README.md) 组合消费它。不新增 HTTP 路由。

## 模型体验

无，因为这个 Host 市场不注册提示词、工具、消息或提供方请求。

#### KV Cache 影响

无；本包从不组装模型输入。

## 已知限制与暂缓事项

- **pnpm 日志在子进程退出后一次性返回** —— 侧栏实时流式输出暂缓；任务结果里带合并后的 stdout/stderr。
- **下载的 vsix 不会运行** —— 激活取决于单独的扩展宿主决策（monaco-vscode-api spike）。在该门通过之前，语言支持走第一方 language pack，而不是「任意 VS Code 扩展都能跑」。
- **目录拉取失败时回落到打包快照** —— 在线目录不可用时仍显示精选行，而不是空侧栏。
- **不用 Microsoft Marketplace，也不导入本机 Cursor 扩展目录。**
