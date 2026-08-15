# @deepseek-ai/dsh-client-ui-xmart-marketplace

English | [中文](README.zh.md)

X-Mart marketplace sidebars. `apply` registers two `ctx.xmartWorkbench` activities — `plugins` (order 30) and `extensions` (order 40) — so the activity bar grows two icons under Git / Tasks. Each pane is a search box plus Installed / Recommended groups. Components never see `ctx`; Host RPCs are closed over in `apply` and injected as callbacks.

**Plugins** talk to `remote.marketplace` and install into the running DSH profile (`pnpm add` on the Host). A successful install tells the user to relaunch the desktop app. Plugins that need a webserver or WebSocket are labelled unsupported and the confirm button stays off.

**Extensions** search Open VSX and download `.vsix` files to `~/.dsh/extensions`. They are **not activated**. Cards show an honest compatibility label. Remote SSH, Dev Containers, WSL, VS Code language packs, and Cursor-only ids cannot be installed.

The Settings → Plugins inventory tab stays read-only. This package does not add HTTP routes.

## Model Experience

None, as the marketplace is browser chrome; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **VS Code extensions do not run** — download is storage only until an extension-host spike lands.
- **Plugin install is not hot-loaded** — the Host writes the profile and asks for a relaunch.
- **pnpm logs arrive after the child exits** — no live stream in the sidebar yet.
