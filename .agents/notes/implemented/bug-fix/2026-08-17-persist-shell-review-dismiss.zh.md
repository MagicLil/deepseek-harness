# Agent Note: Persist shell-review dismiss

Status: implemented

[English](2026-08-17-persist-shell-review-dismiss.md) | 中文

## 问题

审查条上点 **知道了** 只藏掉当前 React 挂载里的黄条。重开项目会从 `~/.dsh/agent-review/<sessionId>/` 再读到 `shellMaybeMutated: true`，提示又回来。Host Remote 加上之后，若 `api-remotes` 客户端包还是旧的，挂上去的 `agentReview` 没有 `dismissShell`，按钮会抛 `review.dismissShell is not a function`。

## 决策

`ReviewEngine.dismissShell` 清掉该回合的 `shellMaybeMutated` 并写回索引。工作台在挂载的 stub 有该方法时才调用；同时写入 `localStorage`（`dsh.review.shellDismissed:<sessionId>:<turn>`）并立刻藏条，避免旧 remotes 包抛错。同一回合之后再 `markShell` 会重新举起 Host 标志。`api-remotes` 客户端包会内联生成的 Remote，所以加方法必须连这个包一起重编。

## 考虑过的其他做法

**只用 localStorage。** 否决作为唯一存储：审查态本来就在 Host 索引里。它只作为同浏览器缓存，remotes stub 过期时关掉提示仍能熬过重开。

**新增 `shellHintDismissed` 字段。** 否决：这个标志的唯一界面职责就是「要不要显示这条警告」；清掉它不用改磁盘格式，新的壳工具本来就会再置位。

## 后果

关掉提示是 Host Remote（`get` / `accept` / … / `dismissShell`）外加浏览器缓存。要让方法生效，必须重编 `@deepseek-ai/dsh-host-agent-review` 的 remotes **以及** `@deepseek-ai/dsh-api-remotes` 的 `lib/client.js`。没点过的旧索引仍会显示黄条，点一次就不再出现。
