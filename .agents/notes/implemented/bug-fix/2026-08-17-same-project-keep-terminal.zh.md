# Agent Note：同项目切会话保住终端

Status: implemented

[English](2026-08-17-same-project-keep-terminal.md) | 中文

## 问题

在同一项目文件夹里点另一条对话（或点「新会话」）时，工作台铬仍会重置。[同项目继承](../feature/2026-08-16-xmart-same-project-inherit.md) 只拷编辑器标签，终端故意留下，因为主机 PTY 绑在源会话上。[闪屏修复](2026-08-17-same-project-session-switch-flash.md) 让 React 树不再重挂，但 `observeSession(nextId)` 仍指向目标会话自己的空 store，编辑器被掏空，底栏丢掉 PTY 标签。新建会话常常还没有 cwd，`shouldInheritSameProject` 为假，继承根本不跑。

## 决策

工作台铬改为**按项目共享**。`XmartWorkbenchController.setScopeResolver` 把对话 id 映射到工作区文件夹（`projectKeyOf`，cwd 还没挂上时用上一次已知项目）。`observeSession` / `openTab` / persist / 资源管理器展开 / 搜索 / Git 角标都走这个键，所以 `/ws` 里两条对话共用一份 store 和同一个 `HostObservable`。只有键仍不同时，`inheritSession` 才整表拷贝（含终端）。终端座位按项目 + tab id 记，并记住 `ownerSessionId`；只换对话 id 时 `TerminalTab` 不拆 xterm，host.terminal* 仍打给打开 PTY 的那条会话。

D6 修订：铬按项目；对话正文仍按会话。

## 考虑过的替代

**继续切时拷贝，并加上终端标签行。** 否决：PTY 仍挂在源会话的 list 里。重挂的 `TerminalTab` 会 `listTerminals(新会话)` 再开一个壳。

**只按 workspace id 键，不要会话回退。** 否决：还没进文件夹的会话会掉进一份全局空 store，串项目。

## 后果

同项目里点对话或新建会话，资源管理器、Git、搜索、已打开文件和正在跑的终端都留下。换文件夹仍加载那一侧的铬。主机 PTY 仍归打开它的会话；关终端标签时按这个 owner 杀。桌面端要加载重建后的 `ui-xmart-workbench` `lib/`。
