# @deepseek-ai/dsh-client-ui-xmart-marketplace

[English](README.md) | 中文

X-Mart 市场侧栏。`apply` 向 `ctx.xmartWorkbench` 注册两个活动项 —— `plugins`（顺序 30）和 `extensions`（顺序 40）—— 活动栏在 Git / 任务下方多出两个图标。每个侧栏都是搜索框加上「已安装 / 推荐」分组。组件看不到 `ctx`；Host RPC 在 `apply` 里闭包，再作为回调注入。

**插件**走 `remote.marketplace`，装进当前正在运行的 DSH profile（Host 上执行 `pnpm add`）。安装成功后提示重启桌面端。需要 webserver 或 WebSocket 的插件会标成不支持，确认按钮保持禁用。

**扩展**搜索 Open VSX，把 `.vsix` 下载到 `~/.dsh/extensions`。它们**不会被激活**。卡片如实显示兼容性标签。Remote SSH、Dev Containers、WSL、VS Code 语言包以及 Cursor 专用 id 不能安装。

设置 → 插件列表仍然只读。本包不新增 HTTP 路由。

## 模型体验

无。市场属于浏览器界面；这里没有任何内容进入模型请求。

#### KV Cache 影响

无；本包既不组装也不发送提供方请求。

## 已知限制与暂缓事项

- **VS Code 扩展不会运行** —— 下载只是落盘，要等扩展宿主 spike 过关。
- **插件安装不会热加载** —— Host 写完 profile 后要求重启。
- **pnpm 日志在子进程退出后才到** —— 侧栏还没有实时流。
