# `@deepseek-ai/dsh-desktop-app`

[English](README.md) | 中文

dsh 桌面表层组合包。[`cordis.patch.yml`](cordis.patch.yml) 叠加在 [`dsh-base`](../base/README.md) 之上：coding persona、storage／workspace／api-gateway、钉死的原生目录选择器、浏览器客户端名录、`127.0.0.1:3080` 上的 loopback `webserver`，以及本包的 `desktop-runtime` 粘合插件。该运行时通过 `frontend-static` 提供前端 dist，并让 Electron 打开这个本机 URL，使社区 HTTP 插件与宿主同源。第一方 `/api` 仍可通过 preload IPC 桥。应用命令行由 [`src/startup.ts`](src/startup.ts) 经 `ctx.cmdlineArgs` 解析。

## 模型体验

当 `surfaceContext` 为 true 时，`app:desktop-surface` 提示词段落会把智能体写成万物智汇（X-Mart），并向模型说明这是本机 `http://127.0.0.1` 上的桌面窗口。桌面组合包同时设置 `includeHarnessIdentity: false`，避免固定的 DeepSeek Harness 开场白压过这层身份。

## 已知限制

- 前端 dist 必须已构建（`pnpm run build`）。
- 首次启动必须处于 Electron main（`dsh desktop` 会自动在 Electron 下重新执行）。
- 再次启动会聚焦已有窗口。窗口位置记在 `$DSH_HOME/desktop-window.json`。
- 会话日志导出走系统另存为；`http(s)` 链接用系统浏览器打开。
