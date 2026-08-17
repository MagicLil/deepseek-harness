# Agent Note: Opaque subagent writes enter the review dock

Status: implemented

English | [中文](2026-08-17-agent-review-opaque-subagent.zh.md)

## Problem

The composer review dock only captured parent-session `write` / `edit` / `str_replace_editor` (plus heuristic shell deletes). `cursor_agent` writes the disk inside Cursor's ACP child. Those tools never fire parent `write`/`edit`, so after a successful child write the dock stayed empty: no Review, Keep, or Undo.

## Decision

`packages/host/agent-review` treats `cursor_agent`, `subagent`, `subagent_fork`, and `subagent_acp` (plus `Config.opaqueMutationTools`) as opaque mutators. On `tools/pre-execute` it snapshots `git status --porcelain` and readable dirty/untracked bodies, and stats paths mentioned in the arguments. On `tools/result` it diffs the new porcelain, imports create/update/delete into the existing shadow engine, fills missing before-text from `git show HEAD:<path>` when the file was clean, and also imports paths named in the arguments or result (so a create still reaches the dock when git is missing, the file is gitignored, or the child wrote outside the session repo). A same-content overwrite of a path named in the result, or claimed as create/overwrite in the prompt, still enters the dock — the yellow shell bar is last resort, not the outcome of "write this file again". The shell warning is raised only when neither detector finds a file. Already-tracked `write`/`edit` rows win. The workbench dock is the only Review UI: it already renders whatever the host marks pending.

## Alternatives considered

**Parse ACP `tool_call` locations inside `dsh-subagent-acp`.** Rejected for this fix: that is an L3 patch on an upstream package, and the official client currently drops tool-call updates. The git snapshot stays L2 in `agent-review`.

**Watch the workspace with `fs.watch` during the child.** Rejected: the before-body is racy on Windows; we would often snapshot the after-content.

**Only show the shell warning for `cursor_agent`.** Rejected: the user asked for Review / Keep / Undo, not a yellow tip.

**Put a Review pill on the tool card.** Rejected: that is not the composer file list. See [tool-card review action](../../rejected/bug-fix/2026-08-17-tool-card-review-action.md).

## Consequences

A child write that is neither visible to `git status` nor named in the prompt/result still falls back to the shell warning. `tools/result` stays fire-and-forget, so the dock can lag one poll (2.5s) after the child returns. Extra `git status` runs once before and once after each opaque tool.
