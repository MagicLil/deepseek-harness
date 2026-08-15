# Agent Note: 万物智汇 product application menu

Status: implemented

English | [中文](2026-08-15-xmart-app-menu.zh.md)

## Problem

The desktop top bar was Electron's stock File / Edit / View / Window / Help plus one real item (Terminal). Most rows did nothing for the product (Learn More opened electronjs.org). That felt like leftover chrome, not 万物智汇.

## Decision

**Replace the stock roles with a product menu.** Top-level: File / Edit / View / Terminal / Help (中文：文件 / 编辑 / 视图 / 终端 / 帮助). Drop Window. Every command either does real workbench work or is an OS gesture we still need (undo/copy, zoom, quit, DevTools).

**Same command ids on desktop and web.** Desktop mints the native menu in `apps/desktop/src/app-menu.ts` and forwards clicks on `dsh:app-menu`. Web `MenuBar` calls the same `run` handler. About stays in the Electron main process (`dialog.showMessageBox`); web uses `window.alert`.

**Settings and Save stay off the public service face.** File → Settings dispatches `dsh:open-settings` (ui-settings-general listens). File → Save dispatches `dsh:workbench-save` (the mounted editor listens). No new HTTP/WS.

## Alternatives considered

**Keep stock Electron roles and only add Terminal.** Rejected: the user called that chicken-rib.

**Clone Cursor's Go / Run / Selection / Find in Files.** Rejected: we do not have those surfaces yet. Fake items would be worse than a short menu.

## Consequences

Restart `pnpm dsh desktop` after rebuilding `apps/desktop` so the native menu reloads. Web picks up the HTML bar without a native rebuild.
