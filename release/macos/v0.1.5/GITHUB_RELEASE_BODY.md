## 中文
- 发布版本：`v0.1.5`（mac-only）。
- 本次包含 R5 阶段能力：
  - 描述翻译覆盖增强：有 `description` 就会生成中文描述
  - 左侧新增 `Skills 市场`（主流下载站点 + 外部浏览器跳转）
  - 左侧新增 `全局Skills`（位于 `Codex` 之前，扫描 `/Users/chz/.agents/skills/`）
- 仅发布 macOS 资产，不包含 Windows/Linux。

### 安装与“文件已损坏”处理
1. 将 `SkillFlow Mac.app` 拖到 `/Applications`。
2. 若打开时提示“文件已损坏”，执行：

```bash
xattr -cr /Applications/SkillFlow\ Mac.app
```

3. 再次打开应用。

## English
- Release version: `v0.1.5` (mac-only).
- Includes R5 feature closure:
  - Description coverage enhancement: whenever `description` exists, Chinese description is generated
  - New `Skills Market` sidebar section (popular download sites + external browser open)
  - New `Global Skills` tab (before `Codex`, scans `/Users/chz/.agents/skills/`)
- macOS-only assets, no Windows/Linux artifacts.

### Install & "app is damaged" workaround
1. Move `SkillFlow Mac.app` to `/Applications`.
2. If macOS reports the app is damaged, run:

```bash
xattr -cr /Applications/SkillFlow\ Mac.app
```

3. Launch the app again.

## Assets
- SkillFlow-Mac_0.1.5_aarch64.app.zip
- SkillFlow-Mac_0.1.5_aarch64.dmg
- SHA256SUMS.txt
