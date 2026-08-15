# @deepseek-ai/dsh-host-skill-manager

[English](README.md) | 中文

X-Mart「技能」设置页的宿主 Remote。`SkillManagerGateway` 注册 `skillManager` 服务，并发布生成的直接 Remote：列出／读取／保存／删除自有 skill、列出项目目录，以及列出／导入外来 skill（导入先停用，设置页不调用）。

自有写入只落在 `~/.dsh/skills`（个人）和 `<项目>/.dsh/skills`（项目）。每次保存都会写成 `<name>/SKILL.md`。`listProject` 会在工作区里深扫所有 `SKILL.md`（以及 `skills/` 下的扁平成品）。已经在个人目录里的同名项默认不展示，除非项目自己有 `.dsh` / `.agents` / 仓库内副本；`setEnabled` 会写 `disable-model-invocation`。列出时也接受其他 agent 已经在用的驼峰名称，例如 `loean7-codingJournal`。

该服务只走 Remote，不声明同进程 Cordis `Context` 合并。客户端包通过 [`api-remotes`](../../api/remotes/README.md) 组装消费它。没有新的 HTTP 路由。

## 模型体验

无。此宿主管理器不注册提示词、工具、消息或提供方请求。保存或导入之后，现有的文件系统 skill 提供方会在下一次目录刷新时发现新文件。

#### KV Cache 影响

无；本包从不组装模型输入。

## 已知限制与暂缓事项

- **开关会写 `disable-model-invocation`** — `.dsh/skills` 和 `.agents/skills` 就地改。Claude / Cursor / Codex 的副本会先拷进自有的 `.dsh` 根再改。
- **重命名等于删除再新建** — `saveOwned` 用请求中的名称作为目录身份。
- **导入先停用** — `importForeign` 还在，供以后用，设置页只浏览。`listForeign` 扫用户目录时，同名外来 skill 仍会收成一行。
