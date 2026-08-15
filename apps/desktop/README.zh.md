# `@deepseek-ai/dsh-desktop`

[English](README.md) | 中文

桌面 profile 的 Electron main/preload 外壳：`dsh://` 静态资源服务、通往 `toFetchHandler` 的 IPC fetch，以及让 Node CLI 在 Electron 下重新执行的 `relaunch`。

## Entry

- `dsh desktop` / `dsh --profile desktop` — CLI 发现当前不是 Electron 进程后调用 [`relaunch`](src/relaunch.ts)。
- 随后 Electron 运行 **已编译的** [`lib/electron-main.js`](lib/electron-main.js)（由 `pnpm run build:lib` 构建）。Electron 不能使用 `tsx` —— 其 Node ABI 无法加载 tsx 的原生 esbuild 二进制。
- [`shell`](src/shell.ts) 在 `apiProxy` 与 `clientModules` 就绪后打开窗口。

## Preload

[`preload.mjs`](preload.mjs) 以纯 ESM 入库，因此 Electron 无需先做 TypeScript 构建即可加载。它暴露 `window.__DSH_IPC__`（`fetch` + `subscribeFetchStream` + `loadBundle`）。页面自己重建 `Response` 对象 —— `contextBridge` 无法传递它们。

## Smoke

`pnpm run build` 之后，`DSH_DESKTOP_SMOKE_UNARY=1 pnpm dsh desktop` 打开窗口，通过 IPC 检查 `host.describe` / `session.list` / 一个 remotes 端点 / SSE `events.mux`，然后以 0 退出。
