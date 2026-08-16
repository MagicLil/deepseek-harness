# Agent Note: Session preset scopes

Status: implemented

English | [中文](2026-08-16-session-preset-scopes.zh.md)

## Problem

The session header showed the running preset as a chip that looked clickable and did nothing. Settings only wrote the default for sessions created later. Users expected two scopes: a settings change applies to every project session, and a header change applies to the current session only.

## Decision

`agentPreset.select` recomposes a blank or a started session. Later turns run the new composition; earlier tool calls still resolve against the standing mount of the preset that produced them. The session header is a picker that calls `select` for that session only. A settings write (General row or "Set as default") stores the default and then calls `select` on every listed root session that is not already on that preset. Child / subagent rows are skipped.

## Alternatives considered

**Keep the blank-session lock and only make the header clickable on unused sessions.** Rejected: the header chip is most visible on started conversations, which is exactly where the click did nothing.

**Add a follow-default flag on each session and lazy-apply on open.** Rejected: that needs a new session event or header field. The existing `agent-preset/selected` log event already records what a session runs.

**Host-side batch RPC that appends to cold logs without resuming agents.** Deferred: listed-session `select` reuses the existing wire. A large roster will resume cold sessions for the duration of the write.

## Consequences

Changing the default in settings walks the session list and may resume cold sessions. A header pick does not move the default. `agent-preset-locked` remains on the wire schema but `select` no longer produces it.
