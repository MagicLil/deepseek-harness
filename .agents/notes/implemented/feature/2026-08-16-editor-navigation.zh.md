# Agent Note：编辑器跳转定义、悬停、查找引用、当前文件查找

Status: implemented

[English](2026-08-16-editor-navigation.md) | 中文

## 问题

工作台 Monaco 已经能对 `.java` / `.ts` / `.js` / `.vue` 做补全和红线，但 Ctrl+点击 / F12 不会跳。悬停和查找引用也在第一轮语言服务里被划掉。Ctrl+F 只有编辑器有焦点时才是 Monaco 查找；桌面端还可能被 Chromium 页内查找抢走。

## 决定

给现有 `vueLsp` / `tsLsp` / `javaLsp` Remote 加上 `definition` / `hover` / `references`。问的是已经 `didOpen` 的编辑器缓冲区（`session.navigate`），不走会重读磁盘的 `ctx.lsp.query`。Monaco 注册 Definition / Hover / Reference，外加 editor opener。`file:` 目标走 `openFile` 加一次性落点；jar / `jdt://` / `.class` 不硬开，提示「没有源码」。

查找 / 替换做成应用菜单命令（`file-find` / `file-replace`），web MenuBar 和 Electron 编辑菜单都有，这样焦点在对话里时 Ctrl+F / Ctrl+H 仍弹当前文件的 Monaco 查找框。

## 明确不做

重命名、重构、跳到实现、全项目搜索。`Ctrl+B` 仍是左侧边栏。

## 验证

- 相关包的 vitest + coverage
- 桌面端打开一份 `.java`：Ctrl+点类型、悬停、Shift+F12、Ctrl+F
