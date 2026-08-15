# 多项目工作区上 Git 差异读取失败

[English](2026-08-16-git-diff-nested-root.md) | 中文

## 原因

会话 cwd 不是仓库时，`GitTab` 已经会探测子目录里的仓库（安瑞森：`D:\work\company\anruisen` → `xmart-backend` / `xmart-web`）。状态、暂存、提交都走 `status.root`。隐藏的差异标签没有。

点改动或提交图时，`host.gitDiff` 用的是 `getCwd(sessionId)`，也就是父目录。`git -C <父目录>` 不是仓库，标签就显示「差异读取失败。」

## 改动

差异标签的 seed 会带上当前选中的仓库根（`side:file` / `commit:<hash>`，再用 RS 分隔绝对路径）。`DiffTab` 优先用这个根，而不是会话 cwd。`GitTab` 打开差异时传入 `status.root`。

只动 L2（`ui-xmart-workbench`）。
