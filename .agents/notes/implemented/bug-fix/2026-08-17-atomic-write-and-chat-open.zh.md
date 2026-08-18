# Agent Note: 编辑器原子写盘与对话路径进工作台

Status: implemented

[English](2026-08-17-atomic-write-and-chat-open.md) | 中文

## 问题

`host.writeFile` 直接覆盖目标文件。写到一半崩溃或杀进程，可能截断用户已有的文件。对话芯片一律走 `workspaces.openPath`，即使工作台编辑器已经挂着，也会打开系统应用。

## 决策

**现有 RPC 上做原子替换。** `host.writeFile` 先确认父目录存在，再走 `writeFileAtomic`（同级临时文件 + rename）。新文件 `0o644`，已有文件保留原 mode。父目录必须已存在的合同不变。

**可选 `chatFileOpen` 缝。** 对话 `openFile` 先问 `ctx.get('chatFileOpen')`。工作台占用它并打开标签。缺席或返回 `false` 仍回退 `workspaces.openPath`。资源管理器「用系统应用打开」不动。

不透明审查在第一次没导入到文件时等 250 ms 再读一次 git status；审查条轮询从 2.5 秒改成 400 ms。`dsh web` 在 EADDRINUSE 时也顺延 20 个端口，和桌面一致。

## 考虑过的其他做法

**在网关测试里 spy `fs.writeFile`，证明抛错后旧字节还在。** 否决：Vitest 不能 spy ESM 的 `node:fs/promises` 导出。崩溃原子性仍由 `dsh-atomic-write` 保证；网关测试钉完整替换、不留临时文件、父目录缺失即拒绝。

**从工作台覆盖 `workspaces.openPath`。** 否决：资源管理器右键必须继续走系统打开。

## 后果

L3：`apiproxy` 写盘、`ui-conversation` inject、`web-app` 的 `fallbackPorts`。L2：工作台占用 `chatFileOpen`、审查轮询、不透明重试。桌面要重编 host apiproxy，以及 conversation 和 workbench 的 `lib/client.js`。
