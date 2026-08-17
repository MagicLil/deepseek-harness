# Agent Note: Git picker scoped to the current workspace

Status: implemented

[English](2026-08-17-git-repo-picker-current-workspace.md) | 中文

## Problem

源代码管理的仓库下拉会列出每一个已登记工作区，以及这些文件夹下的子仓。右侧栏项目一多（`sanmu`、`jianghuawei`、`worldCoffee`…），下拉里就会混进无关仓库。资源管理器已经只显示当前会话那一棵目录；Git 没有。更早的[加工作区后出现选择器](2026-08-17-git-workspace-repo-picker.md)会走遍注册表，好让新加的兄弟仓不用换会话就能出现——名单就是这样被撑满的。

## Decision

`gitWorkspaceSeeds` 只留会话 cwd（和 `resolveExplorerRoots` 同一棵文件夹）以及登记在它下面的路径。父目录、兄弟目录、右侧栏其它项目在 `discoverGitRoots` 跑之前就丢掉。`apply` 传给 `getWorkspacePaths` 的也只有当前资源管理器根，所以这一页连外项目的 Workspace 都不会列。当前文件夹本身不是仓库时，一层子目录发现还在（`sanmu` → `sanmu_hd` / `sanmu_qd`）。

## Alternatives considered

**继续探测每个已登记工作区，再在下拉里加过滤框。** 否决：右侧栏已经是项目选择器。再做一层过滤是重复，而且还会给每个外项目打 RPC。

**把当前仓库的已登记父目录也当种子（就能看见兄弟仓）。** 否决：那是上一版「加工作区」的行为，也正是 `deepseek-harness` 会话里混进 `dsh-cursor-acp` 的原因。要看那些子仓，把对话切到父项目即可。

## Consequences

Git 下拉跟右侧栏当前项目对齐。再登记一个无关工作区，不会撑大当前会话的选择器。换到另一个文件夹的会话会换种子。`discoverGitRoots` 本身没改，只是输入被收窄了。
