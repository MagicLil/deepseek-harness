# Global Search Source Recovery Design

Date: 2026-08-16
Status: approved

## Goal

Restore the complete source-owned implementation of workbench global search so a clean build retains Ctrl+Shift+F search and `host.search` can launch the packaged ripgrep binary on Windows.

## Decisions

- Treat `src/`, package manifests, tests, and documentation as authoritative; ignored `lib/` files are recovery evidence only.
- Restore the existing `host.search` RPC, `ctx.workspaces.search` client method, Search activity, and desktop/Web commands without changing their user-visible behavior.
- Declare `@vscode/ripgrep` directly in `@deepseek-ai/dsh-host-apiproxy`. pnpm package isolation must not rely on the copy installed for `dsh-tool-fs-search`.
- Preserve all unrelated uncommitted work and merge search edits into current files.
- Keep the existing first-party RPC route. Do not add an HTTP route, WebSocket, shell fallback, or system-installed `rg` dependency.

## Verification

Focused tests cover ripgrep argument construction and parsing, the host RPC handler, transport/runtime forwarding, client state and rendering, and menu dispatch. A clean host/client build must succeed, then a live desktop `host.search` request for `js` must return `ok: true` with matches instead of `search-unavailable`.
