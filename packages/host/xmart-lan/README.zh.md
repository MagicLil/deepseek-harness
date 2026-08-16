# @deepseek-ai/dsh-host-xmart-lan

[English](README.md) | 中文

万物智汇桌面端的局域网令牌门卫。Host 插件持有 `~/.dsh/xmart-lan.json`（`enabled`、`port`、`token`），注册 webserver 门卫，未授权的非回环请求看到登录页，并在现有桌面 webserver 上于 `127.0.0.1` 与 `0.0.0.0` 之间 rebind，不再拉第二个进程。

开关默认关闭。回环（`127/8`、`localhost`、`[::1]`）免检。局域网上必须带匹配的 cookie `xmart_lan` 或请求头 `x-xmart-lan-token`。持有口令的人能驱动带 shell 的 agent——只在家庭或可信办公网使用。不要做端口映射，也不要公网暴露。

客户端通过 [`api-remotes`](../../api/remotes/README.md) 组装的 `xmartLan` Remote 调用。开关打开时，`ctx.xmartLan.trustedHosts` 列出当前非内部 IPv4，供 `/api` 接受这些 Host。

## 模型体验

无。本 Host 管理器不注册提示词、工具、消息或供应商请求。

#### KV Cache 影响

无。

#### 上下文消耗

无。口令与绑定状态不会进入模型请求。
