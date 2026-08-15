# Git 差异保留编辑器语法色

[English](2026-08-16-git-diff-syntax-highlight.md) | 中文

## 原因

工作台差异把增删行整行染成纯绿或纯红。Cursor 会保留文件自己的 TextMate 颜色，红绿只当行背景。

## 改动

`DiffTab` 仍读 `host.gitDiff` 的 unified 文本。去掉 `+`/`-` 前缀后，用编辑器同一套 Shiki（`highlightSource`）分别给旧侧和新侧上色，再画在红绿底上。行号分左右两列。

只动 L2（`ui-xmart-workbench`）。
