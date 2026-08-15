# Agent Note: X-Mart workbench Git, tasks, and editor retirement

Status: implemented

English | [中文](2026-08-15-xmart-workbench-git-tasks.zh.md)

## Problem

Phase 2 shipped explorer and multi-file edit. Users still could not stage or commit in the column, could not see session jobs next to the chat, and the old `ui-editor` tab still occupied the conversation view ring. A real Windows PTY is a larger host change than this slice.

## Decision

**Git verbs extend the existing ApiProxy seam.** `host.gitDiff` / `gitStage` / `gitUnstage` / `gitCommit` / `gitDiscard` / `gitLog` sit next to `host.gitStatus`. They only run git CLI. They never write `user.name` / `user.email` and never push / pull / fetch. Client failures stay `GitAccessError`. The Git tab is a normal `registerTab` type; the hidden `diff` tab shows unified text (not a Monaco DiffEditor). D7's file-tool refresh nonce also reloads Git status.

**Tasks stay L2.** The tasks tab reads the live turn (`SessionSummary.running` plus the bound session's `runningCalls`), `jobsBySession`, and `subagentsByParent`. It stops the current turn or a child through `ctx.sessions`. It does not import `ui-jobs` / `ui-subagent`. In-column split is gone ([drop workbench split](../simplification/2026-08-15-drop-workbench-split.md)). The reserved terminal body occupies the AppFrame `bottomPanel` track; a real PTY is still deferred ([Cursor-style shell](2026-08-15-xmart-cursor-shell.md)).

**Terminal is an honest reserved seat.** Default web/desktop bundles do not mount `ctx.terminals`, and desktop has no page WebSocket. The bottom panel explains that instead of faking a PTY.

**Phase 6 is L1.** Both bundle patches set `ui-editor` to `disabled: true`. The conversation view ring returns to chat plus trajectory. The workbench column owns files.

## Alternatives considered

**Ship a real xterm + ConPTY bridge in this slice.** Rejected: `ctx.terminals` is host-only, not in the default desktop roster, and live output would need a new `events.host` frame. That is a follow-up L3, not a fake shell.

**Monaco DiffEditor for v1.** Rejected: dual buffers need two file reads the host does not yet pair with `gitDiff`. Unified text from `git diff` is enough to accept stage/commit.

**Kill/output for background jobs.** Rejected: those verbs are not on the client sessions face. Listing what the snapshot already has is the L2 maximum.

## Consequences

A session with a cwd can open Git, stage one file, commit with Ctrl+Enter, and open a unified diff tab. Tasks lists the live turn, jobs, and subagents. The old editor tab is gone from both bundles. Interactive terminal, job kill/output, chat-open-in-workbench, image bytes, and rename/delete remain out of scope.
