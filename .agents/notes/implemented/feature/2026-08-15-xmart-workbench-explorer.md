# Agent Note: X-Mart workbench explorer and editor

Status: implemented

English | [中文](2026-08-15-xmart-workbench-explorer.zh.md)

## Problem

Phase 1 shipped an empty tab strip: `openFile` always opened a hidden `file` stub, and the only visible built-in was a demo page. Users still had to leave the conversation to browse or edit workspace files, and agent writes did not refresh anything in the column.

## Decision

**Explorer and editor are ordinary `registerTab` types.** `explorer` is visible and `single`. It shows one tree: the current conversation's workspace (same resolution as Git — membership, then the workspace that contains cwd, then a cwd that is not a parent of registered folders, then recency, then the first registered path). A cold start with folders already in the rail still has a tree without waiting for `session.cwd`. Switching the conversation switches the tree. `editor` / `image` / `binary` are hidden and dedupe by path. `openFile` matches a viewer (detect before extensions, priority descending) and routes to those hidden types; the old `file` stub stays only so persisted tabs from Phase 1 still render. Tab bodies still receive `{ tab, visible, sessionId }` plus callbacks closed over in `apply` — never `ctx`.

**File chrome is a second persist store.** Expanded directories and dirty drafts live at `dsh.xmart.workbench.files`. Reload tokens and the explorer refresh nonce are ephemeral. Monaco loads from `/monaco/vs` the same way `ui-editor` does; this package copies the tree and host instead of importing `ui-editor` (cross-plugin value imports are forbidden). Markdown preview uses `MarkdownText` from primitives. Image/binary tabs are placeholders with a system-open button until a host bytes RPC exists.

**D7 listens on conversation events, not a file watcher.** `conversationEvents.register` watches tool-call locations; a later seq bumps the tree refresh and per-path reload tokens so an open editor can show a reload banner. Rename/delete menu rows stay disabled because the workspaces remote has no those methods. Chat path clicks still call `workspaces.openPath` (OS app); intercepting them needs a seam in `ui-conversation`.

## Alternatives considered

**Import FileTree/Monaco from `ui-editor`.** Rejected: client UI plugins must not value-import each other. The copies stay in this package.

**Add FS rename/delete and `readFileBytes` in this slice.** Rejected: those are host remotes (L3). The explorer menu and image tab degrade in-product instead of inventing HTTP routes.

**Open chat file chips in the workbench now.** Rejected: `ui-conversation` hard-calls `workspaces.openPath`. A `chatFileOpener` seam is a later L3 patch, recorded when it lands.

**Put Shiki in the workbench Monaco host.** Rejected for v1: language id from the path is enough; Shiki can follow if the editor retirement phase needs parity.

**Stack every registered folder in one explorer.** Rejected: the right-rail list is a project switcher. Dumping `bagu` / `Magiccode` / `hmdp` into one pane mixed unrelated trees. One session, one tree.

## Consequences

A session can open Explorer from `+` as soon as that session has a folder (cwd or a registered workspace), browse that one tree, create files/folders, @ a path into the composer, and open several files as editor tabs. Saving writes through `ctx.workspaces`. Agent file tools refresh the tree and banner open editors. Image and binary paths open placeholder tabs. Git and Explorer share the same session folder. `conversation.view` and `agent-loop` stay untouched.
