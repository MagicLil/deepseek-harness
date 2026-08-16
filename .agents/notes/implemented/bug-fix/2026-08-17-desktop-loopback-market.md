# Agent Note: Desktop window must load the loopback webserver

Status: implemented

English | [中文](2026-08-17-desktop-loopback-market.zh.md)

## Problem

Settings → Plugin Market (`dshmarket`) showed a catalog load failure and an empty Installed list. The packages were still in the desktop profile and still loaded (Cursor 子代理 stayed in the nav). The host already answered `GET /dsh-market/registry` on `127.0.0.1:3080`, but the Electron window never hit that origin.

## Decision

The desktop window loads `http://127.0.0.1:<webServer.port>/`. `desktop-app` mounts `frontend-static` so that origin serves the SPA and `/plugins/*`. `dsh desktop` rewrites argv to `--profile desktop` and puts a Node `dsh` shim on PATH at relaunch. First-party `/api` may still use preload IPC. Loopback navigations stay in-window.

## Alternatives considered

**Tell the user the community market is web-only.** Rejected: fork patches 41 / 43 / 45 already made desktop a local HTTP host so those plugins can run, and the same plugins were already loaded in this profile.

**Proxy only `/dsh-market/*` through `dsh://`.** Rejected: install POSTs fail `sameOrigin` (`app` vs `127.0.0.1`), and the next HTTP plugin would need another special case.

## Consequences

A desktop restart after this build opens the same local URL a browser would. `dsh-market` sees the desktop profile. `GET /` on 3080 is the SPA, not 404. Packaged and unpackaged launches both carry `--profile desktop` on `process.argv`.

## Follow-up: remotes client `require("zod")`

The first HTTP boot then failed at `@deepseek-ai/dsh-api-remotes` because `xmart-lan`'s generated `/remote` imports `zod` but the package did not declare it. pnpm isolation left that import unresolved; tsdown treated it as an external `require("zod")` the client module table cannot answer. Adding `zod` (same as the other Host remote packages) and rebuilding the remotes client face inlines it.
