## 中文
- 发布版本：`v0.1.7`（mac-only）。
- 本次更新重点：
  - 修复 `Codex` 默认扫描目录遗漏，新增 `~/.codex/superpowers/skills`。
  - 修复 `superpowers` 技能未显示在技能列表中的问题。
  - 新增回归测试，防止后续版本再次漏扫该目录。
- 仅发布 macOS 资产，不包含 Windows/Linux。

### 安装与“文件已损坏”处理
1. 将 `SkillFlow Mac.app` 拖到 `/Applications`。
2. 若打开时提示“文件已损坏”，执行：

```bash
xattr -cr /Applications/SkillFlow\ Mac.app
```

3. 再次打开应用。

## English
- Release version: `v0.1.7` (mac-only).
- Highlights:
  - Fixed the missing default Codex scan directory by adding `~/.codex/superpowers/skills`.
  - Fixed the issue where `superpowers` skills were absent from the skill list.
  - Added a regression test to prevent this scan gap from returning.
- macOS-only assets, no Windows/Linux artifacts.

### Install & "app is damaged" workaround
1. Move `SkillFlow Mac.app` to `/Applications`.
2. If macOS reports the app is damaged, run:

```bash
xattr -cr /Applications/SkillFlow\ Mac.app
```

3. Launch the app again.

## Assets
- SkillFlow-Mac_0.1.7_aarch64.app.zip
- SkillFlow-Mac_0.1.7_aarch64.dmg
- SHA256SUMS.txt
