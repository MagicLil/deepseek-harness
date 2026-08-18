# Agent Note: Search panel follow-through

Status: implemented

[English](2026-08-17-search-panel-follow-through.md) | 中文

## Problem

工作台全局搜索能找到文本并打开那一行，但日常后半段不完整：编辑器不选中匹配、再敲字时旧结果没有「正在搜索…」、所有 host 失败都是同一句、结果只能鼠标点、D7 文件工具刷新后命中列表还是旧的。

## Decision

搜索面板继续停在 L2，仍走 `host.search`。`revealTarget` 带上第一段匹配的开区间 `end`；`EditorReveal` 的 end 可选，Monaco 用 `setSelection` + `revealRangeInCenter` 画出这段。方向键在未折叠的可见命中上移动 `selectedKey`；有选中时回车打开，没有则仍立即搜索。再次搜索先留着旧结果并标「正在搜索…」。`classifySearchFailure` 把 `search-unavailable`、glob 的 `search-invalid`、正则的 `search-invalid` 和其余失败拆成四条文案。面板监听 `files.refreshNonce`（和 Git 同一套 D7 / 资源管理器刷新）并重跑当前查询。

## Alternatives considered

**同一改动里做「在文件中替换」和流式结果。** 那些要加 host.search 字段或流式 RPC。桌面通道规则仍禁止自开 WebSocket。本记录只交付现有 unary 契约能放下的五条后续。

**把查询写入 localStorage。** 资源管理器展开目录已经持久化；搜索故意只放内存，避免重启就再打一遍 ripgrep。保持原样。

**方向键把焦点移到结果树（VS Code）。** 输入框保持焦点，方便继续打字；多出来的状态只有 `selectedKey`。

## Consequences

点击或键盘打开命中时，编辑器会选中匹配段。Agent 写盘和资源管理器刷新图标会像刷新 Git 一样重跑搜索。在文件中替换、截断后再加载、逗号分隔 glob、gitignore 开关仍不在这次里。

## Testing

`search-store.client.spec.ts` 钉住 reveal 的 `end`、错误分类和命中键行走。`search-tab.client.spec.tsx` 钉住旧结果上的「正在搜索…」、键盘打开、四类错误文案，以及 `bumpRefresh` 再搜。`monaco-host.client.spec.tsx` 钉住带 span 的 `setSelection` 和只有光标的 reveal。
