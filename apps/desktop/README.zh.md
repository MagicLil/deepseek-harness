# `@deepseek-ai/dsh-desktop`

[English](README.md) | 中文

桌面 profile 的 Electron main/preload 外壳：`dsh://` 静态资源服务、通往 `toFetchHandler` 的 IPC fetch，以及让 Node CLI 在 Electron 下重新执行的 `relaunch`。

## Entry

- `dsh desktop` / `dsh --profile desktop` — CLI 发现当前不是 Electron 进程后调用 [`relaunch`](src/relaunch.ts)。
- 随后 Electron 运行 **已编译的** [`lib/electron-main.js`](lib/electron-main.js)（由 `pnpm run build:lib` 构建）。Electron 不能使用 `tsx` —— 其 Node ABI 无法加载 tsx 的原生 esbuild 二进制。
- [`shell`](src/shell.ts) 在 `apiProxy` 与 `clientModules` 就绪后打开窗口，并安装应用菜单（系统自带的 File / Edit / View / Window / Help，外加「终端」）。
- 再次运行 `dsh desktop` 会聚焦已有窗口（单实例锁）。窗口位置与尺寸保存在 `$DSH_HOME/desktop-window.json`。点关闭会藏到托盘（托盘菜单「退出」才真正退出）。第一次隐藏会弹一次提示，标记写在 `$DSH_HOME/desktop-prefs.json`。
- NSIS / 便携安装包会在 `resources/node` 旁带一份真 Node。`electron-main` 写入 `DSH_NODE_EXEC_PATH`，并在 PATH 前放 `dsh` shim（编译好的 CLI，不带 tsx），避免 Host 子进程把 `electron.exe` 当 Node 拉起。未打包的 `dsh desktop` 仍由 [`relaunch`](src/relaunch.ts) 记下启动用的 Node。

## 更新

自动更新只跑在 **NSIS 安装版**。`pnpm dsh desktop` 和便携版（有 `PORTABLE_EXECUTABLE_DIR`）不检查。发现新版本先问再下载；窗口在托盘里时先出系统通知，点开再出对话框。默认用 electron-builder 写入的 `app-update.yml`，也可用 `DSH_UPDATE_FEED_URL` / `DSH_UPDATE_GITHUB` 覆盖。

## Preload

[`preload.mjs`](preload.mjs) 以 CommonJS（`require('electron')`）入库，这样沙箱渲染进程无需先做 TypeScript 构建即可加载。在该沙箱里写 ESM `import` 会抛 `Cannot use import statement outside a module`，`window.__DSH_IPC__` 也就不会出现。它暴露 `window.__DSH_IPC__`（`fetch` + `subscribeFetchStream` + `abortFetch` + `loadBundle` + `onAppMenu` + `setTitleBarOverlay`）。页面自己重建 `Response` 对象 —— `contextBridge` 无法传递它们。

关闭窗口（或取消流式 `Response`）会在移除 IPC handler 之前中止进行中的 Host fetch。

渲染进程对 `dsh://app/api/...` 的 `fetch` / `<a download>` 会转发到同一个 Host handler。会话日志导出打开原生另存为对话框。`http(s)` 链接在系统浏览器中打开。

## Smoke

`pnpm run build` 之后，`DSH_DESKTOP_SMOKE_UNARY=1 pnpm dsh desktop` 打开窗口，通过 IPC 检查 `host.describe` / `session.list` / 一个 remotes 端点 / SSE `events.mux`，然后以 0 退出。
