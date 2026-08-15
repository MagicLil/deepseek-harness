# @deepseek-ai/dsh-client-ui-xmart-workbench

English | [中文](README.zh.md)

X-Mart workbench plugin: the Cursor-style occupants of the frame-declared `activityBar`, `primarySidebar`, `workbench`, and `bottomPanel` slots. The activity bar switches Explorer / Git / Tasks in the left primary sidebar (clicking the active icon collapses that track) and toggles the editor-stacked terminal seat. Settings on the activity bar clicks the existing `sidebar.settings` trigger. `WorkbenchColumn` fills the center editor track with file tabs; that track stays mounted. The primary-sidebar occupant remembers open/closed plus the last non-zero width per session in `dsh.xmart.workbench` (default open at 260px). Activity lives on the per-session tab persist (`dsh.xmart.workbench.tabs.<sessionId>.activity`). The layout store itself stays transient and does not persist.

`apply` provides `ctx.xmartWorkbench`. Other client plugins register tab types, file viewers, and activity-bar entries through `registerTab` / `registerFileViewer` / `registerActivity` (each call returns a disposer for the fiber). Built-in activities are `explorer`, `git`, and `tasks`; marketplace plugins add more. Unknown persisted activity ids display as Explorer. `openTab` / `closeTab` / `activateTab` / `openFile` / `setActivity` mutate the per-session tab list. Settings → Workbench lists every registered type with an enable switch (`dsh.xmart.workbench.prefs`): off hides the type from the `+` menu and refuses new `openTab` calls; tabs that are already open stay. An open tab whose type is not registered renders a placeholder card.

Built-in shell types are hidden from `+`: `explorer` (lazy workspace tree; available when the session has a cwd; a title-row refresh icon re-lists the disk, and new file/folder live on the row context menu), `git` (status / stage / commit / log; if the session cwd is not a repo, the panel probes immediate child folders), `tasks` (live turn, session jobs, and subagents), and `terminal` (reserved seat — the default desktop bundle does not mount `ctx.terminals`). Visible `+` type: `demo`. Hidden file tabs: `editor` (Monaco, drafts, Ctrl/Cmd+S, Markdown preview), `diff` (unified text from `host.gitDiff`), `image` and `binary` (placeholders plus open-in-system), and a leftover `file` stub for old persisted tabs. `openFile` matches a viewer (priority-descending detect-then-exts) and opens `editor` / `image` / `binary`, deduped by path. Viewers: `binary-download` (NUL detect), `image`, `markdown`, and catch-all `code`. Explorer/editor drafts and expanded directories persist at `dsh.xmart.workbench.files`. Agent file-tool events bump a refresh nonce and a per-path reload token (D7), which also refreshes the Git tab. Both bundle patches disable `ui-editor`, so the conversation view ring is chat plus trajectory.

The shell slots are declared by ui-layout, and `settings.section` by ui-settings-general, so `apply` uses `slots.inject()` to register for each declaration lifetime and re-register after the declaring slot is restored.

## Model Experience

None, as the workbench is browser chrome; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **Rename and delete are disabled** — the workspaces remote has no FS rename/delete yet; the explorer menu shows those rows as unavailable.
- **Chat path clicks still open the OS app** — intercepting `workspaces.openPath` from conversation chips needs a host seam in `ui-conversation`. Explorer right-click keeps "open in system app".
- **Image tabs are placeholders** — in-column preview needs a host `readFileBytes` RPC; the tab shows the path and a system-open button.
- **Terminal is a reserved bottom seat** — interactive PTY needs host terminal RPCs and a bundle that mounts `ctx.terminals`. The panel explains that instead of faking a shell.
- **Background-job kill/output are still absent** — those verbs are not on the client sessions face. The live turn can be stopped through `session.cancel`. Subagent stop/open use `ctx.sessions`.
- **Diff is unified text** — not a Monaco DiffEditor dual pane. Git does not push / pull / fetch and never writes `user.name` / `user.email`.
- **badge, urlTarget, and plugin-owned settings rows are not on the descriptor** — v1 keeps enable switches only.
- **Enable maps and file chrome are localStorage, not `settingsScope`** — they do not sync across devices.
- **Layout preference is transient until the occupant restores it** — a full reload resets the layout store's primary width to the default open size; the occupant reapplies the session persist after mount.
- **Concession can hide an open preference** — a narrow viewport may derive a zero primary track without clearing the stored preference; widening restores it.
