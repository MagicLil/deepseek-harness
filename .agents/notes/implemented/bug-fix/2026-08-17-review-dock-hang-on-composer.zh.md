# Agent Note: 审查坞挂在输入框上沿

Status: implemented

[English](2026-08-17-review-dock-hang-on-composer.md) | 中文

## 问题

审查列表挂在 `conversation.input.dock`，是一条浮着的带子。它和输入卡片的宽度、顶圆角、描边都不对齐，看起来像另贴一块，不像 Cursor 那样是对话框的顶栏。

## 决策

L2 的 `ReviewDock` 对齐输入卡片几何（`--dsh-composer-card-max-width` + 两侧 clearance），用同一条描边 token，只圆上方 22px，并用负 margin 吃掉 stack gap。L3 在 `ConversationRoot.module.css` 里：有 `[data-review-dock]` 时削平 `[data-composer-card]` 的顶圆角和顶边。卡片铬在上游 `InputBar`，L2 改不了兄弟节点。

## 考虑过的其他做法

**用很大的负 margin 盖住卡片顶圆角。** 否决：会盖住草稿区的上内边距，22px 圆角还是会露肩。

**把审查 UI 搬进输入卡片内部。** 否决：等于接管 `conversation.composer.bar`，或在 InputBar 上新开洞。

## 后果

审查坞上面的待办/队列坞仍用原来的 6px 间距。只有输入卡片顶边会变，而且只在审查坞挂着的时候。
