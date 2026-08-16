# Agent Note: 桌面窗口必须加载本机 webserver

Status: implemented

[English](2026-08-17-desktop-loopback-market.md) | 中文

## Problem

设置 → 插件市场（`dshmarket`）报目录加载失败，已装列表是空的。包还在 desktop profile 里，也还在跑（侧栏「Cursor 子代理」还在）。Host 在 `127.0.0.1:3080` 上已经能回答 `GET /dsh-market/registry`，但 Electron 窗口从没打到这个源。

## Decision

桌面窗口加载 `http://127.0.0.1:<webServer.port>/`。`desktop-app` 挂上 `frontend-static`，让这个源提供 SPA 和 `/plugins/*`。`dsh desktop` 把 argv 展开成 `--profile desktop`，并在 relaunch 时把 Node 版 `dsh` shim 放进 PATH。第一方 `/api` 仍可用 preload IPC。本机导航留在窗口内。

## Alternatives considered

**告诉用户社区市场只能用 Web。** 不采用：fork 补丁 41 / 43 / 45 已经把桌面定成本机 HTTP 宿主，这些插件本来就该能跑，而且这个 profile 里它们已经加载了。

**只把 `/dsh-market/*` 从 `dsh://` 转发走。** 不采用：安装 POST 过不了 `sameOrigin`（`app` 对 `127.0.0.1`），下一个 HTTP 插件还得再开特例。

## Consequences

编完重启后，桌面打开的就是浏览器也会用的那个本机 URL。`dsh-market` 认 desktop profile。3080 上的 `GET /` 是 SPA，不再是 404。安装包和源码启动的 `process.argv` 都带 `--profile desktop`。

## Follow-up: remotes 客户端 `require("zod")`

第一次走 HTTP 启动时，`@deepseek-ai/dsh-api-remotes` 挂了：`xmart-lan` 生成的 `/remote` 引用了 `zod`，包自己却没声明依赖。pnpm 隔离下解析失败，tsdown 把它当成外部 `require("zod")`，客户端模块表答不上。按其它 Host remote 包补上 `zod` 并重编 remotes 的 client 面后，zod 会打进包内。
