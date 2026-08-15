# Agent Note: Cursor-style X-Mart shell

Status: implemented

English | [中文](2026-08-15-xmart-cursor-shell.zh.md)

## Problem

The Phase 0 workbench sat in a fourth column to the right of chat. Users who wanted a Cursor-like coding surface had the conversation in the middle and tools on the far right, so the editor never felt like the main pane. Explorer, Git, tasks, and the reserved terminal still shared one tab strip with open files. The overlay “reopen workbench” control assumed that center column could close. The product decision on 2026-08-15 replaced that D2 with a full-shell swap and must not reopen `conversation.view` or `agent-loop`.

## Decision

**AppFrame paints six horizontal tracks plus an editor-stacked bottom row.** Order is activity (48px) | primary sidebar | editor (`workbench`) | conversation | details | session sidebar. Existing slot ids stay; only the paint position changes, so `ui-sidebar` still injects `sidebar` and the workbench plugin still injects `workbench`. New declarations are `activityBar`, `primarySidebar`, and `bottomPanel` (all session / single). Concession is details → conversation → primary; the activity bar never yields; the session sidebar becomes a 56px rail when closed. Editor floor is 400px. `openWorkbench` / `closeWorkbench` / `setWorkbench` drive the left primary width so existing `openFile` → `attachPanel` still reveals a pane. `toggleSidebar` still means the far-right session column.

**`ui-xmart-workbench` occupies the new seats without putting Explorer on the editor strip.** `ActivityBar` fills `activityBar`. `PrimarySidebar` fills `primarySidebar` and renders the registered `explorer` / `git` / `tasks` bodies from the session `activity` field. `BottomPanel` fills `bottomPanel` with the reserved `terminal` body. `WorkbenchColumn` stays on `workbench`, drops the close chrome, filters shell tab types out of the strip, and stays mounted. Those four types register `hidden: true`. Activity persists on the session tab store; primary open/width still persist at `dsh.xmart.workbench`. The overlay toggle is gone. Settings on the activity bar clicks the existing `sidebar.settings` trigger.

This note supersedes the column placement in [the Phase 0 workbench column note](2026-08-15-xmart-workbench-column.md). Host seams in that note (IPC, `host.git*`, no page WebSocket) still hold.

## Alternatives considered

**Keep chat in the center and only restyle the right workbench.** Rejected: the approved product choice is a full-shell swap, not a theme pass on the Phase 0 fourth column.

**Rename `sidebar` / `workbench` to match the new paint order.** Rejected: those ids are the inject targets for `ui-sidebar` and the existing workbench occupant. Renaming would force a wide L3 churn for a cosmetic name.

**Give the editor its own close/open preference.** Rejected: the center track is the product’s permanent pane. Closing it would recreate the overlay control the shell just removed.

**Open a new HTTP or WebSocket channel for the activity bar.** Rejected: desktop has no page webserver. The new seats are slot occupants over `ctx.layout`.

## Consequences

Desktop and web render activity | primary | editor | chat | details | sessions. The editor column cannot close. The bottom terminal seat is a placeholder until a later PTY slice. `ui-sidebar` is unchanged. Fork ledger entry 7 records the `ui-layout` L3. True PTY, conversation path-click routing, and Git push/pull stay out of this change.
