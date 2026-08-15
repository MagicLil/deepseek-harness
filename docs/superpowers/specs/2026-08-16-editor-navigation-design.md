# Editor navigation and in-file find

Date: 2026-08-16
Status: approved (user skipped written-spec review; implement as written)

## Goal

Give the X-Mart workbench Monaco editor Cursor/VS Code navigation on files that already have a language server (`.java` / `.ts` / `.js` / `.vue`):

- Ctrl+click / F12 → go to definition
- Mouse hover → documentation
- Shift+F12 → find references (Monaco peek)
- Ctrl+F / Ctrl+H → current-file find / replace, even when chat has focus

Out of scope: rename, refactor, go-to-implementation, workspace search, IDEA `Ctrl+B` (already toggles the primary sidebar).

## Approach

Extend the existing `vueLsp` / `tsLsp` / `javaLsp` remotes. Do not call `ctx.lsp.query` from the editor (that path re-reads disk and misses unsaved buffers).

Host `session.query` already speaks `textDocument/definition|hover|references`. Add `session.navigate` / `pool.navigate` that only run when the editor buffer is already `didOpen` (same rule as `complete`). Gateways publish `definition` / `hover` / `references`.

## Client

- `EditorLanguageClient` gains the three methods.
- Monaco registers Definition / Hover / Reference providers and an editor opener.
- `file:` locations open via `openFile` plus an ephemeral reveal `{ line, character }`.
- Non-`file:` targets (jar / `jdt://` / `.class`) stay put and show “没有源码”.
- Empty results: no tab change; Monaco’s empty-definition / empty-references UI is enough.
- Failures (timeout, dead server) are silent; typing and save still work.

## Find / replace

- New app-menu commands `file-find` / `file-replace`.
- Web MenuBar and desktop Electron Edit menu both expose them (`Ctrl+F` / `Ctrl+H`).
- They dispatch window events; the focused (or last) Monaco host runs `actions.find` / `editor.action.startFindReplaceAction`.
- No editor tab: the shortcut still consumes the key so Chromium find-in-page does not appear.

## Layers

- L2: `packages/lsp/lsp-languages`, `packages/lsp/lsp-vue`, `packages/client/ui-xmart-workbench`
- L3: `apps/desktop` application menu (already a fork patch; Find/Replace must live on the native menu or desktop never sees the accelerators)

No `agent-loop` changes. Navigation is not a session event and never enters a model request.

## Tests

- Host: empty / one location / hover text / navigate on a closed buffer
- Client: URI→path, reveal, Monaco providers, menu dispatch
- Desktop: menu spec includes Find/Replace accelerators
