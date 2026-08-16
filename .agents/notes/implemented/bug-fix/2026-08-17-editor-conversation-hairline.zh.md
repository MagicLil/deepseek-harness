# Agent Note: Editor / conversation header hairline

Status: implemented

[English](2026-08-17-editor-conversation-hairline.md) | 中文

## 问题

文件页签条是 28px，自己带一根底线。编辑器路径 / 保存行紧挨着再画一根。对话列标题是 36px 一条线。竖分隔条那儿，左边两根线一上一下夹着右边那根，看起来像错位的双线。

## 决策

工作台页签条改成 36px `border-box`，只留这一根底线。编辑器路径 / 保存 / 语言服务那一行不再画底边。对话列标题线不动。

## 考虑过的其他做法

**两根线都留着，只把页签条抬到 36px。** 否决：保存行仍会在对齐点下面再画一根。

**把路径 / 保存塞进页签条。** 否决：那一行还要显示长路径、语言服务提示和保存；塞进 36px 会挤掉页签或换行。

## 后果

这是 L2（`ui-xmart-workbench` CSS）。桌面端要重编这个包的 `lib/client.js`，对齐后的单线才会画出来。
