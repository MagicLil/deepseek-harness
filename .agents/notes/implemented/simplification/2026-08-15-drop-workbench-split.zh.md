# Agent Note: 去掉工作台列内分栏

Status: implemented

[English](2026-08-15-drop-workbench-split.md) | 中文

## 问题

编辑器标签栏上有一个「上下分栏」控件，会把另一个已打开文件叠在当前文件下面。它至少要两个文件标签、不能拖改比例，也替代不了切标签，所以只是占着栏位。更早的 [Git / 任务切片](../feature/2026-08-15-xmart-workbench-git-tasks.md) 已经为这一格上了 `setSplit`，并把 `splitTabId` / `splitRatio` 写进持久化。

## 决策

编辑器列只保留一叠。`WorkbenchColumn` 和 `TabBar` 只渲染一个文件体。`IXmartWorkbench` 没有 `setSplit`。`WorkbenchSessionState` 只保留标签、焦点、`nextSeq` 和活动项；`dsh.xmart.workbench.tabs.<sessionId>` 里残留的 `splitTabId` / `splitRatio` 在净化时丢掉。Markdown 预览自己的编辑/预览/分栏切换不变。

## 曾考虑的替代方案

**只藏按钮，留下 `setSplit` 等以后做拖拽分栏。** 不予采用：没有调用方的公开方法和闲置持久化字段是死契约。以后真要分栏，再加新 API。

**保留第二格，只去掉标签栏文案。** 不予采用：第二格就是这个产品。文案没了、旧 `splitTabId` 还画出第二格，会让带着旧 localStorage 的人摸不着头脑。

## 后果

标签栏只剩标签和 `+`。旧会话加载时不再出现第二格。`ctx.xmartWorkbench` 不再发布 `setSplit`。跨面板或拖拽分栏仍不在范围内。
