# Explorer rename and delete

Date: 2026-08-17
Status: implemented

English | [中文](2026-08-17-explorer-rename-delete.zh.md)

## Decision

The workbench explorer can rename and delete files and folders. The host adds UI-only `host.renameEntry` / `host.deleteEntry` on the existing ApiProxy `POST /api/host.*` seam (same-parent rename; recursive delete). They are not inspect-catalog or agent tools — the agent already has write/edit/shell.

The explorer menu rows that said "needs host API" now run: rename reuses the top name form; delete confirms first (file vs folder copy). After success the tree refreshes, drafts/expanded dirs retarget, and open editor tabs rewrite or close with the path. Windows treats a case-only rename (`Note.txt` → `note.txt`) as the same entry and still calls `rename`.

## Why L3

`IWorkspaces` and `HostApi` are upstream contracts. A new filesystem mutate cannot live only in the L2 workbench package: the desktop has no extra HTTP/WS, so the verbs must join the existing RPC map, schemas, error codes, fetch carrier, and test fakes.

## Files

- `packages/host/apiproxy/` (`host.ts`, schemas, rpc map/errors, `entry-ops.ts`, api-proxy, fetch pair, tests)
- `packages/client/runtime` `IWorkspaces` + `WorkspaceRuntime`
- `packages/test-support/client-runtime` + connection fixture / fakes
- `packages/client/ui-xmart-workbench` explorer, files store, `retargetPaths`
