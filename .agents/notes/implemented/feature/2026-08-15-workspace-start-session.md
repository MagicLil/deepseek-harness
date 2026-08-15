# Agent Note: New Session follows the workspace

Status: implemented

English | [中文](2026-08-15-workspace-start-session.zh.md)

## Problem

Adding a folder listed it in the workspace rail, but the open conversation and Git stayed on the previous session's cwd. The top **New Session** button and a project's row **＋** called `startSession`, which reused the parked blank and then `open`'d the already-current id — a no-op, so the click looked dead.

## Decision

**`startSession` mints when the connected blank is already current.** The optional `{ preferExisting: true }` flag focuses a workspace without minting, and returns immediately when the current session already belongs there so expanding or collapsing a row does not hop to that workspace's blank. `{ forceNew: true }` always mints on the target workspace — the per-project **＋** button uses it so clicking another project is never a reuse no-op.

**`workspaces.create` starts the registered workspace with `preferExisting`.** A newly added folder opens (or reuses) that project's conversation, so Git follows its path. The workspace browser picker's `onPick` only closes the dialog; a second `startSession` there would mint a duplicate blank. Clicking a project row uses `preferExisting`; the row **＋** and the sidebar **New Session** button omit it.

## Alternatives considered

**Keep reuse-only `startSession` and teach the sidebar to pass a fresh flag.** Rejected: every New Session entry (sidebar, row ＋, preset) shares `IWorkspaces.startSession`. The mint belongs in that one method so a second blank is not a per-button special case.

**Give Git its own workspace picker.** Rejected: Git already reads the current session cwd. Switching the session is enough; a second source of truth would drift from the composer.

**Leave `onPick` calling `startSession` after `create`.** Rejected: `create` already starts the workspace. A second call without `preferExisting` would mint another blank for the same folder.

## Consequences

Adding a folder opens that project's conversation and Git. **New Session** and a project's **＋** always produce a new conversation for the targeted workspace. Clicking a project row switches conversation and Git without minting extras. `connectWorkspace` reuse rules and `agent-loop` stay unchanged.
