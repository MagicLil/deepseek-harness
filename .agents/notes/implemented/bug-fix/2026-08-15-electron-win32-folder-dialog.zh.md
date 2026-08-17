# Electron 下 Win32 选文件夹 worker 选完后退出

[English](2026-08-15-electron-win32-folder-dialog.md) | 中文

## 原因

`dsh desktop` 把 `@deepseek-ai/dsh-host-directory-picker-native` 跑在 Electron 里。Win32 选择器会再拉一个子进程，好让模态 `IFileOpenDialog` 成为该进程的第一扇窗。

两种失败会落到同一条父进程报错（`win32 folder dialog worker exited before reporting a result`）和同一块「添加工作区」弹窗（「无法打开文件夹」）：

1. **worker 根本没跑起来。** 在 Electron 下 `process.execPath` 是 `electron.exe`。按 GUI 子进程拉起时，IPC 协议还没报就退出。没有真 Node 路径时用 `ELECTRON_RUN_AS_NODE=1`（FORK-PATCHES 条目 8）。
2. **Show 之后 worker 死掉。** 对话框能弹出，用户也能选文件夹。`IShellItem::GetDisplayName` 随后给出一段很短的 `CoTaskMem` PWSTR。`readUtf16` 用 `koffi.view(address, 32768)` 读穿了这块分配。在 Electron 里这是 NAPI 致命错误（`lib/worker.cjs` 的 `readUtf16` 上 `Error::New napi_get_last_error_info`），不是 JS throw，子进程因此从不发送 `{kind:'done'|'error'}`。

桌面端加载的是构建产物 `lib/worker.cjs`，不是 TypeScript 源码。只改 bindings 而不重建这份产物，运行中的应用仍走旧 worker。

## 改动

- `readUtf16` 先用 `kernel32.lstrlenW` 取字符数，再只 view `chars * 2` 字节。bindings 的假 koffi 拒绝更大的 view，这个过读会在单测里保持红色。
- `spawnDialogWorker` 在 Electron 下优先用 `DSH_NODE_EXEC_PATH`（或 `internals.nodeExecPath`），此时不再设 `ELECTRON_RUN_AS_NODE`，让 koffi 对着它编译时的 Node ABI 加载。安装包从[自带 Node](2026-08-17-desktop-packaged-node.md) 得到这条路径；只有没有 Node 路径的宿主才回退到 `electron.exe` + `ELECTRON_RUN_AS_NODE`。
- 桌面 `relaunch` 在拉起 Electron 之前记下 `DSH_NODE_EXEC_PATH=process.execPath`（启动 `dsh desktop` 的那份 Node）。打包后的 `electron-main` 用同样的方式记下自带的二进制。

见工作区 `FORK-PATCHES.md` 条目 8 与 11。
