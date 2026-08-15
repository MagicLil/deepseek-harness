# @deepseek-ai/dsh-host-marketplace

English | [中文](README.zh.md)

Host Remote for the X-Mart marketplace sidebars. `MarketplaceGateway` registers the `marketplace` service and publishes eight generated direct Remotes: DSH plugin search / list / install / uninstall, and Open VSX extension search / list / install / uninstall.

Plugin install reuses the CLI `dsh plugin add` semantics: `pnpm add` / `pnpm remove` in the running profile directory (`desktop` under Electron, otherwise `DSH_PROFILE` or `web`), then reconcile `dsh.profile.bundles`. Lifecycle scripts stay off unless the caller sets `allowBuilds`. Plugins that need a webserver or WebSocket are refused on desktop. A successful plugin mutation always returns `needsRestart: true` — the Host does not hot-load untrusted code.

Extension install talks only to [Open VSX](https://open-vsx.org/) (never the Microsoft Marketplace). Downloaded `.vsix` files land under `~/.dsh/extensions` with a local manifest. They are **not activated**: the editor is still AMD Monaco. Cards carry a compatibility label (`pending-host`, `needs-node-host`, or `unsupported`). Remote SSH, Dev Containers, WSL, VS Code language packs, and Cursor-only ids are `unsupported` and cannot be installed.

The service is Remote-only and declares no same-process Cordis `Context` merge. Client packages consume it through the [`api-remotes`](../../api/remotes/README.md) assembly. There are no new HTTP routes.

## Model Experience

None, as this Host marketplace registers no prompt, tool, message, or provider request.

#### KV Cache effect

None; this package never assembles model input.

## Known Limitations and Deferred Work

- **pnpm logs are returned after the child exits** — live streaming into the sidebar is deferred; the job result includes the combined stdout/stderr.
- **Downloaded vsix files do not run** — activation waits on a separate extension-host decision (monaco-vscode-api spike). Until that gate passes, language support is a first-party language pack, not an arbitrary VS Code extension.
- **Catalog fetch falls back to a bundled snapshot** — a failed live fetch still shows the curated rows, not an empty pane.
- **No Microsoft Marketplace and no import of a local Cursor extensions folder.**
