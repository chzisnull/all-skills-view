# SkillFlow Mac v0.1.7 Release Notes

## 中文

### 本次重点
- 修复 `Codex` 默认扫描根目录遗漏问题：现在会同时扫描 `~/.codex/skills`、`~/.codex/superpowers/skills` 与 `/etc/codex/skills`。
- 修复因目录遗漏导致的列表缺失问题：放在 `superpowers` 里的技能会正常进入技能列表与索引结果。
- 新增回归测试，锁定 `Codex superpowers` 根目录，避免后续版本再次漏扫。

### 发布策略
- 仅发布 macOS 资产（无 Windows/Linux）。

### 下载资产
- `SkillFlow-Mac_0.1.7_aarch64.app.zip`
- `SkillFlow-Mac_0.1.7_aarch64.dmg`
- `SHA256SUMS.txt`

### 校验
```bash
shasum -a 256 SkillFlow-Mac_0.1.7_aarch64.app.zip
shasum -a 256 SkillFlow-Mac_0.1.7_aarch64.dmg
```

---

## English

### Highlights
- Fixed missing default Codex scan root: the app now scans `~/.codex/skills`, `~/.codex/superpowers/skills`, and `/etc/codex/skills`.
- Fixed missing list/index coverage for skills stored under the `superpowers` tree.
- Added a regression test to lock the `Codex superpowers` root and prevent future scan gaps.

### Release Policy
- macOS-only assets (no Windows/Linux).

### Assets
- `SkillFlow-Mac_0.1.7_aarch64.app.zip`
- `SkillFlow-Mac_0.1.7_aarch64.dmg`
- `SHA256SUMS.txt`

### Verify
```bash
shasum -a 256 SkillFlow-Mac_0.1.7_aarch64.app.zip
shasum -a 256 SkillFlow-Mac_0.1.7_aarch64.dmg
```
