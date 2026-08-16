# Agent Note: Title-bar chat toggle

Status: implemented

English | [中文](2026-08-16-conversation-toggle.zh.md)

## Problem

The conversation column had no close action (`setConversation` clamped to 320px). Users could not hide chat the way Cursor does. The minimize/maximize/close cluster is native Windows chrome, so an HTML button could not sit next to Minimize without a title-bar overlay.

## Decision

Add `openConversation` / `closeConversation` / `toggleConversation` on `ctx.layout` (0 = closed; reopen restores 380px). Desktop `BrowserWindow` uses `titleBarStyle: 'hidden'` plus a 32px `titleBarOverlay` so native caption buttons stay. AppFrame paints a chat-bubble toggle in that overlay, just left of Minimize. View menu **Toggle Chat** (`Ctrl+Alt+B`) hits the same action.

## Alternatives considered

**Button only in the conversation column header.** Rejected: once the column is closed the control disappears.

**Keep the native title bar and place the button in the content top-right.** Rejected: that is not next to Minimize, which is what the user asked for.

## Consequences

Desktop must rebuild `ui-layout` (`lib/client.js`) and the desktop main (`title-bar` / `shell`) before the overlay and button appear. Restart `pnpm dsh desktop`. The window title text no longer paints in the title bar (taskbar still uses `document.title`).
