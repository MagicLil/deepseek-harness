# Agent Note: Same-project conversation switch flash

Status: implemented

English | [中文](2026-08-17-same-project-session-switch-flash.zh.md)

## Problem

Clicking another conversation in the same project remounted the activity bar, explorer, editor, bottom panel, and the conversation shell. FileTree dropped its loaded levels, Monaco tore down, and the window flashed empty for a frame. [Same-project inherit](../feature/2026-08-16-xmart-same-project-inherit.md) already copied tabs and width, but it could not keep React local state across a remount.

## Decision

Workbench chrome slots (`menuBar`, `activityBar`, `primarySidebar`, `workbench`, `bottomPanel`) are `session-maybe`. `SessionMaybeEntry` keeps one incarnation while a current session exists: blank adopts the first id, a later switch updates hooks/props in place, and only session loss remounts. Strict `session` slots such as `conversation.session` still remount so chat local state cannot leak. Inject factories accept a missing session id and bind `EMPTY_SESSION_SOURCE`.

## Alternatives considered

**Leave workbench slots as `session` and only copy persist.** Rejected: inherit already did that and the flash remained, because `key={sessionId}` still unmounted FileTree and Monaco.

**Change workbench slots to `root`.** Rejected: the primary-sidebar persist store is per session id via `storeOf(entry, sessionId)`. Root scope would collapse that to one instance and break D6 isolation.

**Keep remounting `session-maybe` after adoption.** Rejected: that is what flashed the conversation shell. State that must reset on switch already keys a child (`PermissionSelect` uses `key={sessionId}`).

## Consequences

Same-project conversation clicks keep the explorer tree, editor tabs, and activity rail mounted. A different folder still changes roots; the previous tree stays painted until the new listing is ready ([cross-project flash](2026-08-17-cross-project-session-switch-flash.md)). Chat content still remounts. Desktop must load rebuilt `ui-layout`, `web-react`, and `ui-xmart-workbench` `lib/` before the flash is gone.
