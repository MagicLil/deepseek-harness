# @deepseek-ai/dsh-reasonix-runtime

面向 Reasonix 运行时模式的 DSH Agent 级保护插件。它不修改模型提供方，也不改变默认 DSH 运行时；`runtimeMode` 在当前 Agent 作用域选择工具面：`economy` 保留直接文件、Shell、确认和 todo 工具，`balanced` 追加搜索、网页、skill、目标和子 Agent 工具，`delivery` 保留当前可见的全部工具。插件按 Agent 统计连续相同且失败的工具调用，在达到 `failureThreshold` 后阻止下一次重复尝试，并注入简短的改换证据或方案提示。

该插件与 `repeat-tool-reminder` 分开：后者是建议性提醒，本插件是只对 Reasonix 模式启用的熔断器。大结果保留继续复用宿主的 `@deepseek-ai/dsh-spill-policy`。

```yaml
- id: reasonix-runtime
  name: '@deepseek-ai/dsh-reasonix-runtime'
  config:
    runtimeMode: balanced
    failureThreshold: 3
    exclude: [todo_write]
```
