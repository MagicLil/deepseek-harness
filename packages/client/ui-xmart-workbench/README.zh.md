# @deepseek-ai/dsh-client-ui-xmart-workbench

[English](README.md) | 中文

X-Mart 工作台插件：对话旁的空右侧栏。`WorkbenchColumn` 填充框架声明的 `workbench` slot；`WorkbenchToggle` 填充 `shell.overlay`，以便关闭后重新打开。两个界面都通过 `ctx.layout` 驱动面板切换。新会话默认关闭工作台。打开时写入约定默认宽度（400px）；若该会话上次拖动的宽度不同，占用方再把它恢复回去。关闭、拖动和切换会话会把开/关状态以及最后一次非零宽度记入按会话隔离的持久化 store（`dsh.xmart.workbench`）。布局 store 本身保持瞬时，不持久化。该栏目前只渲染标题、关闭按钮和占位文案——文件、编辑、Git 与终端在后续阶段加入。现有 `ui-editor` 对话视图 tab 保持不变。该包不提供服务，也不声明 Context 合并。

`workbench` slot 由 ui-layout 声明，因此 `apply` 使用 `slots.inject()` 在声明生命周期内完成注册，并在目标 slot 的声明恢复后重新注册。

## 模型体验

无。工作台属于浏览器界面；这里没有任何内容进入模型请求。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

## 已知限制与暂缓事项

- **空栏**：Phase 0 只交付外壳；资源管理器、编辑器、Git 与终端 tab 属于后续阶段。
- **尚无 `ctx.xmartWorkbench` 注册表**：tab 与 viewer 注册从 Phase 1 开始。
- **布局偏好在占用方恢复之前是瞬时的**：整页重新加载会把布局 store 中的工作台宽度清为关闭；占用方在挂载后按会话持久化记录重新应用。
- **让步可能隐藏仍为打开的偏好**：窄视口可能把工作台轨道推导为零宽度而不清除已存储的偏好；窗口变宽后会恢复。
