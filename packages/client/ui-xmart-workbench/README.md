# @deepseek-ai/dsh-client-ui-xmart-workbench

English | [中文](README.zh.md)

X-Mart workbench plugin: an empty right-hand column beside the conversation. `WorkbenchColumn` fills the frame-declared `workbench` slot; `WorkbenchToggle` fills `shell.overlay` so a closed column can be reopened. Both surfaces drive panel transitions through `ctx.layout`. A new session starts with the workbench closed. Opening writes the contract default width (400px); the occupant then restores that session's last dragged width when it differs. Closing, dragging, and session switches remember open/closed plus the last non-zero width in the session-scoped persist store (`dsh.xmart.workbench`). The layout store itself stays transient and does not persist. The column renders title, close, and placeholder copy only — files, editing, Git, and the terminal arrive in later phases. The existing `ui-editor` conversation-view tab is unchanged. The package provides no service and declares no Context merge.

The `workbench` slot is declared by ui-layout, so `apply` uses `slots.inject()` to register for the declaration lifetime and re-register after the declaring slot is restored.

## Model Experience

None, as the workbench is browser chrome; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **Empty column** — Phase 0 ships chrome only; explorer, editor, Git, and terminal tabs are later phases.
- **No `ctx.xmartWorkbench` registry yet** — tab and viewer registration starts in Phase 1.
- **Layout preference is transient until the occupant restores it** — a full reload closes the layout store's workbench width; the occupant reapplies the session persist after mount.
- **Concession can hide an open preference** — a narrow viewport may derive a zero workbench track without clearing the stored preference; widening restores it.
