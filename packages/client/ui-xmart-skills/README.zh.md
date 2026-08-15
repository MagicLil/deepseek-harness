# @deepseek-ai/dsh-client-ui-xmart-skills

[English](README.md) | 中文

万物智汇的技能设置页。浏览器插件注册一个本地化的 `settings.section`，id 为 `skills`。插件激活时不读 Remote。页面只浏览：个人技能合并用户目录下的 skill 根；项目页按已打开的工作区分组，并深扫该树里的 `SKILL.md`。搜索框按名称或说明过滤当前列表。每行旁边有开关。已经在个人里的同名项不在项目页重复出现，除非项目自己有副本。这个页面没有新建、编辑或导入表单。

注册走 `ctx.slots.inject()`，因此能跟随分区的迟声明、重新声明、语言切换和拆卸。调用经过 [`api-remotes`](../../api/remotes/README.md) 的 `remote.skillManager`。没有新的 HTTP 路由。

## 模型体验

无。本包只在浏览器设置里列出磁盘上的 skill 文件，不注册任何面向模型的内容。文件出现在自有根或 agents 根之后，现有 skill 目录可能通过文件系统提供方刷新。

#### KV Cache 影响

无；本包既不组装也不发送提供方请求。

## 已知限制与暂缓事项

- **页内不能新建、编辑或导入** — 要改 skill 就改它所在目录里的 markdown 文件。
- **每个标签或重试一份快照** — 页面不订阅文件系统监视；切换标签会重新加载列表。
