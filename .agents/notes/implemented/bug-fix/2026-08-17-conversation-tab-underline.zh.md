# Agent Note: Conversation tab underline alignment

Status: implemented

[English](2026-08-17-conversation-tab-underline.md) | 中文

## 问题

对话列标题同时画一条通栏 1px 底线和 2px 选中条。两条都停在 `bottom: 1px`，下面还有 1px 透明边框，选中条又是 2px 圆角胶囊。主题绿叠上去以后，看起来像绿条浮在一条被截断的灰线上。

## 决策

底线和选中条共用 `bottom: 0`。选中条仍按 Figma 用 2px，只圆上角，在选中页签正下方盖住底线。透明的 `border-bottom` 垫片去掉。

## 考虑过的其他做法

**去掉通栏底线，只留绿色选中条。** 否决：标题和正文之间仍需要分隔；看着不舒服的是错位的双线，不是底线本身。

**选中条也改成 1px，只换颜色。** 否决：文件头注释和 Figma 都写的是 2px 选中条。

## 后果

`ConversationRoot.module.css` 是 L3 fork 补丁。桌面端要重编 `ui-conversation` 的 `lib/client.js`，对齐后的选中条才会画出来。
