# `@deepseek-ai/dsh-desktop`

English | [中文](README.zh.md)

Electron main/preload shell for the desktop profile: `dsh://` static serving, IPC fetch to `toFetchHandler`, and `relaunch` so the Node CLI can re-exec under Electron.

## Entry

- `dsh desktop` / `dsh --profile desktop` — CLI detects a non-Electron process and calls [`relaunch`](src/relaunch.ts).
- Electron then runs the **compiled** [`lib/electron-main.js`](lib/electron-main.js) (built by `pnpm run build:lib`). Electron cannot use `tsx` — its Node ABI does not load tsx's native esbuild binary.
- [`shell`](src/shell.ts) opens the window once `apiProxy` and `clientModules` are live.

## Preload

[`preload.mjs`](preload.mjs) is checked in as plain ESM so Electron can load it without a prior TypeScript build. It exposes `window.__DSH_IPC__` (`fetch` + `subscribeFetchStream` + `loadBundle`). The page rebuilds `Response` objects itself — `contextBridge` cannot deliver them.

## Smoke

After `pnpm run build`, `DSH_DESKTOP_SMOKE_UNARY=1 pnpm dsh desktop` opens the window, checks `host.describe` / `session.list` / a remotes endpoint / SSE `events.mux` over IPC, then exits 0.
