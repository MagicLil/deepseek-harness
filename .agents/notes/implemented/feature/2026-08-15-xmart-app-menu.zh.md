# Agent Note：万物智汇产品应用菜单

Status: implemented

[English](2026-08-15-xmart-app-menu.md) | 中文

## 问题

桌面顶栏原先是 Electron 库存的 File / Edit / View / Window / Help，外加一项真的「终端」。大多数条目对产品没有意义（Help 的 Learn More 会打开 electronjs.org），看起来像剩下来的壳，不像万物智汇。

## 决策

**用产品菜单换掉库存 role。** 顶栏：文件 / 编辑 / 视图 / 终端 / 帮助。去掉 Window。每一项要么做工作台真事，要么是操作系统还得留的手势（撤销/复制、缩放、退出、开发者工具）。

**桌面和 web 用同一套命令 id。** 桌面在 `apps/desktop/src/app-menu.ts` 装原生菜单，点击走 `dsh:app-menu`。web 的 `MenuBar` 调同一个 `run`。关于对话框留在 Electron 主进程（`dialog.showMessageBox`）；web 用 `window.alert`。

**设置和保存不进公开服务面。** 文件 → 设置派发 `dsh:open-settings`（ui-settings-general 听）。文件 → 保存派发 `dsh:workbench-save`（当前编辑器听）。不新开 HTTP/WS。

## 考虑过的替代

**继续用 Electron 库存菜单，只加终端。** 否决：用户说这是鸡肋。

**照抄 Cursor 的 Go / Run / Selection / 在文件中查找。** 否决：我们还没有这些面。假条目比短菜单更糟。

## 后果

改完 `apps/desktop` 后要重建并重启 `pnpm dsh desktop`，原生菜单才会换新。web 的 HTML 顶栏不用重建原生壳。
