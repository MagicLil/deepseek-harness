# Agent Note: Keep workbench when switching chats in the same project

Status: implemented

English | [中文](2026-08-16-xmart-same-project-inherit.zh.md)

## Problem

Workbench tabs, explorer expansion, and primary width persist per `sessionId`. Clicking another conversation in the same workspace folder (or minting a blank New Session there) therefore restored that chat's own empty or stale chrome, so the live explorer and editor jumped. Only a conversation in a different folder should change the project context.

## Decision

`apply` watches `ctx.sessions.list`. When `current` moves between two sessions that share a project key (workspace folder path, else cwd), `inheritSession` overwrites the target's editor tabs and activity, `cloneExpanded` overwrites its explorer expansion, and `inheritWorkbenchPersist` copies open/width then writes that width into `ctx.layout`. Terminal tabs later share the project store as well ([keep-terminal](../bug-fix/2026-08-17-same-project-keep-terminal.md)). Workbench chrome is `session-maybe` and no longer remounts on a switch ([flash fix](../bug-fix/2026-08-17-same-project-session-switch-flash.md)); `keepLiveWidth` still skips persist restore so width does not snap to the destination default. A different folder still loads that session's own persist.

Per-session keys (`dsh.xmart.workbench.tabs.<sessionId>`, `dsh.xmart.workbench.files`, `dsh.xmart.workbench`) stay as the [tab registry](2026-08-15-xmart-workbench-tabs.md) already persists them; same-folder navigation copies into those keys instead of promoting the store to workspace scope.

## Alternatives considered

**Inherit only a blank New Session.** Rejected: switching existing chats in the same folder (`deepseek` → 「你是谁」 / 「介绍这个项目」) still jumped the editor.

**Workspace-scoped persist instead of per-session keys.** Rejected: D6 keeps session isolation; copy-on-switch preserves that on-disk shape and still lets another folder restore its own chrome.

**Leave the target's existing tabs when it already has some.** Rejected: that is the jump the user sees. Same-folder navigation must show the live editor, not the destination chat's last persist.

**Change `primarySidebar` to `session-maybe` so it does not remount.** Rejected at the time for width snap only. The later [flash fix](../bug-fix/2026-08-17-same-project-session-switch-flash.md) does this after `session-maybe` stopped remounting on switch; persist copy and `keepLiveWidth` remain.

## Consequences

Same-folder conversation clicks and New Session keep the open files, activity, explorer expansion, and sidebar width. Switching to another workspace folder still jumps. Terminal tabs do not follow. Overwrite writes the source chrome onto the destination persist keys, so returning later shows the copied tabs unless the user changes them again.
