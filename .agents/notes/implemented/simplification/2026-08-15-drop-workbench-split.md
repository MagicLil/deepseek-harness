# Agent Note: Drop the workbench in-column split

Status: implemented

English | [中文](2026-08-15-drop-workbench-split.zh.md)

## Problem

The editor tab bar showed a **上下分栏** control that stacked a second open file under the active one. The control needed two file tabs, could not drag-resize, and did not replace switching tabs, so it sat in the chrome without earning its keep. The earlier [Git / tasks slice](../feature/2026-08-15-xmart-workbench-git-tasks.md) had shipped `setSplit` plus persisted `splitTabId` / `splitRatio` for that pane.

## Decision

The editor column is a single stack. `WorkbenchColumn` and `TabBar` render one file body. `IXmartWorkbench` has no `setSplit`. `WorkbenchSessionState` keeps tabs, focus, `nextSeq`, and activity; leftover `splitTabId` / `splitRatio` keys in `dsh.xmart.workbench.tabs.<sessionId>` are dropped on sanitize. Markdown preview's own edit/preview/split toggle is unchanged.

## Alternatives considered

**Hide the button and keep `setSplit` for a later drag-to-split.** Rejected: unused persist fields and a public method with no caller are dead contract. A future split can add a new API when the product wants one.

**Keep the second pane and only drop the tab-bar label.** Rejected: the pane is the same product. Removing the label while a stored `splitTabId` still paints a second body would surprise anyone with old localStorage.

## Consequences

The tab bar is tabs plus `+`. Old sessions load without a second pane. `ctx.xmartWorkbench` no longer publishes `setSplit`. Cross-panel or drag-to-split remains out of scope.
