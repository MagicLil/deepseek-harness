# Agent Note: Same-project switch keeps the live terminal

Status: implemented

English | [中文](2026-08-17-same-project-keep-terminal.zh.md)

## Problem

Switching conversations (or clicking New Session) in the same project folder still reset the workbench chrome. [Same-project inherit](../feature/2026-08-16-xmart-same-project-inherit.md) copied editor tabs and skipped terminals because the host PTY is owned by the source session. [The remount flash fix](2026-08-17-same-project-session-switch-flash.md) kept React trees mounted, but `observeSession(nextId)` still pointed at an empty per-session store, so the editor emptied and the bottom panel lost its PTY tabs. A brand-new session often has no cwd yet, so `shouldInheritSameProject` was false and inherit never ran.

## Decision

Workbench chrome is **project-scoped**. `XmartWorkbenchController.setScopeResolver` maps a conversation id to the workspace folder (`projectKeyOf`, else the last known project while cwd is still attaching). `observeSession` / `openTab` / persist / explorer expansion / search / git badge all use that key, so two chats in `/ws` share one store and one `HostObservable`. `inheritSession` copies the full tab list (terminals included) only when the keys still differ. Terminal seats are keyed by project + tab id and remember `ownerSessionId`; `TerminalTab` does not tear down xterm when only the conversation id changes, and host.terminal* still addresses the owner session.

D6 is amended: chrome is per project; conversation content stays per session.

## Alternatives considered

**Keep copying on switch and also copy terminal tab rows.** Rejected: the PTY is still listed under the owner session. A remounted `TerminalTab` would call `listTerminals(newSession)` and spawn a second shell.

**Key the workbench store by workspace id only, drop session fallback.** Rejected: a session with no folder yet would get a global empty store and mix unrelated projects.

## Consequences

Same-project conversation clicks and New Session keep explorer, Git, search, open files, and live terminals. Switching folders still loads that folder's chrome. Host PTYs stay owned by the session that opened them; closing a terminal tab kills through that owner. Desktop must load a rebuilt `ui-xmart-workbench` `lib/`.
