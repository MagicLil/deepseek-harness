# 多项目工作区上 Git 状态读取失败

[English](2026-08-15-git-nested-workspace.md) | 中文

## 原因

安瑞森会话的 cwd 是 `D:\work\company\anruisen`。这是 VS Code 多根工作区的父目录（`anruisen.code-workspace` 里是 `xmart-backend` 和 `xmart-web`），根上没有 `.git`。真正的仓库在这两个子目录。Git 面板对 `<cwd>` 跑 `git -C`，当然不是 work tree。

`Promise.all([gitStatus, gitLog])` 还会把 log 一侧的抛错收成「Git 状态读取失败」，所以「根目录不是仓库」看起来像硬失败。

## 改动

cwd 是 `git-unavailable` 时，`GitTab` 会探测一层可见子目录。找到仓库就加载；多于一个会出仓库下拉框。`gitLog` 失败时状态仍显示。错误态会带上 Host 返回的原文。

只动 L2（`ui-xmart-workbench`）。
