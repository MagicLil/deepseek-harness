# Agent Note: 桌面启动和选择器失败不能看起来像死了

Status: implemented

[English](2026-08-17-desktop-startup-dead-ui.md) | 中文

## Problem

三种日常失败不会把进程打崩，但产品看起来像坏了：

1. 窗口绑在 `127.0.0.1:3080` 的 loopback webserver 上。本机另开了 `dsh web`，或上次没退干净，监听 EADDRINUSE，整个 profile 起不来。设计写了「端口被占就换端口」，代码没写。
2. Host 断了（`workspace.list` 失败）之后 `state` 变成 `error`，`phase` 仍停在 `pending`。选择器只看 `phase`，就一直转圈。点工作区时 `selectWorkspace` 的失败被空 catch 吞掉，芯片像没反应。
3. 历史打开失败只显示「历史加载失败…」，没有「重新加载」。Session 类上的 `open()` 本来就能从 `error` 再拉一次，但没进 `ISession` / ChatView。

## Decision

**换端口写在 webserver 里。** `fallbackPorts`（默认 0）在 EADDRINUSE 时试 `port+1…`。桌面和 `dsh web` 都设 `fallbackPorts: 20`。窗口本来就读 `ctx.webServer.port`，跟到真正绑上的端口。webserver 仍然不打印；桌面和 `printUrl` 打真正绑上的 URL。

**选择器看 `state`，不只看 `phase`。** 基线失败显示错误和「重试」，重试走拓宽后的 `IWorkspaces.refresh()`。点工作区失败在芯片下用 `role="alert"` 说出来，不再空 catch。

**历史重载拓宽 `ISession.open`。** ChatView 注入 `reloadHistory` → `IConversation.reloadHistory()` → `session.open()`。夹具补了 fail-loud 的 `open` 桩。

## Alternatives considered

**桌面直接 `port: 0` 让 OS 分配。** 否决：用户和局域网持久化都认 3080；每次随机端口比从 3080 往上走更糟。

**desktop-startup 先探空闲端口再配 webserver。** 否决：探和听之间有 TOCTOU。只有真正 listen 才算数，也只有 webserver 能在 `Service.init` 里重试。

**给 `phase` 加一个 `error` 值。** 否决：`phase` 是单调的 pending→ready 到达位（和会话列表一样）。错误已经在 `state` 里。UI 看错了字段。

**把 `resync()` 暴露给对话视图。** 否决：`resync` 是重连重建。第一次打开失败时还没有窗口；`open()` 已经覆盖这条路径。

## Consequences

3080 被占时桌面和 `dsh web` 都会在 3081+ 起来。工作区选择器和历史错误都有重试。拓宽 `ISession` / `IWorkspaces` 是明确的功能面改动，夹具必须跟改。
