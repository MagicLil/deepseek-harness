# `@deepseek-ai/dsh-desktop-app`

[English](README.md) | 中文

dsh 桌面表层组合包。[`cordis.patch.yml`](cordis.patch.yml) 叠加在 [`dsh-base`](../base/README.md) 之上：coding persona、storage／workspace／api-gateway、钉死的原生目录选择器、浏览器客户端名录，以及本包的 `desktop-runtime` 粘合插件（**不**挂载 `webserver`）。该运行时通过 `dsh://` 协议打开 Electron，注入 `window.__DSH_BOOT__`，并以 IPC fetch 桥（`toFetchHandler`）承载 `/api`。应用命令行由 [`src/startup.ts`](src/startup.ts) 经 `ctx.cmdlineArgs` 解析。

## 模型体验

当 `surfaceContext` 为 true 时，`app:desktop-surface` 提示词段落会向模型说明这是桌面窗口（IPC，而非浏览器 URL）。

## 已知限制

- 前端 dist 必须已构建（`pnpm run build`）。
- 首次启动必须处于 Electron main（`dsh desktop` 会自动在 Electron 下重新执行）。
