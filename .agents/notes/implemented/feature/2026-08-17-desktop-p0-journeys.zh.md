# Agent Note: Desktop P0 journey completeness

Status: implemented

[English](2026-08-17-desktop-p0-journeys.md) | 中文

## Problem

工作台壳（资源管理器、搜索、Git、编辑器、终端、审查）已经在了，但首次使用和打开文件的路径看起来还没做完。编辑器 `+` 菜单还挂着演示标签。挡路欢迎仍写 DeepSeek Harness。图片标签只有路径和「用系统应用打开」，因为 `host.readFile` 拒绝 NUL。资源管理器重命名/删除和对话路径芯片已经有 host 动词和 `chatFileOpen` 缝，不是这次缺的活。

## Decision

把演示标签类型设为 `hidden: true`。菜单为空时 `+` 按钮消失。已经持久化的演示标签仍会渲染。

把 `WELCOME_NOTICE_VERSION` 升到 `2026-08-17.1`，并在 `ui-settings-models` 的 `onboarding-copy.ts` 换成万物智汇 / Xmart 产品欢迎。Web e2e scaffold 自己复制了一份常量（不能 import 客户端包），欢迎快照跟中文弹窗走。

在现有 ApiProxy `POST /api/host.*` 缝上增加仅 UI 的 `host.readFileBytes`：base64 加 MIME 猜测，上限 8 MiB，允许 NUL。`IWorkspaces.readFileBytes` 在浏览器里用 `atob` 解码。图片标签做成 blob URL，保留系统打开按钮，并跟 files-store 的 reload token 重载。不进 inspect catalog，也不是 agent 工具。

资源管理器重命名/删除维持已交付状态（[资源管理器重命名与删除](2026-08-17-explorer-rename-delete.md)）。对话芯片仍走 `chatFileOpen`（FORK-PATCHES 条目 65）。

## Alternatives considered

**复用 `host.readFile`，图片时取消 NUL 拒绝。** 否决：编辑器契约是 UTF-8 文本。把二进制混进同一方法，每个调用方都得区分 `file-binary` 和真文本。

**为字节另开 HTTP/WebSocket。** 否决：桌面端 client↔host 功能必须走第一方 RPC。私有路由只在 Web 能用。

**欢迎文案做 L2 覆盖。** 否决：弹窗文案和确认版本写在上游 `onboarding-copy.ts`。再叠一张弹窗会打架。

**删掉演示标签注册。** 否决：旧的持久化标签会变成未知类型占位。隐藏它可以继续渲染那些标签。

## Consequences

确认版本变了，老用户会再看到一次欢迎。超过 8 MiB 的图片仍走系统打开。`host.readFileBytes` 又是一条 L3 线方法，同步上游 apiproxy / `IWorkspaces` 时会冲突。演示类型仍留在注册表里，给旧的 localStorage 行用。

## Testing

`image-mime.spec.ts` 和 `api-proxy-read-file-bytes.spec.ts` 钉住 MIME、NUL、大小上限、中止和目录拒绝。`fetch-carrier.spec.ts` 走一遍新方法。`workspaces-service.client.spec.ts` 解码 `aGk=` 并包装 `file-too-large`。`media-tabs.client.spec.tsx` 钉住预览、失败、空路径、中止和重载。`tab-bar.client.spec.tsx` 在菜单为空时藏掉 `+`。`welcome-notice.client.spec.tsx` 和 Web 欢迎快照钉住新文案。
