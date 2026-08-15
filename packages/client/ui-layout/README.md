# @deepseek-ai/dsh-client-ui-layout

English | [中文](README.zh.md)

Shell plugin: four-column AppFrame (drag handles and concession chain) plus the `ctx.layout` panel-geometry service; it registers into the runtime-owned `root` slot and declares `sidebar`, `conversation`, `details`, `workbench`, and `shell.overlay`. The sidebar resize boundary is an invisible hit strip, while the details and workbench boundaries retain a floating pill; concession shrinks details first and then workbench, auto-closing each when its minimum still starves the center. A closed sidebar retains a 56px control rail while details and workbench close to zero width. The package also seats the theme presenter: it consumes resolved `ctx.theme` snapshots and projects them onto the document (`html { color-scheme }` for native UA chrome, `body[data-ds-dark-theme]` from the active color scheme, the theme's alias tokens as inline variables on body, and one owned `<meta name="theme-color">` whose content follows the computed body background). Measuring after palette and token application keeps the rendered background as the single color authority; disposing the presenter removes its metadata node with its other global writes.

AppFrame always mounts the conversation, details, and workbench columns; a connected Session renders through `SessionProvider`. The transient layout store starts the sidebar at its default width with details and workbench closed, and it never reads or writes `localStorage`. Hero and other unselected states also derive a zero rendered details and workbench width without changing those stored preferences. AppFrame retains the last non-blank Session id across those states: the first Session remains closed, an explicit details action opens the contract default width, returning to the same Session restores its unchanged width, and selecting a different Session closes details before paint. The conversation and details owner shares are empty, the sidebar owner share contains only `collapsed` and `width`, and the workbench owner share is the stored width preference (0 = closed); registrants obtain business data from standard hooks and actions from their own inject faces. Switching Session ids closes details and leaves the workbench preference untouched so the workbench occupant can restore per-session memory.

The `/client` exports are the plugin body (`apply`/`inject`), `LayoutController`, and the owner-share interfaces. AppFrame, the panel store, and the concession solver remain package-internal.

## Model Experience

None, as the layout shell manages browser viewing state; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **Panel geometry is transient** — reload restores the sidebar default with details and workbench closed; switching between distinct Session ids also closes details and forgets its dragged width, while the workbench preference survives so its occupant can reapply per-session memory; unselected surfaces render details and workbench at zero width without modifying geometry.
- **Concession-chain auto-close derives a zero width without touching the preferred width** — the panel restores itself when the window widens; consumers must not read the stored details or workbench width as the rendered truth.
- **No scroll anchoring during squeeze reflow** — layout changes may move the reader's viewport.
