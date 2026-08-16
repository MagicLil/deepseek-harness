# `@deepseek-ai/dsh-desktop`

English | [中文](README.zh.md)

Electron main/preload shell for the desktop profile: `dsh://` static serving, IPC fetch to `toFetchHandler`, and `relaunch` so the Node CLI can re-exec under Electron.

## Entry

- `dsh desktop` / `dsh --profile desktop` — CLI detects a non-Electron process and calls [`relaunch`](src/relaunch.ts).
- Electron then runs the **compiled** [`lib/electron-main.js`](lib/electron-main.js) (built by `pnpm run build:lib`). Electron cannot use `tsx` — its Node ABI does not load tsx's native esbuild binary.
- [`shell`](src/shell.ts) opens the window once `apiProxy` and `clientModules` are live, and installs the application menu (stock File / Edit / View / Window / Help plus Terminal).
- A second `dsh desktop` focuses the existing window (single-instance lock). Window bounds persist under `$DSH_HOME/desktop-window.json`. Closing the window hides to the tray (Quit from the tray menu exits). The first hide shows a one-time toast; that flag lives in `$DSH_HOME/desktop-prefs.json`.

## Updates

Auto-update runs only on a **packaged NSIS install**. `pnpm dsh desktop` and the portable exe skip it (`PORTABLE_EXECUTABLE_DIR`). Checks do not download until the user clicks 下载. If the window is in the tray, a toast appears first; click it to open the dialog. Publish feed defaults to electron-builder's `app-update.yml`; override with `DSH_UPDATE_FEED_URL` or `DSH_UPDATE_GITHUB`.

## Preload

[`preload.mjs`](preload.mjs) is checked in as CommonJS (`require('electron')`) so the sandboxed renderer can load it without a prior TypeScript build. ESM `import` throws `Cannot use import statement outside a module` in that sandbox and leaves `window.__DSH_IPC__` missing. It exposes `window.__DSH_IPC__` (`fetch` + `subscribeFetchStream` + `abortFetch` + `loadBundle` + `onAppMenu` + `setTitleBarOverlay`). The page rebuilds `Response` objects itself — `contextBridge` cannot deliver them.

Closing the window (or cancelling a streamed `Response`) aborts in-flight Host fetches before IPC handlers are removed.

Renderer `fetch` / `<a download>` to `dsh://app/api/...` is forwarded to the same Host handler. Session-log export opens a native Save dialog. `http(s)` links open in the system browser.

## Smoke

After `pnpm run build`, `DSH_DESKTOP_SMOKE_UNARY=1 pnpm dsh desktop` opens the window, checks `host.describe` / `session.list` / a remotes endpoint / SSE `events.mux` over IPC, then exits 0.
