# Agent Note: X-Mart 市场（插件 + 扩展）

Status: implemented

[English](2026-08-15-xmart-marketplace.md) | 中文

## 问题

工作台活动栏原先只有资源管理器 / Git / 任务。从 Cursor 过来的用户会找「扩展」侧栏，想装 Vue Official；本产品另外还有一套 DSH 插件生态。桌面端没有 webserver，不能照搬社区 HTTP 市场。编辑器是 AMD Monaco，下载 `.vsix` 也不会激活。

## 决策

**两个活动栏入口，两套 Host Remote，一条诚实规则。** `ui-xmart-workbench` 提供 `registerActivity`。新的 L2 client 包 `ui-xmart-marketplace` 注册 `plugins` 和 `extensions`。新的 L2 host 包 `host/marketplace` 通过 `api-remotes` 发布 `remote.marketplace`（桌面 IPC，不新增 HTTP 路由）。

- **插件**按 CLI 的 `pnpm add` / bundle 调和语义装进当前 profile。需要 HTTP/WebSocket 的插件会被拒绝。成功后必须重启。
- **扩展**只搜 Open VSX，把 `.vsix` 存到 `~/.dsh/extensions`，并打上兼容性标签。它们不会被激活。Remote SSH、Dev Containers、WSL、VS Code 语言包、Cursor 专用 id 标成 `unsupported`。

设置 → 插件列表仍然只读。

## 考虑过的替代

**做一张假装「已安装并在跑」的 Vue Official 卡片。** 否决：编辑器现在带不起它。

**照搬 dsh-market 的 HTTP 安装。** 否决：桌面端没有 webserver。

**导入本机 Cursor 扩展目录。** 否决：超出范围，还有许可证和兼容性噪音。

**Microsoft Marketplace。** 否决：许可证。

## 后果

活动栏能看到「插件 / 扩展」。插件安装对 desktop profile 是真的。扩展下载是真落盘。语言智能还要等扩展宿主门。
