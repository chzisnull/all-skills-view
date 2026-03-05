## 中文
- 新增功能：支持在技能详情页直接“卸载技能”。
- 卸载后自动刷新技能列表并显示完成提示。
- 仅发布 macOS 资产（无 Windows/Linux）。
- Source commit: `0419c82`

### 安装与“文件已损坏”处理
1. 将 `SkillFlow Mac.app` 拖到 `/Applications`。
2. 若打开时提示“文件已损坏”，在终端执行：

```bash
xattr -cr /Applications/SkillFlow\ Mac.app
```

3. 再次打开应用。

## English
- New: uninstall skills directly from the skill detail panel.
- The list auto-refreshes after uninstall and shows a success message.
- macOS-only assets (no Windows/Linux).
- Source commit: `0419c82`

### Install & "app is damaged" workaround
1. Move `SkillFlow Mac.app` to `/Applications`.
2. If macOS reports the app is damaged, run:

```bash
xattr -cr /Applications/SkillFlow\ Mac.app
```

3. Launch the app again.

## Assets
- SkillFlow-Mac_0.1.1_aarch64.app.zip
- SkillFlow-Mac_0.1.1_aarch64.dmg
- SHA256SUMS.txt
