# Agent Note: Persist shell-review dismiss

Status: implemented

English | [中文](2026-08-17-persist-shell-review-dismiss.zh.md)

## Problem

Clicking **知道了** on the shell-only review strip hid the banner for the current React mount only. Reopening the project reloaded `shellMaybeMutated: true` from `~/.dsh/agent-review/<sessionId>/` and the banner came back. After the Host Remote landed, a stale `api-remotes` client bundle still mounted an `agentReview` stub without `dismissShell`, so the button threw `review.dismissShell is not a function`.

## Decision

`ReviewEngine.dismissShell` clears `shellMaybeMutated` for that turn and writes the index. The workbench calls Remote `dismissShell` when the mounted stub has it, and always writes `localStorage` (`dsh.review.shellDismissed:<sessionId>:<turn>`) plus an in-memory hide so a stale remotes bundle cannot throw. A later `markShell` on the same turn raises the Host flag again. The `api-remotes` client bundle inlines generated remotes, so adding a method requires rebuilding that package too.

## Alternatives considered

**localStorage as the only store.** Rejected as the sole source: review state already lives in the host index. It is kept as a same-browser cache so dismiss still survives reload when the remotes stub is stale.

**New `shellHintDismissed` field.** Rejected: the flag's only UI job is "show this warning"; clearing it needs no store migration, and a new shell tool already re-sets it.

## Consequences

Dismiss is a Host Remote (`get` / `accept` / … / `dismissShell`) plus a browser cache. Shipping the method means rebuilding `@deepseek-ai/dsh-host-agent-review` remotes **and** `@deepseek-ai/dsh-api-remotes` `lib/client.js`. Old indexes without a dismiss still show the banner until the user clicks once.
