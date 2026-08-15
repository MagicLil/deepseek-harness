# Agent Note: X-Mart workbench column

Status: implemented

English | [中文](2026-08-15-xmart-workbench-column.zh.md)

## Problem

The shipped in-app editor occupies one tab in the conversation `conversation.view` ring, so the user cannot read the transcript and edit files at the same time. Community workbenches that solve that layout over HTTP routes and a page WebSocket do not run on desktop, because the desktop shell bridges `/api/*` over IPC and has no webserver upgrade path. The product still needs a first-party workbench beside the conversation, but the first slice must settle layout, transport, and host seams before any editor, Git, or terminal UI lands.

## Decision

**The shell grows a fourth `workbench` column.** `ui-layout` declares a session-scoped `workbench` slot and solves `sidebar | center | details | workbench`. Details stays the tool-inspect panel. The sidebar never concedes; the chain shrinks details, auto-closes details, shrinks workbench, auto-closes workbench, then lets center absorb any remaining deficit. Both details and workbench may derive to width 0 without rewriting the stored preference. Geometry is `WORKBENCH_MIN=320`, `WORKBENCH_MAX=720`, `WORKBENCH_DEFAULT=400`.

**`@deepseek-ai/dsh-client-ui-xmart-workbench` owns the occupant.** Plugin id `ui-xmart-workbench` mounts in both the web-app and desktop-app bundle patches. `WorkbenchColumn` fills `workbench`; `WorkbenchToggle` fills `shell.overlay`. A new session starts closed. The right-edge overlay control opens the column. The occupant remembers open/closed and the last non-zero width per session in `dsh.xmart.workbench`; the layout store stays transient and does not persist. Session switches close details and leave the workbench preference for the occupant to restore. The existing `ui-editor` tab is unchanged.

**Later phases reuse existing host seams instead of new transports.** Session streaming stays on `events.mux`. Forwarded host/cordis events stay on `events.host`. Desktop already delivers those over IPC SSE (`IpcApiClient`); Phase 4 terminal output adds a host event plus `API_REMOTE_FORWARDED_EVENTS`, not a page WebSocket. `gitStatus` already lives in `packages/host/apiproxy` (`git-status.ts` → `host.gitStatus` → `ctx.workspaces.gitStatus`); Phase 3 extends `host.git*` and workspaces, and does not add push/pull/fetch. `ctx.terminals` remains exact-Agent ownership; v1 UI terminals use the session Agent as owner. Agent file edits already arrive as `tool/call` and `tool/result` for `write` / `edit` / `str_replace_editor`, with `file_path` or `path` in the args JSON — Phase 2 watches those events and does not invent a new session event.

## Alternatives considered

**Reuse the existing `details` column.** Rejected because details already owns tool-call inspection. Sharing that track would collapse two unrelated jobs onto one width preference and one close gesture.

**Ship or vendor DSH-better-sidebar.** Rejected because that plugin's host half depends on HTTP sidebar routes and a terminal WebSocket. Desktop has neither, and copying another repository's stack would fight this repo's plugin, RPC, and coverage rules.

**Persist workbench geometry in the layout store.** Rejected because the layout store is a transient viewing preference by contract. Session memory belongs to the workbench occupant so a reload can restore one session without making every panel durable.

**Default the workbench open on a new session.** Rejected: the confirmed Phase 0 skeleton stays closed, with the overlay control as the only open affordance, so the empty column does not steal conversation width before it has contents.

**Place the workbench in `conversation.view`.** Rejected because that ring is mutually exclusive. The workbench exists so the transcript and the tools stay on screen together.

**Open a new WebSocket for terminal output.** Rejected because desktop cannot upgrade the page, and the connection layer already forwards host events over IPC SSE.

**Introduce a `UiOwner` terminal kind in Phase 0.** Rejected as premature. v1 can own UI terminals through the session Agent; a separate owner type waits until that exact-Agent rule actually blocks the product.

**Add Git verbs under Typert remotes.** Rejected because `gitStatus` already sits on the apiproxy / workspaces path. Phase 3 extends that seam rather than standing up a second Git surface.

## Consequences

Web and desktop both render an empty, toggleable, resizable workbench column whose width memory is per session. Concession can hide an open preference on a narrow viewport and restore it when the window widens. A live session with the workbench closed shows the overlay reopen control. Later phases add tabs, files, Git, and terminals inside this package and the existing host seams; they do not reopen the column-versus-details or HTTP-versus-IPC choices. `conversation.view` and `agent-loop` stay untouched.
