# `@deepseek-ai/dsh-desktop-app`

English | [中文](README.zh.md)

The dsh desktop-surface bundle. [`cordis.patch.yml`](cordis.patch.yml) stacks on [`dsh-base`](../base/README.md): coding persona, storage/workspace/api-gateway, a pinned native directory picker, the browser client roster, and this package's `desktop-runtime` glue (no `webserver`). The runtime opens Electron over the `dsh://` protocol, injects `window.__DSH_BOOT__`, and carries `/api` through an IPC fetch bridge (`toFetchHandler`). App flags come from [`src/startup.ts`](src/startup.ts) via `ctx.cmdlineArgs`.

## Model experience

When `surfaceContext` is true, the `app:desktop-surface` prompt section orients the model to the desktop window (IPC, not a browser URL).

## Known limitations

- Frontend dist must already be built (`pnpm run build`).
- First launch must run inside Electron main (`dsh desktop` re-execs under Electron automatically).
