# 资源管理器重命名与删除

Date: 2026-08-17
Status: implemented

[English](2026-08-17-explorer-rename-delete.md) | 中文

## 决策

工作台资源管理器可以重命名、删除文件和文件夹。Host 在现有 ApiProxy `POST /api/host.*` 缝上增加只给 UI 的 `host.renameEntry` / `host.deleteEntry`（只在同一父目录改名；删除可整棵目录）。不进 inspect catalog，也不是 agent 工具——模型已经有 write/edit/壳。

原先写着「待主机接口」的菜单行现在能用：重命名复用顶部名称表单；删除先确认（文件/文件夹文案不同）。成功后树刷新，草稿和展开目录跟着改路径，已打开的编辑器标签改路径或关掉。Windows 上只改大小写（`Note.txt` → `note.txt`）仍算同一项，会真正 `rename`。

## 为什么是 L3

`IWorkspaces` 和 `HostApi` 是上游契约。文件系统改名/删除不能只做在 L2 工作台包里：桌面没有额外 HTTP/WS，动词必须进现有 RPC 表、schema、错误码、fetch 载体和测试假件。

## 文件

- `packages/host/apiproxy/`（`host.ts`、schema、rpc 表/错误码、`entry-ops.ts`、api-proxy、fetch 两端、测试）
- `packages/client/runtime` 的 `IWorkspaces` + `WorkspaceRuntime`
- `packages/test-support/client-runtime` 以及 connection fixture / fake
- `packages/client/ui-xmart-workbench` 资源管理器、files store、`retargetPaths`
