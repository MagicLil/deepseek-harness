# Electron Win32 folder dialog worker exits after a selection

English | [中文](2026-08-15-electron-win32-folder-dialog.zh.md)

## Why

`dsh desktop` hosts `@deepseek-ai/dsh-host-directory-picker-native` inside Electron. The Win32 picker spawns a child so the modal `IFileOpenDialog` is that process's first window.

Two distinct failures produce the same parent error (`win32 folder dialog worker exited before reporting a result`) and the same Add-workspace modal (「无法打开文件夹」):

1. **Worker never starts.** Under Electron, `process.execPath` is `electron.exe`. Spawning it as a GUI child exits before the IPC protocol. Fixed by `ELECTRON_RUN_AS_NODE=1` when no real Node path is available (FORK-PATCHES entry 8).
2. **Worker dies after Show.** The dialog appears and the user can pick a folder. `IShellItem::GetDisplayName` then returns a short `CoTaskMem` PWSTR. `readUtf16` used `koffi.view(address, 32768)`, which walks off that allocation. Under Electron that is a NAPI fatal (`Error::New napi_get_last_error_info` at `lib/worker.cjs` `readUtf16`), not a JS throw, so the child never posts `{kind:'done'|'error'}`.

Desktop loads the built `lib/worker.cjs`, not the TypeScript source. A bindings change does nothing until that artifact is rebuilt.

## What changed

- `readUtf16` asks `kernel32.lstrlenW` for the character count and views exactly `chars * 2` bytes. The bindings fake refuses any larger view so this over-read stays red in unit tests.
- `spawnDialogWorker` prefers `DSH_NODE_EXEC_PATH` (or `internals.nodeExecPath`) under Electron and skips `ELECTRON_RUN_AS_NODE` in that case, so koffi loads against the Node ABI it was built for. Packaged hosts get that path from [the bundled Node](2026-08-17-desktop-packaged-node.md); only a host with no Node path falls back to `electron.exe` + `ELECTRON_RUN_AS_NODE`.
- Desktop `relaunch` records `DSH_NODE_EXEC_PATH=process.execPath` (the Node that launched `dsh desktop`) before spawning Electron. Packaged `electron-main` records the bundled binary the same way.

See workspace `FORK-PATCHES.md` entries 8 and 11.
