# R6-02 全局 Skills 标签修复验证

## 目标
修复全局 Skills 视图中标签统一显示为泛化值的问题，改为按真实技能类型/来源展示。

## 实现摘要
- 文件：`frontend/src/App.tsx`
- 新增 `resolveGlobalSkillBadgeLabel()` 与 `formatSkillBadgeLabel()`
- 仅对 `GLOBAL_SKILLS_ROOT=/Users/chz/.agents/skills/` 下的技能启用专用标签解析
- 非全局技能继续沿用原有 `formatToolLabel()`，不改变现有工具标签行为

## 当前全局技能样本与标签结果
| Skill Name | 说明来源 | 修复后标签 |
| --- | --- | --- |
| `agent-reach` | 名称/description 含 `reach` / `internet` / `web search` | `联网搜索` |
| `commander-orchestrator` | 名称/description 含 `commander` / `orchestrator` | `指挥编排` |
| `executor-agent` | 名称/description 含 `executor` / `delegated` | `执行代理` |

## 验证命令
1. `npm --prefix frontend run build`
   - 结果：通过
   - 产物：`dist/assets/index-B1wXmSkQ.css` / `dist/assets/index-CAK7F9-g.js`
2. `cargo test -q --manifest-path src-tauri/Cargo.toml`
   - 结果：通过，`26 passed / 0 failed`

## 风险说明
- 当前规则优先覆盖 owner 已指出的全局技能样本。
- 若后续新增更多全局技能名称，未知项会回落到基于 skill name 的人类可读标签，而不是继续显示泛化值。
