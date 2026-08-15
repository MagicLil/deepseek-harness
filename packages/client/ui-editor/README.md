# @deepseek-ai/dsh-client-ui-editor

English | [中文](README.zh.md)

The in-app code editor: one tab in the conversation's `'conversation.view'` slot ring pairing a workspace file tree with the Monaco editor — the same editor core VSCode ships. The session's `cwd` roots the tree; levels load lazily through `ctx.workspaces.listEntries` and reload on Refresh. Opening a file reads its whole UTF-8 content through `ctx.workspaces.readFile`; binary (`file-binary`), oversized (`file-too-large`), and unreadable targets show a placeholder instead of an editor. Saving (the toolbar button or Ctrl/Cmd-S inside the editor) writes the whole buffer back through `ctx.workspaces.writeFile`, last write wins. The declared session store carries the open file, expanded directories, and per-file unsaved buffers, so switching view tabs and returning restores the same editing state; dirty files carry a dot in the tree and an "unsaved" status seat in the toolbar. Monaco boots once per page from the AMD assets the frontend dist ships at `/monaco/vs` (apps/web's `copyMonacoAssets`), one code path for both surfaces: HTTP on web, the `dsh://` protocol on desktop. Syntax highlighting uses the official [`@shikijs/monaco`](https://github.com/shikijs/shiki) integration — the same TextMate grammars VS Code / Cursor use — with `one-dark-pro` / `min-light` themes. Markdown files get a live preview (edit / split / preview) through the shared `MarkdownText` renderer. A Git tab lists `git status` changes and paints SCM letters on the file tree. The package provides no service and declares no Context merge.

## Model Experience

None, as the editor reads and writes workspace files in the browser; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **No external-change detection** — the buffer never watches the file on disk; an agent tool or external editor writing the same file goes unnoticed until reopen, and saving over it is last-write-wins with no conflict prompt.
- **Whole-content transport with a 2 MiB bound** — read and write ship the entire document per call; files past the host bound refuse to open rather than stream, and undo history resets when switching files.
- **No file management verbs** — the tree lists and opens only; create/rename/delete of files and directories stay with the model's tools or the host OS.
- **Monaco assets ride the frontend dist** — the editor engine loads from `/monaco/vs`; a dist built before the copyMonacoAssets step shows the engine-load error state until the frontend is rebuilt. Where the platform refuses same-origin workers, Monaco falls back to main-thread language services.
