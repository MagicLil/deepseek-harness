# Agent Note: Packaged desktop must ship Node and a PATH dsh shim

Status: implemented

English | [中文](2026-08-17-desktop-packaged-node.zh.md)

## Problem

`DSH_NODE_EXEC_PATH` and the PATH `dsh` shim were written only in `relaunch.ts`. That runs for `pnpm dsh desktop`. A double-clicked NSIS or portable exe starts `electron-main` directly, so three Host children see `process.execPath` as `electron.exe` and no `dsh` on PATH:

1. The windows-acl sandbox runner may spawn a second Electron; the agent tool shell dies while the workbench terminal still works.
2. Community `dshmarket` cannot find `dsh` when installing a plugin.
3. The Win32 folder picker falls back to `ELECTRON_RUN_AS_NODE` and koffi loads against the Electron ABI — a mismatch crash.

Market "Restart now" was a second gap: the spawn patch only recognized `dsh-market-restart` in the `-e` helper, then called `app.relaunch()` and waited for that helper's SIGTERM instead of `app.exit(0)` (the second-instance path already exits).

## Decision

`electron-main` is the source of truth. Before the profile boots it runs `installDesktopRuntime`: prefer a still-present recorded Node, otherwise `resources/node/node.exe` (POSIX: `resources/node/node`). It sets `DSH_NODE_EXEC_PATH` and prepends a PATH shim that invokes the compiled `@deepseek-ai/dsh` entry with that Node and no tsx.

`pnpm desktop:pack` copies the packer's `process.execPath` into `.desktop-pack/bundled-node/`. electron-builder `extraResources` maps that folder to `resources/node`. After pack, `syncBundledNode` copies it into `win-unpacked/resources/node` if extraResources missed it.

Unpackaged relaunch still records the launching Node. `electron-main` keeps that path when the file exists.

Market restart still matches `dsh-market-restart` in the helper source. `onRelaunch` now calls `runDesktopRelaunch`: quit flag, `app.relaunch()`, `app.exit(0)`.

## Alternatives considered

**Keep env setup only in relaunch.ts and tell pack users to install Node.** Rejected: the installer is the product. A machine without a global `dsh` or a matching Node ABI is the normal case.

**Download a pinned official Node zip at pack time.** Rejected for v1: copying the packer binary matches the ABI koffi was installed against. The pack host is already Windows x64 (NSIS/portable only).

**Run every child as `electron.exe` + `ELECTRON_RUN_AS_NODE`.** Rejected: that is the koffi crash and the second-Electron sandbox runner.

**Broaden the market-restart matcher beyond `dsh-market-restart`.** Rejected: changing the marker is how we got "Error launching app" last time. Keep the marker; make exit explicit.

## Consequences

A packaged install has a real Node for the sandbox runner, folder picker, and language-server children, and a PATH `dsh` for community market install. Unpackaged `pnpm dsh desktop` is unchanged. "Restart now" exits this process instead of waiting for SIGTERM. The installer grows by one Node binary (the packer's).
