# Electron 下 Win32 选文件夹 worker 立刻退出

[English](2026-08-15-electron-win32-folder-dialog.md) | 中文

## 原因

`dsh desktop` 把 `@deepseek-ai/dsh-host-directory-picker-native` 跑在 Electron 里。Win32 选择器会按 `process.execPath` 再拉一个子进程，好让模态 `IFileOpenDialog` 成为该进程的第一扇窗。在 Electron 下 `execPath` 是 `electron.exe`。不设 `ELECTRON_RUN_AS_NODE` 时，子进程会按第二个 GUI 启动，worker 脚本根本没跑，驱动就报 `win32 folder dialog worker exited before reporting a result`。界面上「添加工作区」随后弹出「无法打开文件夹」。

## 改动

`spawnDialogWorker` 在 `process.versions.electron` 有值时给子进程环境加上 `ELECTRON_RUN_AS_NODE=1`。`execPath` 不变，但子进程按 Node 跑，原来的 tsx / `worker.cjs` 路径和 COM 对话框都不动。测试覆盖了 Electron 环境变量以及源码面 / 构建面两套 argv。

见工作区 `FORK-PATCHES.md` 条目 8。
