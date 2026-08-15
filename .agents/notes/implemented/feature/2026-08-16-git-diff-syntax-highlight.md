# Git diff keeps editor syntax colors

English | [中文](2026-08-16-git-diff-syntax-highlight.zh.md)

## Why

The workbench diff painted add/del lines as a single green or red foreground. Cursor keeps the file's TextMate colors and only uses red/green as the line background.

## What changed

`DiffTab` still reads unified text from `host.gitDiff`. It strips the `+`/`-` prefix, tokenizes the old and new sides with the same Shiki pack as the editor (`highlightSource`), and renders those tokens on the add/del wash. Dual gutters show original and modified line numbers.

L2 only (`ui-xmart-workbench`).
