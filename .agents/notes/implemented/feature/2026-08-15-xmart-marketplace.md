# Agent Note: X-Mart marketplace (plugins + extensions)

Status: implemented

English | [中文](2026-08-15-xmart-marketplace.zh.md)

## Problem

The workbench activity bar only had Explorer / Git / Tasks. Users coming from Cursor expect an Extensions sidebar that can find Vue Official, and this product also has a separate DSH plugin ecosystem. The desktop shell has no webserver, so community HTTP markets cannot be copied. The editor is AMD Monaco, so a downloaded `.vsix` does not activate.

## Decision

**Two activity-bar entries, two Host remotes, one honesty rule.** `ui-xmart-workbench` exposes `registerActivity`. A new L2 client package `ui-xmart-marketplace` registers `plugins` and `extensions`. A new L2 host package `host/marketplace` publishes `remote.marketplace` through `api-remotes` (desktop IPC, no new HTTP routes).

- **Plugins** install into the running profile with the CLI `pnpm add` / bundle-reconcile semantics. HTTP/WebSocket plugins are refused. Success requires a relaunch.
- **Extensions** search Open VSX only, store `.vsix` under `~/.dsh/extensions`, and label compatibility. They are not activated. Remote SSH, Dev Containers, WSL, VS Code language packs, and Cursor-only ids are `unsupported`.

Settings → Plugins stays a read-only inventory.

## Alternatives considered

**Ship a fake “installed and running” Vue Official card.** Rejected: the editor cannot host it yet.

**Copy dsh-market HTTP install.** Rejected: desktop has no webserver.

**Import the local Cursor extensions folder.** Rejected: out of scope and license/compat noise.

**Microsoft Marketplace.** Rejected: license.

## Consequences

The activity bar shows 插件 / 扩展. Plugin install is real for the desktop profile. Extension download is real storage. Language intelligence still waits on the extension-host gate.
