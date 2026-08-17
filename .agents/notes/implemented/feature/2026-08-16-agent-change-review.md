# Agent change review (shadow snapshots)

Date: 2026-08-16
Status: implemented (host + Cursor-style composer dock)

English | [中文](2026-08-16-agent-change-review.zh.md)

## Decision

Per-turn Agent file mutations (`write`/`edit`) are captured as host-side shadows under `~/.dsh/agent-review/`. Accept/revert without git stage. UI is a Cursor-like strip on `conversation.input.dock` (above the composer); there is no activity-bar Review entry.

**Shell B (2026-08-16):** `pwsh`/`bash`/… set `shellMaybeMutated`; literal `Remove-Item`/`rm`/`del` paths are captured as `kind: delete` with Keep/Undo. Unparseable shell still shows a dismissible dock warning.

**Opaque C-lite (2026-08-17):** `cursor_agent` / `subagent*` snapshot `git status` before the tool and import create/update/delete after it returns; paths named in the prompt/result are imported when git cannot see them. See [opaque subagent review](../bug-fix/2026-08-17-agent-review-opaque-subagent.md). Dismiss persists via Remote `dismissShell` (clears the flag on disk; see [persist-shell-review-dismiss](../bug-fix/2026-08-17-persist-shell-review-dismiss.md)). The composer dock is the only Review UI; an in-card pill was [rejected](../../rejected/bug-fix/2026-08-17-tool-card-review-action.md).

## Why L2

New host package + workbench dock; typert Remotes via api-remotes. No agent-loop or session-format changes. One incidental exactOptionalPropertyTypes fix in `workspace-checks` unblocked typert generation.

## Files

- `packages/host/agent-review/**` (incl. `shell-delete-paths.ts`)
- `packages/api/remotes` mount + bundle patches
- `packages/client/ui-xmart-workbench` `ReviewDock` on `conversation.input.dock`
- Spec/plan under `docs/superpowers/`
