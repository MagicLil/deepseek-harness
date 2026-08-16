# Agent Review Shell Delete (B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Heuristic shell deletes (`pwsh`/`bash` `Remove-Item`/`rm`/…) enter the Cursor review dock as `D` rows with Keep/Undo; unparseable shell still shows a dismissible warning.

**Architecture:** Keep L2 `host/agent-review` as authority. Add pure `parseShellDeletePaths(command)` → absolute paths; on `tools/pre-execute` for `SHELL_MAYBE_TOOLS` mark shell + `captureDelete`; on `tools/result` settle deletes. UI shows dock when `pending > 0` **or** (`shellMaybeMutated` && not dismissed).

**Tech Stack:** TypeScript, Vitest, existing ReviewEngine + ReviewDock.

**Spec:** `docs/superpowers/specs/2026-08-16-agent-change-review-design.md` (B amendment)

## File map

| File | Role |
| --- | --- |
| `packages/host/agent-review/src/shell-delete-paths.ts` | Pure command → relative/absolute path strings |
| `packages/host/agent-review/src/types.ts` | Add `pwsh` to `SHELL_MAYBE_TOOLS` |
| `packages/host/agent-review/src/review.ts` | `captureDelete`; settle/revert/diff for `delete` |
| `packages/host/agent-review/src/index.ts` | Wire shell parse + settle |
| `packages/host/agent-review/tests/*` | Parser + delete lifecycle |
| `packages/client/ui-xmart-workbench/src/client/ReviewDock.tsx` | Shell-only warn + dismiss |
| `packages/client/ui-xmart-workbench/src/client/locales.ts` | Dismiss label |
| `packages/client/ui-xmart-workbench/tests/review-dock.client.spec.tsx` | Shell-only dock |

## Tasks

- [x] Task 1: Parser + tests
- [x] Task 2: Engine captureDelete / settle / revert delete + tests
- [x] Task 3: Gateway wire pwsh + shell settle
- [x] Task 4: ReviewDock shell-only + dismiss + tests
- [x] Task 5: README + rebuild client face
