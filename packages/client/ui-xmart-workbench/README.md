# @deepseek-ai/dsh-client-ui-xmart-workbench

English | [中文](README.zh.md)

X-Mart workbench plugin: the Cursor-style occupants of the frame-declared `menuBar`, `activityBar`, `primarySidebar`, `workbench`, and `bottomPanel` slots. The product application menu is File / Edit / View / Terminal / Help (新会话, 打开工作区, 保存, 关闭编辑器, 设置, Explorer / Git / Tasks, sidebars, terminal). Desktop installs that row as the Electron application menu; the HTML `menuBar` is web-only. File → Settings dispatches `dsh:open-settings`; File → Save dispatches `dsh:workbench-save` to the mounted editor. The activity bar switches Explorer / Git / Tasks in the left primary sidebar (clicking the active icon collapses that track). Settings also stay on the far-right session rail. `WorkbenchColumn` fills the center editor track with file tabs; that track stays mounted. The primary-sidebar occupant remembers open/closed plus the last non-zero width per session in `dsh.xmart.workbench` (default open at 260px). Activity lives on the per-session tab persist (`dsh.xmart.workbench.tabs.<sessionId>.activity`). The layout store itself stays transient and does not persist.

`apply` provides `ctx.xmartWorkbench`. Other client plugins register tab types, file viewers, and activity-bar entries through `registerTab` / `registerFileViewer` / `registerActivity` (each call returns a disposer for the fiber). Built-in activities are `explorer`, `git`, and `tasks`; marketplace plugins add more. Unknown persisted activity ids display as Explorer. `openTab` / `closeTab` / `activateTab` / `openFile` / `setActivity` mutate the per-session tab list. Settings → Workbench lists every registered type with an enable switch (`dsh.xmart.workbench.prefs`): off hides the type from the `+` menu and refuses new `openTab` calls; tabs that are already open stay. An open tab whose type is not registered renders a placeholder card.

Built-in shell types are hidden from `+`: `explorer` (lazy tree of the current session folder — same resolution as Git; a title-row refresh icon re-lists the disk, and new file/folder live on the row context menu), `git` (Cursor-style Source Control: filename + dimmed directory rows, hover stage-unstage-discard, section stage-all / discard-all, click opens a unified diff, commit only when something is staged, a sparkle button that asks the host for an auxiliary commit message, branch switch/create, user-clicked fetch/ff-only-pull/push sync, a painted commit graph with author names and no leading hash; clicking a row opens that commit's per-file diff, while ref pills still switch or detach; if the session cwd is not a repo, the panel probes immediate child folders), `tasks` (live turn, session jobs, and subagents), and `terminal` (line-oriented host PTY via `host.terminal*`; at most 3 per session; hiding the bottom panel does not kill the PTY). Visible `+` type: `demo`. Hidden file tabs: `editor` (Monaco, drafts, Ctrl/Cmd+S, Markdown preview), `diff` (unified text from `host.gitDiff`), `image` and `binary` (placeholders plus open-in-system), and a leftover `file` stub for old persisted tabs. `openFile` matches a viewer (priority-descending detect-then-exts) and opens `editor` / `image` / `binary`, deduped by path. Viewers: `binary-download` (NUL detect), `image`, `markdown`, and catch-all `code`. Explorer/editor drafts and expanded directories persist at `dsh.xmart.workbench.files`. Agent file-tool events bump a refresh nonce and a per-path reload token (D7), which also refreshes the Git tab. Both bundle patches disable `ui-editor`, so the conversation view ring is chat plus trajectory.

The shell slots are declared by ui-layout, and `settings.section` by ui-settings-general, so `apply` uses `slots.inject()` to register for each declaration lifetime and re-register after the declaring slot is restored.

## Model Experience

None, as the workbench is browser chrome; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **Rename and delete are disabled** — the workspaces remote has no FS rename/delete yet; the explorer menu shows those rows as unavailable.
- **Chat path clicks still open the OS app** — intercepting `workspaces.openPath` from conversation chips needs a host seam in `ui-conversation`. Explorer right-click keeps "open in system app".
- **Image tabs are placeholders** — in-column preview needs a host `readFileBytes` RPC; the tab shows the path and a system-open button.
- **Terminal is line-oriented** — Enter sends one line and waits for idle. Python REPL is the acceptance bar; full-screen TUIs (vim/htop) are out of scope. A session whose agent has no `ctx.terminals` shows an unavailable note instead of a fake shell.
- **Background-job kill/output are still absent** — those verbs are not on the client sessions face. The live turn can be stopped through `session.cancel`. Subagent stop/open use `ctx.sessions`.
- **Diff is unified text** — not a Monaco DiffEditor dual pane. Git sync is user-clicked only (fetch, `--ff-only` pull, push). It never force-pushes and never writes `user.name` / `user.email`. The commit graph paints merge edges and ref pills; clicking a row opens `host.gitDiff` with `commit` (first-parent patch). Remote/tag pills can still detach HEAD. It is not a full Git Graph extension (no octopus layout or interactive rebase). There is no Agent Review pane. The sparkle button asks `host.gitSuggestCommit`; the host owns the prompt and logs `session/git-commit-llm-request`.
- **badge, urlTarget, and plugin-owned settings rows are not on the descriptor** — v1 keeps enable switches only.
- **Enable maps and file chrome are localStorage, not `settingsScope`** — they do not sync across devices.
- **Layout preference is transient until the occupant restores it** — a full reload resets the layout store's primary width to the default open size; the occupant reapplies the session persist after mount.
- **Concession can hide an open preference** — a narrow viewport may derive a zero primary track without clearing the stored preference; widening restores it.
