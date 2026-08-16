# @deepseek-ai/dsh-host-xmart-lan

English | [中文](README.zh.md)

Desktop LAN token gate for 万物智汇. The Host plugin owns `~/.dsh/xmart-lan.json` (`enabled`, `port`, `token`), registers a webserver guard, serves a login page on unauthorized non-loopback requests, and rebinds the existing desktop webserver between `127.0.0.1` and `0.0.0.0` without starting a second process.

The switch is off by default. Loopback (`127/8`, `localhost`, `[::1]`) skips the token. A matching cookie `xmart_lan` or header `x-xmart-lan-token` is required on the LAN. A holder of the token can drive an agent that has a shell — use this only on a home or trusted office network. Do not port-forward or expose the port to the public internet.

Client packages consume the generated `xmartLan` Remotes through the [`api-remotes`](../../api/remotes/README.md) assembly. When the switch is on, `ctx.xmartLan.trustedHosts` lists the current non-internal IPv4 addresses so `/api` can accept those Host headers.

## Model Experience

None, as this Host manager registers no prompt, tool, message, or provider request.

#### KV Cache effect

None.

#### Context consumption

None. The token and bind state never enter the model request.
