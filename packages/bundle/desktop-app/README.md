# `@deepseek-ai/dsh-desktop-app`

English | [中文](README.zh.md)

The dsh desktop-surface bundle. [`cordis.patch.yml`](cordis.patch.yml) stacks on [`dsh-base`](../base/README.md): coding persona, storage/workspace/api-gateway, a pinned native directory picker, the browser client roster, a loopback `webserver` on `127.0.0.1:3080`, and this package's `desktop-runtime` glue. The runtime serves the built frontend through `frontend-static` and opens Electron at that loopback URL so community HTTP plugins share origin with the host. First-party `/api` can still ride the preload IPC bridge. App flags come from [`src/startup.ts`](src/startup.ts) via `ctx.cmdlineArgs`.

## Model experience

When `surfaceContext` is true, the `app:desktop-surface` prompt section names the agent as X-Mart (万物智汇) and orients it to the desktop window at a local `http://127.0.0.1` URL. The desktop composition also sets `includeHarnessIdentity: false` so the fixed DeepSeek Harness opener does not outrank that identity.

## Known limitations

- Frontend dist must already be built (`pnpm run build`).
- First launch must run inside Electron main (`dsh desktop` re-execs under Electron automatically).
- A second launch focuses the existing window. Bounds persist in `$DSH_HOME/desktop-window.json`.
- Session-log export uses a native Save dialog; `http(s)` links open in the system browser.
