# Agent Note: Cursor-style workbench terminal

Status: implemented

English | [中文](2026-08-15-xmart-workbench-terminal.zh.md)

## Problem

The bottom panel was a reserved seat with a `#` on the activity bar. There was no real PTY and no place that felt like Cursor's Terminal menu.

## Decision

**Same row as File, not a strip under it.** Desktop adds Terminal to the Electron application menu (File / Edit / View / Terminal / Window / Help). Clicks travel `dsh:app-menu` → preload `onAppMenu`. AppFrame hides the HTML `menuBar` on `dsh:`. Web still uses the in-frame menu. The `#` left the activity bar.

**Real PTY on the existing IPC seam.** Six `host.terminal*` RPCs plus a forwarded `terminals/output` event. No HTTP-only route, no page WebSocket. Owner is the session Agent. Quota is 3 per session. Hiding the bottom panel does not kill the host PTY.

**Line-oriented send.** Enter writes one line through `startSend` and waits for idle. Ctrl+C is SIGINT. Python REPL is the acceptance bar. The first UI is a monospace log plus an input, not xterm.

**Agent-plane PTY.** `@deepseek-ai/dsh-terminal` and `@deepseek-ai/dsh-terminal-bash` mount inside each desktop preset's `persistent-shell` isolate (`terminals: true`). They must not sit on the host base bundle — a row belongs to exactly one plane. Windows uses `powershell.exe -NoLogo -NoProfile`. A session whose agent has no `ctx.terminals` shows an unavailable note.

## Alternatives considered

**Fake File/Edit/View menus.** Rejected: only Terminal is real.

**Share agent PTYs / split / profiles.** Rejected: v1 is one interactive seat per tab.

**HTTP or WebSocket.** Rejected: desktop has no webserver and no page WebSocket upgrade.

## Consequences

Desktop users can open a real shell from the native **终端** menu (same row as File) after rebuilding the desktop lib and restarting `pnpm dsh desktop`. Full-screen TUIs are out of scope. PTY ids are process-local and do not survive a reload.
