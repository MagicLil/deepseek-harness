# Agent Note：万物智汇对话外观

状态：已落地

[English](2026-08-16-xmart-conversation-chrome.md) | 中文

## 问题

对话列仍是 DeepSeek 蓝强调色和 16px 正文。运行态文案写死为英文 `Deep diving...`。和万物智汇品牌、以及接近 Cursor 的密度都不匹配。

## 决策

**强调色走 L2 token 覆盖。** `ui-xmart-workbench` 调用 `ctx.theme.overrideTokens`，叠万物智汇绿（深色 `#5BB73B` / 浅色字色 `#3D8C28`）。改写的别名是 `state-business-primary`、`state-business-tertiary`、`button-info-fill/hover`、`brand-primary-new-colorprimary-new-color`、`sidebar-nav-item-active-accent`，以及 `specific-bubble` / `specific-bubble-highlight`。对话列仍直接绑的静态档 `--dsw-static-deepseek-200/450/500` 也一并改写，这样 `Xmarting...` 闪动和进行中圆点才会变绿。成功 / 失败 / 警告仍用自己的 token。轨迹图里直接绑 `--dsw-static-blue-*` 的系列色保持蓝。

**字号和运行态文案是 L3。** 助手正文、用户气泡、输入卡片从 16px 改为 13px。运行态改成 `Xmarting...`。这些值写死在 `ui-conversation`，没有槽位或文案键可覆盖。

## 考虑过的替代

**用自有壳替换 `conversation.session`。** 否决：等于再做一套对话插件，上游每个聊天功能都要搬家。

**只改对话列 CSS（方案 A）。** 否决：用户选了全站强调色（方案 B）。token 覆盖是文档里的第三方主题路径。

## 后果

消费这些别名的选中页签、发送按钮、焦点环、Markdown 链接都会变绿。对话正文更密。fiber 卸载会撤掉覆盖层。同步成本是 `ui-conversation` 的四个文件加快照。
