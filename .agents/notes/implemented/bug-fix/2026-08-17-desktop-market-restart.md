# Agent Note: Desktop one-click market restart must not pass -e to Electron

Status: implemented

English | [中文](2026-08-17-desktop-market-restart.zh.md)

## Problem

Settings → Plugin Market (`dshmarket`) update, then **Restart now**, showed Electron's "Error launching app" dialog. The path was the repo directory plus the helper's JavaScript source (`const { spawn } = require('node:child_process')…`). The community plugin spawns `process.execPath -e <helper>` so a detached Node can start `dsh --profile desktop` after this process dies. Under `dsh desktop`, `process.execPath` is `electron.exe`. Electron does not eval `-e`; it treats the script text as an application path.

## Decision

`electron-main` patches `child_process.spawn` before the profile boots. A `dsh-market-restart` `-e` helper becomes `app.relaunch()` (plus the existing quit flag so the window does not hide to tray). Other `electron -e` children run as Node: `DSH_NODE_EXEC_PATH` when the unpackaged relaunch recorded it, otherwise the same binary with `ELECTRON_RUN_AS_NODE=1`. The planner lives in `apps/desktop/src/node-eval-spawn.ts`.

## Alternatives considered

**Patch dsh-market in the user profile.** Rejected: `~/.dsh/profiles/desktop/node_modules/dshmarket` is overwritten on the next update, and we do not own that package.

**Only rewrite `-e` onto Node and keep their helper.** Rejected for the restart button: the helper then needs PATH `dsh`, a 1.5s wait, and on Windows a PowerShell wrap. `app.relaunch()` replays this Electron argv after exit and works packaged. The Node rewrite stays for any other `execPath -e` caller.

**Hide the button with `allowRestart: false`.** Rejected: the user asked to fix restart, not remove it.

## Consequences

Clicking Restart now after a market update schedules a real desktop relaunch instead of a second Electron GUI. Install still uses the PATH `dsh` shim from [the loopback-market note](2026-08-17-desktop-loopback-market.md). Packaged hosts without a recorded Node still get `ELECTRON_RUN_AS_NODE` for non-market `-e` children.
