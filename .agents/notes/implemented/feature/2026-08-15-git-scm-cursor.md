# Agent Note: Cursor-style Git SCM lists

Status: implemented

English | [中文](2026-08-15-git-scm-cursor.zh.md)

## Problem

The workbench Git tab was a flat `M`/`U` list. Stage, unstage, discard, and diff lived only on the context menu, so the panel looked empty of actions. Clicking a row opened the file, not the diff. Porcelain `XY` was collapsed to one `status`, so a file dirty in both the index and the worktree (`MM`) could not appear in both Cursor sections.

## Decision

**Keep `area` on `host.gitStatus` (L3).** The parser emits an `index` row and/or a `worktree` row from each porcelain line. `MM` becomes two rows. The field is required-on-read on the existing RPC; there is no new host method.

**L2 Git tab matches Cursor's two lists.** Staged Changes and Changes get counts and Stage All / Unstage All. Row hover shows `+` / `−` / discard. A row click opens `host.gitDiff` for that side. The painted commit graph and Source Control chrome live in [the Git SCM chrome note](2026-08-15-git-scm-chrome.md).

**Out of this slice:** Sync and branch switch live in [the sync note](2026-08-15-git-sync-branch.md). AI commit messages and checkout-from-graph live in [the AI/graph note](2026-08-15-git-scm-ai-graph.md).

## Alternatives considered

**Vendor a GitHub SCM webview.** Rejected: desktop has no page WebSocket, and a third-party panel would not sit on `host.git*` IPC.

**Keep one row per path.** Rejected: Cursor's staged vs changes lists need both sides of `MM`.

## Consequences

A dirty work tree shows two sections, hover verbs, and click-to-diff. Nested-repo discovery from the earlier Git tab work is unchanged. Callers that construct a `GitChange` must set `area`.
