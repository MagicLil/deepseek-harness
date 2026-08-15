# Agent Note：X-Mart 工作台文件图标

Status: implemented

[English](2026-08-16-xmart-workbench-file-icons.md) | 中文

## 问题

资源管理器树和中间编辑器 Tab 条只画文件名。一目录的 `.java` 看起来就是白字列表，树和标签本身已经能用，但观感仍比 Cursor 空。

## 决策

**把完整的 Material Icon Theme 烤进 `ui-xmart-workbench`。** `scripts/generate-icon-theme.mjs` 调用 `material-icon-theme`（devDependency，MIT）的 `generateManifest()`，写出 `src/client/icon-theme-data.ts`：精确文件名 / 复合扩展名 / 文件夹名对照表，以及所有被引用的 SVG。插件服务器只提供 `client.js`，运行时拿不到旁边的 SVG；内联是不碰 `modules` 和 `apps/web` 的 L2 做法。

**解析规则对齐 VS Code。** `resolveIconId` 先把 basename 小写，再精确 `fileNames`，再从长到短试 `fileExtensions`（`foo.d.ts` 先于 `ts`），最后落到默认文件图标。目录走 `folderNames` / `folderNamesExpanded`。`FileIcon` 用装饰性 `<img>` data URI。资源管理器把图标放在箭头后面（文件行用等宽占位对齐）。编辑器 `TabBar` 用同一组件，优先 `tab.path`，否则 `tab.title`。

## 考虑过的替代

**手绘大约 20 个语言色标。** 否决：用户要整包主题，包括特殊文件夹和 `package.json` 这类精确文件名。

**把 SVG 放在 `client.js` 旁边，或走 `/monaco` 那种静态 dist。** 否决：`/plugins/<id>/` 只回答 `client.js`，拷进 `apps/web/dist` 是改上游静态服务的 L3。

**浏览器里现场跑 `generateManifest`。** 否决：生成器是 Node 构建工具。JSON 在生成时写好，由 client 包导入。

## 后果

资源管理器行和编辑器 Tab 能看到 Cursor 用户熟悉的彩色标识（Java 杯、TypeScript 标、`src` 文件夹等）。重新生成主题：`pnpm --filter @deepseek-ai/dsh-client-ui-xmart-workbench generate:icons`。因为插件没有别的资源通道，client 包大约增加 1.2 MB 未压缩体积。Git / 任务列表未改。`conversation.view` 和 `agent-loop` 不动。
