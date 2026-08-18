# Agent Note: Desktop startup and picker failures must not look dead

Status: implemented

English | [中文](2026-08-17-desktop-startup-dead-ui.zh.md)

## Problem

Three everyday failures left the desktop looking broken without crashing the process:

1. The window is bound to the loopback webserver on `127.0.0.1:3080`. A leftover `dsh web` or a stale listen made activation throw EADDRINUSE and the whole profile failed to start. Design said “walk to the next port”; the code did not.
2. After Host disconnect (`workspace.list` fails), `state` becomes `error` but `phase` stays `pending`. The picker only checked `phase`, so it kept spinning. Clicking a workspace also swallowed `selectWorkspace` failures, so the chip looked dead.
3. A failed history open showed “Failed to load history…” with no Reload. The retry verb was already on the Session class (`open()` retries from `error`) but was not on `ISession` / ChatView.

## Decision

**Port walk lives in webserver.** `fallbackPorts` (default 0) retries `port+1…` on EADDRINUSE. Desktop and `dsh web` both set `fallbackPorts: 20`. The window already loads `ctx.webServer.port`, so it follows the port that bound. Webserver still never prints; desktop and `printUrl` log the URL that actually bound.

**Picker reads `state`, not only `phase`.** A failed baseline shows the error and a Retry that calls `IWorkspaces.refresh()` (widened so the feature face can retry). A failed workspace pick surfaces `role="alert"` under the chip instead of an empty catch.

**History Reload widens `ISession.open`.** ChatView injects `reloadHistory` → `IConversation.reloadHistory()` → `session.open()`. Fixtures gained the fail-loud `open` stub.

## Alternatives considered

**OS-assigned `port: 0` on desktop.** Rejected: users and LAN persist expect 3080; a random port every launch is worse than walking from 3080.

**Probe a free port in desktop-startup, then configure webserver.** Rejected: TOCTOU between probe and listen. The listen itself is the only reliable test, and only webserver can retry inside `Service.init`.

**Flip `phase` to a new `error` value.** Rejected: `phase` is a monotone pending→ready arrival bit (same as the session list). `state` already carries the error. The UI was reading the wrong field.

**Expose `resync()` to the chat view.** Rejected: `resync` is the reconnect rebuild. A failed first open has no window; `open()` already retries that path.

## Consequences

Desktop and `dsh web` both start on 3081+ when 3080 is taken. Workspace picker and history errors show a retry. Widening `ISession` / `IWorkspaces` is an explicit feature-face change; test fixtures follow.
