# SkillFlow Mac v0.1.5 Release Notes

## 中文

### 本次重点
- 描述翻译覆盖增强：只要技能存在 `description`，都会产出中文描述，不再回退到占位文案。
- 新增左侧 `Skills 市场` 分组：内置主流技能下载站点，点击后通过系统浏览器打开。
- 新增左侧 `全局Skills` 入口（位于 `Codex` 之前），固定扫描目录 `/Users/chz/.agents/skills/`。
- 保持既有核心链路不回退：搜索/高亮、同步、卸载、详情预览保持兼容。

### 发布策略
- 仅发布 macOS 资产（无 Windows/Linux）。

### 下载资产
- `SkillFlow-Mac_0.1.5_aarch64.app.zip`
- `SkillFlow-Mac_0.1.5_aarch64.dmg`
- `SHA256SUMS.txt`

### 校验
```bash
shasum -a 256 SkillFlow-Mac_0.1.5_aarch64.app.zip
shasum -a 256 SkillFlow-Mac_0.1.5_aarch64.dmg
```

---

## English

### Highlights
- Description coverage enhancement: whenever a skill has a `description`, the UI now renders a Chinese description instead of placeholder fallback text.
- Added `Skills Market` section in the left sidebar with built-in popular skill download sites opened via system browser.
- Added `Global Skills` tab before `Codex`, scanning fixed root path `/Users/chz/.agents/skills/`.
- Existing critical flows remain compatible: search/highlight, sync, uninstall, and detail preview.

### Release Policy
- macOS-only assets (no Windows/Linux).

### Assets
- `SkillFlow-Mac_0.1.5_aarch64.app.zip`
- `SkillFlow-Mac_0.1.5_aarch64.dmg`
- `SHA256SUMS.txt`

### Verify
```bash
shasum -a 256 SkillFlow-Mac_0.1.5_aarch64.app.zip
shasum -a 256 SkillFlow-Mac_0.1.5_aarch64.dmg
```
