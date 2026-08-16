# Agent change review (shadow snapshots)

Date: 2026-08-16
Status: implemented (host + Cursor-style composer dock)

English | [中文](2026-08-16-agent-change-review.zh.md)

## Decision

Per-turn Agent file mutations (`write`/`edit`) are captured as host-side shadows under `~/.dsh/agent-review/`. Accept/revert without git stage. UI is a Cursor-like strip on `conversation.input.dock` (above the composer); there is no activity-bar Review entry.

**Shell B (2026-08-16):** `pwsh`/`bash`/… set `shellMaybeMutated`; literal `Remove-Item`/`rm`/`del` paths are captured as `kind: delete` with Keep/Undo. Unparseable shell still shows a dismissible dock warning.

## Why L2

New host package + workbench dock; typert Remotes via api-remotes. No agent-loop or session-format changes. One incidental exactOptionalPropertyTypes fix in `workspace-checks` unblocked typert generation.

## Files

- `packages/host/agent-review/**` (incl. `shell-delete-paths.ts`)
- `packages/api/remotes` mount + bundle patches
- `packages/client/ui-xmart-workbench` `ReviewDock` on `conversation.input.dock`
- Spec/plan under `docs/superpowers/`
