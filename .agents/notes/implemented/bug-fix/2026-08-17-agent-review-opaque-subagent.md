# Agent Note: Opaque subagent writes enter the review dock

Status: implemented

English | [中文](2026-08-17-agent-review-opaque-subagent.zh.md)

## Problem

The composer review dock only captured parent-session `write` / `edit` / `str_replace_editor` (plus heuristic shell deletes). `cursor_agent` writes the disk inside Cursor's ACP child. Those tools never fire parent `write`/`edit`, so after a successful child write the dock stayed empty: no Review, Keep, or Undo.

## Decision

`packages/host/agent-review` treats `cursor_agent`, `subagent`, `subagent_fork`, and `subagent_acp` (plus `Config.opaqueMutationTools`) as opaque mutators. On `tools/pre-execute` it snapshots `git status --porcelain` and readable dirty/untracked bodies. On `tools/result` it diffs the new porcelain, imports create/update/delete into the existing shadow engine, and fills missing before-text from `git show HEAD:<path>` when the file was clean. A missing git repo or cwd falls back to the existing shell warning. Already-tracked `write`/`edit` rows win. The workbench dock is unchanged: it already renders whatever the host marks pending.

## Alternatives considered

**Parse ACP `tool_call` locations inside `dsh-subagent-acp`.** Rejected for this fix: that is an L3 patch on an upstream package, and the official client currently drops tool-call updates. The git snapshot stays L2 in `agent-review`.

**Watch the workspace with `fs.watch` during the child.** Rejected: the before-body is racy on Windows; we would often snapshot the after-content.

**Only show the shell warning for `cursor_agent`.** Rejected: the user asked for Review / Keep / Undo, not a yellow tip.

## Consequences

Gitignored child writes still do not appear. A non-git session cwd only gets the shell warning. `tools/result` stays fire-and-forget, so the dock can lag one poll (2.5s) after the child returns. Extra `git status` runs once before and once after each opaque tool.
