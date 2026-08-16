# @deepseek-ai/dsh-client-ui-xmart-lan

[English](README.md) | 中文

万物智汇的局域网设置页。浏览器插件注册一个本地化的 `settings.section`，id 为 `lan`，order 为 24。插件激活时不读 Remote。页面展示开关、端口、本机地址、当前局域网地址、口令、复制、重新生成和绑定错误。

开关默认关闭。持有口令的人能驱动带 shell 的 agent。只在家庭或可信办公网使用。不要做端口映射，也不要公网暴露。关掉开关后手机立刻连不上，本机窗口不受影响。

注册走 `ctx.slots.inject()`，因此能跟随分区的迟声明、重新声明、语言切换和拆卸。调用经过 [`api-remotes`](../../api/remotes/README.md) 的 `remote.xmartLan`。本包不增加 HTTP 路由。

## 模型体验

无。本设置页不注册提示词、工具、消息或供应商请求。

#### KV Cache 影响

无。

#### 上下文消耗

无。
