# Agent Note：AI 写提交说明和完整 Git 图表

Status: implemented

[English](2026-08-15-git-scm-ai-graph.md) | 中文

## 问题

Git 页已经能暂存、提交、同步，也能画一条按新到旧的脊柱，但 Cursor 源代码管理还缺两下：闪光按钮写提交说明，以及带引用标签、合并线和从图上检出的图表。

## 决策

**辅助 `host.gitSuggestCommit`，不走 `session.prompt`。** 宿主读 `git diff --cached` 和最近 8 条 subject，先把精确的 system、prompt、路由和 `maxTokens` 记成 `session/git-commit-llm-request`，再走 `ctx.llm` 流式。`purpose: 'session-title'` 复用 DeepSeek 已有的关思考路径，避免再扩 LLM purpose 联合。没有暂存返回 `git-failed`。模型失败返回 `model-unavailable`。这不是 agent 工具，也不进 inspect catalog 白名单。

**`host.gitLog` 带可选 `refs`。** `git log` 之后用 `for-each-ref` 加 `rev-parse HEAD` / `--abbrev-ref` 贴标签。本地和远程靠 ref 命名空间区分，不用 `%D` 的斜杠猜测。装饰失败就返回未装饰的行。

**`host.gitCheckout` 接受 `detach`。** 图上的说明/节点和远程/标签药丸走 `git switch --detach <hash>`（`workspaces.gitCheckoutCommit`）。本地分支药丸走 `git switch`。HEAD 药丸点不了。不能同时 create 和 detach。

**L2 画图。** 额外的父提交变成第二条 lane 加一条 SVG 三次曲线。日志窗口 80 行（宿主上限 100）。

## 考虑过的替代

**闪光按钮走 `session.prompt`。** 否决：会进对话回合，还会把 git 工具暴露给模型。

**新增 `git-commit` LLM purpose。** 否决：那是对 `packages/llm` 和每个适配器序列化路径的 L3 加宽。复用 `session-title` 的分叉成本更小。

**用 `%D` 做药丸。** 否决：单靠斜杠分不清 `origin/foo` 和 `foo`。

## 后果

有暂存时可以用会话模型填提交框；精确提示词能从会话日志重建。图表显示 HEAD / 分支 / 远程 / 标签，也可以分离 HEAD。章鱼布局、交互式 rebase 和 Agent Review 仍不做。
