# Agent Note：万物智汇设置里的 skill 管理

Status: implemented

[English](2026-08-16-xmart-skill-manager.md) | 中文

## 问题

Harness 已经能发现和调用 skill，但桌面产品没有地方浏览或导入。用户如果已经把 Claude Code 或 Cursor 的 skill 放在 `~/.cursor/skills` 或 `~/.claude/skills`，在万物智汇里看不见，只能自己复制。

## 决策

新增 L2 宿主 Remote（`@deepseek-ai/dsh-host-skill-manager`）和 L2 设置页（`@deepseek-ai/dsh-client-ui-xmart-skills`）。

新建仍只落在 `~/.dsh/skills` 和 `<项目>/.dsh/skills`。设置页只浏览名称、说明和开关。个人列表合并 `~/.dsh/skills`、`~/.agents/skills`、`~/.cursor/skills` 和 `~/.claude/skills`。项目页按已打开的工作区分组，并深扫该树里每一个 `SKILL.md`（以及 `skills/` 下的扁平成品），不管是哪个 agent 留下的。已经在个人里的同名项不在项目页重复出现，除非项目自己有 `.dsh` / `.agents` / 仓库内副本，那时以项目为准。`setEnabled` 对 `.dsh` 和 `.agents` 就地写 `disable-model-invocation`；其他副本会先拷进自有的 `.dsh` 根。导入先停用，页面自己不拷文件。现有给 `/` 菜单用的 `skill.list` 不变。客户端通过 api-remotes 组装调用 `ctx.remote.skillManager`（桌面 IPC），不新开 HTTP 路由。

## 考虑过的替代

**扩展 api-proxy 上的 `skill.list`。** 否决：那条 RPC 被写成该域唯一的目录查询，必须保持按会话寻址、只读。

**让 `skill-filesystem` 直接扫外来根。** 否决：那样会在用户导入前就把 Claude／Cursor skill 暴露给模型，而且是对上游提供方的 L3 改动。

**就地改 `.agents/skills` 来新建／删除。** 仍然否决。开关是窄例外：`skill-filesystem` 已经认那里的 `disable-model-invocation`，所以开关只改这个标志，不整包拷贝。

## 后果

列出 skill 就是普通读盘。文件系统 skill 提供方的监视器会在下一次发现时刷新模型／用户目录。设置页不订阅该监视器；切换标签会自己重新加载列表。
