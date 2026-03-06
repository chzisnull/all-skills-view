# R6-01 Skills 市场链接修正

## 目标
将 Skills 市场中的占位/非 skills 仓库链接替换为真实 skills 仓库链接，并确认链接可达。

## 新链接映射
- `Anthropic Skills` -> `https://github.com/anthropics/skills`
- `AI Agent Skills` -> `https://github.com/skillcreatorai/Ai-Agent-Skills`
- `Claude Code Skills` -> `https://github.com/daymade/claude-code-skills`
- `OpenCode Skills` -> `https://github.com/malhashemi/opencode-skills`

## 兼容处理
- 如果本地 `skillflow.skillMarketSites` 仍保存旧默认站点：
  - `https://chatgpt.com/gpts`
  - `https://huggingface.co/spaces`
  - `https://github.com/f/awesome-chatgpt-prompts`
  - `https://promptbase.com`
- 启动时会自动迁移为新的 skills 仓库列表，避免旧缓存继续显示错误链接。

## 校验结果
- `curl -I -L` 四条链接均返回 `200`
- `npm --prefix frontend run build` 通过

## 代码位置
- `frontend/src/App.tsx`
