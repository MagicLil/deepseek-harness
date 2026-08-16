# Agent Note: 万物智汇中性铬与品牌绿点缀

Status: implemented

[English](2026-08-17-xmart-neutral-chrome.md) | 中文

## 问题

万物智汇绿 `#5BB73B` 已锁定为品牌色。[X-Mart conversation chrome](../../implemented/feature/2026-08-16-xmart-conversation-chrome.md) 的 L2 覆盖把 DeepSeek 蓝别名（含大块洗底和 markdown 链接）都改成了这颗绿。上游画布 token 仍停在 `neutral-bluish` 家族。暖绿叠在冷蓝灰铬上，深色会读成脏橄榄。浅色下 Windows 系统按钮 overlay 曾在 `apps/desktop/src/title-bar.ts` 里写死为深色 `#151517`，从不跟随 renderer 主题，所以右上角最小化 / 最大化 / 关闭在浅色顶栏上仍是一块黑岛。

## 决策

`#5BB73B`（浅色字色 `#3D8C28`）只当稀疏点缀。画布和选中行洗底是真中性色。markdown 链接用正文色。桌面系统按钮 overlay 跟已解析的浅/深方案走。

绿留在 Logo、发送键和其它实心品牌控件、活动页签下划线、角标与状态点、品牌焦点环，以及小面积的 `Xmarting...` 闪动。选中会话 / 导航行、对话气泡、以及页面 / 侧栏 / 顶栏底是中性色。markdown 链接用 `--dsw-alias-label-primary`，悬停出下划线。

覆盖路径仍是 `ui-xmart-workbench` 的 `theme.overrideTokens`，外加两处 L3（`MarkdownText.module.css` 和桌面 `titleBarOverlay` / preload IPC）。不改 `packages/client/ui-theme/src/styles/design-platform.css`。成功 / 失败 / 警告 token，以及绑定 `--dsw-static-blue-*` 的轨迹系列，保持原样。

## 色板

深色：对话与编辑器 `#181818`；侧栏、顶栏与会话列 `#141414`；抬起层 `#1F1F1F` 到 `#2C2C2C`；选中行 `#2A2A2A`；系统按钮 overlay 底 `#141414`、图标 `#C8C8C8`。Monaco 仍用 One Dark Pro 的语法色；`charcoalOneDarkPro` 把 `editor.background`（以及对应的 gutter / minimap / peek 面）从 `#282c34` 改成 `#181818`。

浅色：对话与编辑器 `#FFFFFF`；侧栏、顶栏与会话列 `#F5F5F5`；选中行 `#EBEBEB`；系统按钮 overlay 底 `#F5F5F5`、图标 `#333333`。

## Token 覆盖

L2 由 `packages/client/ui-xmart-workbench/src/client/brand-accent.ts` 拥有。

绿留下：

| Token | 浅色 | 深色 |
|---|---|---|
| `--dsw-alias-state-business-primary` | `#3D8C28` | `#5BB73B` |
| `--dsw-alias-button-info-fill` | `#5BB73B` | `#5BB73B` |
| `--dsw-alias-button-info-hover` | `#4A9C32` | `#6BC84A` |
| `--dsw-alias-brand-primary-new-colorprimary-new-color` | `#3D8C28` | `#5BB73B` |
| `--dsw-static-deepseek-200` | `#CDE9C4` | `#CDE9C4` |
| `--dsw-static-deepseek-450` | `#3D8C28` | `#5BB73B` |
| `--dsw-static-deepseek-500` | `#3D8C28` | `#5BB73B` |

洗底和铬改到：

| Token | 浅色 | 深色 |
|---|---|---|
| `--dsw-alias-bg-base` | `#FFFFFF` | `#181818` |
| `--dsw-alias-bg-layer-1` | `#FFFFFF` | `#1F1F1F` |
| `--dsw-alias-bg-layer-2` | `#FFFFFF` | `#262626` |
| `--dsw-alias-bg-layer-3` | `#FFFFFF` | `#2C2C2C` |
| `--dsw-specific-sidebar-fill` | `#F5F5F5` | `#141414` |
| `--dsw-alias-state-business-tertiary` | `#EBEBEB` | `#2A2A2A` |
| `--dsw-specific-sidebar-nav-item-active-accent` | `#EBEBEB` | `#2A2A2A` |
| `--dsw-specific-bubble` | `#F5F5F5` | `#1F1F1F` |
| `--dsw-specific-bubble-highlight` | `#EBEBEB` | `#2A2A2A` |

## Markdown 链接

`packages/client/ui-primitives/src/markdown/MarkdownText.module.css` 里的 `.markdown a` 和 `.fileMention` 绑 `--dsw-alias-label-primary`。`state-business-primary` 仍是铬强调色。记为 FORK-PATCHES 条目 58。

## 桌面系统按钮 overlay

`apps/desktop/src/title-bar.ts` 提供浅 / 深两套 overlay。preload 的 `setTitleBarOverlay` 在 `dsh:title-bar-overlay` 上发送 `'light' | 'dark'`。`ui-xmart-workbench` 在 apply 和 `theme/change` 时，若存在 `window.__DSH_IPC__`，就推 `active.colorScheme`。`ThemePresenter` 不认识 Electron。窗口创建时用 `nativeTheme.shouldUseDarkColors` 先选一套；renderer 第一帧快照再校正。Web 没有系统按钮 overlay。记为 FORK-PATCHES 条目 59。

## 考虑过的替代方案

**底色跟着绿走。** 否决：用户选了中性铬、绿只当点缀。绿灰画布能让标更「住得进去」，但过了会读成茶绿 / 医院风。

**把品牌绿收冷，去就现有蓝灰中性色。** 否决：`#5BB73B` 已锁定。

**markdown 链接继续用 `state-business-primary`。** 否决：这颗 token 是铬强调色。正文链接发绿会让整页深色对话读成橄榄。共用同一颗 token 就拆不开这两个角色。

**改 `design-platform.css` 整表替换蓝灰阶。** 否决：这是对上游 token 表的大范围 L3，同步冲突是永久的。文档化的第三方路径是 `theme.overrideTokens`。

**把系统按钮同步放进 `ThemePresenter`。** 否决：presenter 只做纯 DOM 投影。桌面 IPC 应放在已经拥有品牌覆盖的工作台 fiber，加上现有桌面 preload 桥。

## 后果

深色铬是炭灰；浅色会话列和顶栏是 `#F5F5F5`；选中行是灰。浅色下 Windows 系统按钮坐在 `#F5F5F5` 上。切换外观时 overlay 跟着变，不用重启。markdown 链接是正文色。页签、发送、活动栏图标仍为绿。`brand-accent`、title-bar、markdown CSS、title-bar-sync 和 apply 测试钉住合同。

若持久化偏好和 `nativeTheme` 不一致，启动时系统按钮可能闪一帧错套；第一次 `theme/change` 会校正。markdown 链接这处 L3 每次上游改 `MarkdownText.module.css` 都会冲突。覆盖 `bg-base` 和 `sidebar-fill` 也会改掉设置页、市场以及所有吃这些别名的表面——整窗画布本意如此。
