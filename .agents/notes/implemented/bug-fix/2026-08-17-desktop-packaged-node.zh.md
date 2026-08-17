# Agent Note: Packaged desktop must ship Node and a PATH dsh shim

Status: implemented

[English](2026-08-17-desktop-packaged-node.md) | 中文

## Problem

`DSH_NODE_EXEC_PATH` 和 PATH 上的 `dsh` shim 原先只写在 `relaunch.ts`。`pnpm dsh desktop` 会走这条路。双击 NSIS / 便携版 exe 则直接进 `electron-main`，于是三类 Host 子进程看到的 `process.execPath` 是 `electron.exe`，PATH 上也没有 `dsh`：

1. windows-acl 沙箱 runner 可能再拉起一个 Electron；agent 工具壳死掉，工作台终端还能用。
2. 社区 `dshmarket` 装插件时找不到 `dsh`。
3. Win32 选文件夹回退到 `ELECTRON_RUN_AS_NODE`，koffi 按 Electron ABI 加载 —— ABI 对不上就崩。

市场「立即重启」是第二道缝：spawn 补丁只认 `-e` 助手源码里的 `dsh-market-restart`，然后 `app.relaunch()`，等助手 SIGTERM，而不是像第二实例路径那样 `app.exit(0)`。

## Decision

`electron-main` 是唯一配置点。profile 启动前跑 `installDesktopRuntime`：优先用还在磁盘上的已记录 Node，否则用 `resources/node/node.exe`（POSIX：`resources/node/node`）。它写入 `DSH_NODE_EXEC_PATH`，并在 PATH 前面放一个 shim，用这份 Node 跑编译好的 `@deepseek-ai/dsh` 入口，不带 tsx。

`pnpm desktop:pack` 把打包机的 `process.execPath` 拷进 `.desktop-pack/bundled-node/`。electron-builder 的 `extraResources` 把该目录映射到 `resources/node`。打包之后，若 extraResources 没带上，`syncBundledNode` 再拷进 `win-unpacked/resources/node`。

未打包的 relaunch 仍记下启动用的 Node。文件还在时 `electron-main` 沿用这条路径。

市场重启仍匹配助手源码里的 `dsh-market-restart`。`onRelaunch` 改为调用 `runDesktopRelaunch`：退出标记、`app.relaunch()`、`app.exit(0)`。

## Alternatives considered

**继续只在 relaunch.ts 里配环境，让装包用户自己装 Node。** 否决：安装包就是产品。机器上没有全局 `dsh`、也没有匹配的 Node ABI，才是常态。

**打包时下载一份钉死的官方 Node zip。** 第一版否决：拷打包机自己的二进制，ABI 与当时装上的 koffi 一致。打包宿主已经是 Windows x64（只有 NSIS / 便携版）。

**所有子进程都走 `electron.exe` + `ELECTRON_RUN_AS_NODE`。** 否决：这正是 koffi 崩溃和沙箱 runner 再开一个 Electron 的原因。

**把市场重启匹配从 `dsh-market-restart` 放宽。** 否决：改这个标记上次就回到「Error launching app」。标记保持不动，只把退出做成显式。

## Consequences

安装包里有真 Node，沙箱 runner、选文件夹、language-server 子进程都能用；PATH 上有 `dsh`，社区市场才能装插件。未打包的 `pnpm dsh desktop` 行为不变。「立即重启」会退出本进程，不再等 SIGTERM。安装包大约多一份打包机上的 Node 二进制。
