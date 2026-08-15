# @deepseek-ai/dsh-client-ui-layout

English | [中文](README.zh.md)

Shell plugin: Cursor-style AppFrame (drag handles and concession chain) plus the `ctx.layout` panel-geometry service; it registers into the runtime-owned `root` slot and declares `menuBar`, `activityBar`, `primarySidebar`, `workbench`, `bottomPanel`, `conversation`, `details`, `sidebar`, and `shell.overlay`. A 28px top `menuBar` row spans the full window on web and is never dragged or conceded. The desktop `dsh:` renderer hides that row so Terminal can sit on the native File menu instead. Horizontal tracks are activity (48px, never dragged) | primary | editor (`minmax(0, 1fr)`) | conversation | details | session sidebar. The bottom panel occupies only the editor column. Primary, conversation, details, and session-sidebar resize boundaries are hit strips (details / primary / conversation keep a floating pill); concession closes details, then shrinks/closes conversation, then shrinks/closes the primary sidebar. The activity bar never concedes. A closed session sidebar retains a 56px control rail; closed details / conversation / primary resolve to zero width. Editor floor is 400px. The package also seats the theme presenter: it consumes resolved `ctx.theme` snapshots and projects them onto the document (`html { color-scheme }` for native UA chrome, `body[data-ds-dark-theme]` from the active color scheme, the theme's alias tokens as inline variables on body, and one owned `<meta name="theme-color">` whose content follows the computed body background). Measuring after palette and token application keeps the rendered background as the single color authority; disposing the presenter removes its metadata node with its other global writes.

AppFrame always mounts the conversation, details, editor, and session-sidebar columns; a connected Session renders through `SessionProvider`. The transient layout store starts the session sidebar, conversation, and primary sidebar at their defaults, with details and bottom closed, and it never reads or writes `localStorage`. Hero and other unselected states derive a zero rendered details and primary width without changing those stored preferences. A blank New Session still opens the primary sidebar so Explorer can show that project's folder; details stay closed until the session has content. AppFrame retains the last non-blank Session id across those states: the first Session remains details-closed, an explicit details action opens the contract default width, returning to the same Session restores its unchanged width, and selecting a different Session closes details before paint. `openWorkbench` / `closeWorkbench` / `toggleWorkbench` / `setWorkbench` drive the left primary sidebar (the editor track is always visible). `toggleSidebar` still drives the far-right session column. Conversation and details owner shares are empty; the sidebar owner share contains only `collapsed` and `width`; the workbench owner share is the resolved editor width; activity-bar / primary / bottom owner shares carry live open flags and track sizes. Registrants obtain business data from standard hooks and actions from their own inject faces.

The `/client` exports are the plugin body (`apply`/`inject`), `LayoutController`, and the owner-share interfaces. AppFrame, the panel store, and the concession solver remain package-internal.

## Model Experience

None, as the layout shell manages browser viewing state; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **Panel geometry is transient** — reload restores the session-sidebar, conversation, and primary defaults with details and bottom closed; switching between distinct Session ids also closes details and forgets its dragged width, while the primary preference survives so its occupant can reapply per-session memory; unselected surfaces render details and primary at zero width without modifying geometry.
- **Concession-chain auto-close derives a zero width without touching the preferred width** — the panel restores itself when the window widens; consumers must not read the stored details or primary width as the rendered truth.
- **No scroll anchoring during squeeze reflow** — layout changes may move the reader's viewport.
