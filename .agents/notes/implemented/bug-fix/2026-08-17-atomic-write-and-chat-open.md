# Agent Note: Atomic editor writes and in-column chat paths

Status: implemented

English | [中文](2026-08-17-atomic-write-and-chat-open.zh.md)

## Problem

`host.writeFile` overwrote the target in place. A crash or kill during the write could truncate a file the user already had. Conversation chips always called `workspaces.openPath`, which opens the OS app, even when the workbench editor was mounted.

## Decision

**Atomic replace on the existing RPC.** `host.writeFile` now goes through `writeFileAtomic` (sibling temp + rename) after confirming the parent directory exists. New files keep `0o644`; existing files keep their mode. The parent-must-exist contract is unchanged.

**Optional `chatFileOpen` seam.** Chat `openFile` asks `ctx.get('chatFileOpen')` first. The workbench occupies it and opens a tab. Absent or `false` still falls back to `workspaces.openPath`. Explorer "open in system app" is unchanged.

Opaque review waits 250 ms and re-reads git status when the first import found nothing, and the review dock polls every 400 ms instead of 2.5 s. `dsh web` now walks 20 ports on EADDRINUSE, same as desktop.

## Alternatives considered

**Spy `fs.writeFile` in the gateway test to prove a thrown write leaves the old bytes.** Rejected: Vitest cannot spy ESM `node:fs/promises` exports. Crash atomicity stays in `dsh-atomic-write`; the gateway spec pins complete replace, no leftover temps, and missing-parent refusal.

**Override `workspaces.openPath` from the workbench.** Rejected: Explorer right-click must keep the OS opener.

## Consequences

L3: `apiproxy` write path, `ui-conversation` inject, `web-app` `fallbackPorts`. L2: workbench occupies `chatFileOpen`, review poll, opaque retry. Desktop must rebuild host apiproxy plus conversation and workbench `lib/client.js`.
