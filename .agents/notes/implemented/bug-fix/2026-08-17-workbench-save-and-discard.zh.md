# Agent Note: Serialize editor saves and confirm Git discard

Status: implemented

[English](2026-08-17-workbench-save-and-discard.md) | 中文

## Problem

工作台有两处会丢磁盘数据，但不会崩溃。`EditorTab.handleSave` 每次点击都新开一次 `writeFile`。保存 A 还在飞，用户改完再存 B，后完成的那次写入会盖盘。较晚结束的旧写入可能把过期字节写回去，状态却显示「已保存」。Git「还原 / 全部还原 / 右键还原」一点就调用 `gitDiscard`（`git restore` / `clean -f`）。误点不可逆。

## Decision

`EditorTab` 每个标签只保持一次进行中的写入。写入未完成时再点保存只置合并标记。当前写入成功后，若标记仍在，再写一次 `contentRef`，这样最后的缓冲区胜出，旧完成不能盖掉它。写入失败会丢掉队列，并显示已有的保存失败状态。写入期间缓冲区变了但用户没有再存，标签保持未保存。

Git 还原（行按钮、全部还原、右键菜单）走 `confirmGitDiscard` 和 `window.confirm`，与审查强制撤销同一模式。取消是空操作。文案在 `git.discardConfirm` / `git.discardAllConfirm`。

## Alternatives considered

**中止进行中的写入再开新的。** 否决：`workspaces.writeFile` 没有 abort，被中止的调用若仍完成，还会竞态。

**状态为「保存中」时禁用保存。** 否决：第一次写入期间的点击会丢掉后来的缓冲区。合并能保住最后一次意图。

**自做面板确认，不用 `window.confirm`。** 否决：审查对不可逆覆盖已经用原生对话框，再叠一层弹层超出这次修复该做的。

## Consequences

这是 L2（`ui-xmart-workbench`）。连按保存会按顺序写下最新缓冲区。还原会先问。桌面端必须重编该包的 `lib/client.js`，队列和确认文案才会出现。
