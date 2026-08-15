# Agent Note: X-Mart 工作台 Tab 注册表

Status: implemented

[English](2026-08-15-xmart-workbench-tabs.md) | 中文

## 问题

Phase 0 的工作台列只是空外壳。社区工作台用 `registerTab` / `registerFileViewer` 让其他插件加页面，但它们把 `ctx` 传进 React 组件，并经 HTTP 持久化布局。本仓库禁止组件看见 `ctx`，桌面 shell 也没有 webserver。在资源管理器 / 编辑器 / Git / 终端正文落地之前，这一列仍然需要第一方注册表、按会话持久化的 Tab 条，以及设置页启用开关。

## 决策

**`ctx.xmartWorkbench` 是唯一注册 API。** 内置类型和第三方插件都走同一套 `registerTab` / `registerFileViewer`；每次调用返回 disposer。Tab 正文只收到 `{ tab, visible, sessionId }`，没有 `ctx`，也没有服务对象。`available` 的签名是 `(scope, state) => boolean`（没有 ctx 参数）；需要 ctx 的插件在 `apply` 里闭包捕获。`single` 是 `dedupeKey: () => id` 的语法糖。`createTab` 可以返回 `null` 拒绝；它的 `nextSeq` patch 只在真正追加新 tab 时生效。被设置禁用的类型从 `+` 菜单消失，且 `openTab` 返回 undefined；`available === false` 只让菜单行禁用。类型已不在注册表里的已开 tab 渲染占位卡。预览器匹配是单趟、priority 降序、detect 先于扩展名；带 `detect` 的 catch-all 在没有 head 字节时绝不认领。

**布局状态是单面板。** 该列按会话持久化 `{ tabs, activeTabId, nextSeq }`（`dsh.xmart.workbench.tabs.<sessionId>`）。启用表持久化在 `dsh.xmart.workbench.prefs`（缺省键 = 启用）。分栏暂缓。设置 → 工作台是 `settings.section` 贡献（order 25），每个已注册 tab / viewer 一行开关。`openFile` 会做预览器匹配供后续阶段复用，并打开隐藏的 `file` 占位（按 path 去重）。带内容的 seed（`path` / `url`）会调用 `ctx.layout.openWorkbench`；`+` 菜单的纯类型打开不会。

## 曾考虑的替代方案

**用 keyed `workbench.tab` slot 代替 `registerTab.component`。** v1 否决：第三方必须注册两次（元数据 + slot）。服务才是文档化扩展点；列通过 inject 回调查找 `component`。

**把 `ctx` 传进 tab 正文（better-sidebar）。** 否决：client 组件不能看见 ctx。插件若需要服务，在 `apply` 里闭包捕获。

**启用表走 host `settingsScope`。** v1 否决：这些开关是客户端查看偏好，和列宽持久化同类。跨设备同步以后可以迁到 `settingsScope`，不必改服务方法。

**把 tab 放进会话的 `conversation.view` 环。** 列笔记已经否决；注册表不再重开这个选择。

**这一刀就做分栏。** 否决：一条 Tab 条就足以证明注册 / 打开 / 持久化 / 占位 / 禁用。分栏手术后做。

## 后果

Web 与桌面都暴露 `ctx.xmartWorkbench`。用户可以从 `+` 打开内置演示标签、关掉它、切换会话，再拿回同一组 tab。在设置里关掉演示后，它从 `+` 消失，新的打开会被拒绝；已经打开的演示标签保留。持久化里未注册的类型显示占位卡。后续阶段通过同一 API 注册资源管理器 / 编辑器 / Git / 终端，并开始按 `openFile` 的匹配结果渲染预览器。`conversation.view` 与 `agent-loop` 保持不动。
