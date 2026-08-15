# @deepseek-ai/dsh-client-ui-xmart-workbench

English | [中文](README.zh.md)

X-Mart workbench plugin: a right-hand column beside the conversation that hosts a single-panel tab strip. `WorkbenchColumn` fills the frame-declared `workbench` slot; `WorkbenchToggle` fills `shell.overlay` so a closed column can be reopened. Both surfaces drive panel transitions through `ctx.layout`. A new session starts with the workbench closed. Opening writes the contract default width (400px); the occupant then restores that session's last dragged width when it differs. Closing, dragging, and session switches remember open/closed plus the last non-zero width in the session-scoped persist store (`dsh.xmart.workbench`). The layout store itself stays transient and does not persist.

`apply` provides `ctx.xmartWorkbench`. Other client plugins register tab types and file viewers through `registerTab` / `registerFileViewer` (each call returns a disposer for the fiber). `openTab` / `closeTab` / `activateTab` / `openFile` mutate the per-session tab list persisted at `dsh.xmart.workbench.tabs.<sessionId>`. Settings → Workbench lists every registered type with an enable switch (`dsh.xmart.workbench.prefs`): off hides the type from the `+` menu and refuses new `openTab` calls; tabs that are already open stay. An open tab whose type is not registered renders a placeholder card.

Built-in visible tabs: `explorer` (lazy workspace tree; available when the session has a cwd) and `demo`. Hidden tabs: `editor` (Monaco, drafts, Ctrl/Cmd+S, Markdown preview), `image` and `binary` (placeholders plus open-in-system), and a leftover `file` stub for old persisted tabs. `openFile` matches a viewer (priority-descending detect-then-exts) and opens `editor` / `image` / `binary`, deduped by path. Viewers: `binary-download` (NUL detect), `image`, `markdown`, and catch-all `code`. Explorer/editor drafts and expanded directories persist at `dsh.xmart.workbench.files`. Agent file-tool events bump a refresh nonce and a per-path reload token (D7). The existing `ui-editor` conversation-view tab is unchanged.

The `workbench` slot is declared by ui-layout, and `settings.section` by ui-settings-general, so `apply` uses `slots.inject()` to register for each declaration lifetime and re-register after the declaring slot is restored.

## Model Experience

None, as the workbench is browser chrome; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **Single panel** — the column hosts one tab strip; drag-to-split lands in a later phase.
- **Rename and delete are disabled** — the workspaces remote has no FS rename/delete yet; the explorer menu shows those rows as unavailable.
- **Chat path clicks still open the OS app** — intercepting `workspaces.openPath` from conversation chips needs a host seam in `ui-conversation`. Explorer right-click keeps "open in system app".
- **Image tabs are placeholders** — in-column preview needs a host `readFileBytes` RPC; the tab shows the path and a system-open button.
- **Git, terminal, tasks, and split panes are not registered yet** — those types arrive in later phases.
- **badge, urlTarget, and plugin-owned settings rows are not on the descriptor** — v1 keeps enable switches only.
- **Enable maps and file chrome are localStorage, not `settingsScope`** — they do not sync across devices.
- **Layout preference is transient until the occupant restores it** — a full reload closes the layout store's workbench width; the occupant reapplies the session persist after mount.
- **Concession can hide an open preference** — a narrow viewport may derive a zero workbench track without clearing the stored preference; widening restores it.
