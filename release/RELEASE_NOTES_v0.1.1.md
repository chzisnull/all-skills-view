# SkillFlow Mac v0.1.1 Release Notes

## 中文

### 变更
- 新增“卸载技能”功能：可在技能详情页直接卸载当前技能。
- 卸载成功后自动刷新列表并显示状态提示。

### 发布策略（重要）
- 本版本仅发布 macOS 资产。
- 不提供 Windows / Linux 安装包。

### 下载资产（macOS）
- `SkillFlow-Mac_0.1.1_aarch64.app.zip`
- `SkillFlow-Mac_0.1.1_aarch64.dmg`
- `SHA256SUMS.txt`

### 安装与损坏提示处理
```bash
xattr -cr /Applications/SkillFlow\ Mac.app
```

---

## English

### Changes
- Added an `Uninstall Skill` action in the skill detail view.
- The skill list now refreshes automatically after uninstall.

### Release Policy (Important)
- This release ships macOS assets only.
- No Windows / Linux artifacts are published.

### Assets (macOS)
- `SkillFlow-Mac_0.1.1_aarch64.app.zip`
- `SkillFlow-Mac_0.1.1_aarch64.dmg`
- `SHA256SUMS.txt`

### Damaged-app workaround
```bash
xattr -cr /Applications/SkillFlow\ Mac.app
```
