# Electron Win32 folder dialog worker exits immediately

English | [中文](2026-08-15-electron-win32-folder-dialog.zh.md)

## Why

`dsh desktop` hosts `@deepseek-ai/dsh-host-directory-picker-native` inside Electron. The Win32 picker spawns a child at `process.execPath` so the modal `IFileOpenDialog` is that process's first window. Under Electron, `execPath` is `electron.exe`. Without `ELECTRON_RUN_AS_NODE`, the child starts as a second GUI process, never runs the worker script, and the driver reports `win32 folder dialog worker exited before reporting a result`. The Add workspace button then shows「无法打开文件夹」.

## What changed

`spawnDialogWorker` copies `ELECTRON_RUN_AS_NODE=1` into the child environment when `process.versions.electron` is set. The child keeps the same `execPath` but runs as Node, so the existing tsx / `worker.cjs` path and COM dialog stay unchanged. Tests cover the Electron env flag and the source vs built argv arms.

See workspace `FORK-PATCHES.md` entry 8.
