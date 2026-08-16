# @deepseek-ai/dsh-client-ui-xmart-lan

English | [中文](README.zh.md)

LAN settings page for 万物智汇. The browser plugin registers one localized `settings.section` contribution with id `lan` and order 24. It performs no Remote read during plugin activation. The page shows the switch, port, loopback URL, current LAN URL, token, copy, regenerate, and bind errors.

The switch is off by default. A holder of the token can drive an agent that has a shell. Use this only on a home or trusted office network. Do not port-forward or expose the port to the public internet. Turning the switch off drops the phone immediately; the desktop window stays up.

The registration uses `ctx.slots.inject()`, so it follows late section declaration, redeclaration, locale changes, and teardown. Calls go through [`api-remotes`](../../api/remotes/README.md) `remote.xmartLan`. There are no new HTTP routes from this package.

## Model Experience

None, as this Settings page registers no prompt, tool, message, or provider request.

#### KV Cache effect

None.

#### Context consumption

None.
