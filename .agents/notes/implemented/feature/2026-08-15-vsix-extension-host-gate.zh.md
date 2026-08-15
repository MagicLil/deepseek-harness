# Agent Note: VS Code 扩展宿主门（Phase D spike）

Status: implemented（只做决策 —— 不替换 Monaco）

[English](2026-08-15-vsix-extension-host-gate.md) | 中文

## 问题

Phase C 已经能从 Open VSX 下载 Vue Official（`Vue.volar`）。用户会以为 `.vue` 文件从此有 Volar 诊断。当前编辑器是从 `/monaco/vs` 加载的 AMD Monaco（`monaco-loader.ts` / `MonacoHost`）。磁盘上的 `.vsix` 什么也不会做。

候选宿主是 [`@codingame/monaco-vscode-api`](https://github.com/codingame/monaco-vscode-api)。体量大，和本工作台决策 D4（继续用 AMD Monaco）冲突，Electron 上还有已知坑：web 扩展宿主在 Electron 里不好用，而 Vue Official 是 Node 扩展，要 LocalProcess / language server。

## Spike 结论

**能不能在不拆现有 `MonacoHost` 文件/保存/diff 的前提下挂上宿主？** 一周内不行，除非再叠一套编辑器。monaco-vscode-api 会替换或重包 Monaco 加载器。打开文件、脏草稿、Ctrl/Cmd+S、unified diff 都坐在 AMD `MonacoHost` 上。旁边再挂一套 VS Code workbench API，要么同一份 buffer 两套模型，要么重写这些路径。

**Vue Official 装完后，`.vue` 有没有语法诊断（不只是着色）？** 在这套编辑器上没有。着色可以继续用语言表里的 `.vue` → `html`。诊断需要 `@vue/language-server`（或者扩展宿主真的跑起 `Vue.volar`）。下载 vsix 并不会启动那个 server。

**包体和启动时间？** monaco-vscode-api 加上 web/Node 扩展宿主是数 MB 的额外面，桌面端还要多一个 worker/进程。这是产品决策，不是侧栏功能。

**失败路径（已采用）：** 停在 Phase C。市场能搜、能存 vsix。如果马上需要 Vue，语言支持走第一方 language pack（现有 LSP 缝上接 `@vue/language-server`）。不要假装「任意 VS Code 扩展都能跑」。

## 决策

本程序**不**替换 AMD Monaco。只有单独再做一周 spike，量过 Electron LocalProcess、真实 `.vue` 文件上的 Vue 诊断、以及桌面包体/启动增量，并且在 `FORK-PATCHES.md` 记一笔 L3，才重新开门。

## 考虑过的替代

**在 AMD Monaco 里激活 vsix。** 做不到：没有扩展宿主，也没有 `vscode` API。

**现在就上 monaco-vscode-api，把代价藏起来。** 否决：D4 加上 Electron 宿主风险。

**现在就做第一方 Vue language pack。** 等有人明确要 `.vue` 诊断再做；市场侧栏已经把现状说清楚了。
