## 中文
- UI 优化：`同步到其他工具` 与 `卸载` 按钮改为同一行展示。
- 文案优化：`卸载技能` 按钮文案改为 `卸载`。
- 交互修复：点击 `卸载` 必弹确认框（确认是否删除）。
- 行为修复：修复点击卸载无响应问题，确认后可正常执行卸载并刷新列表。
- 仅发布 macOS 资产（无 Windows/Linux）。

### 安装与“文件已损坏”处理
1. 将 `SkillFlow Mac.app` 拖到 `/Applications`。
2. 若打开时提示“文件已损坏”，在终端执行：

```bash
xattr -cr /Applications/SkillFlow\ Mac.app
```

3. 再次打开应用。

## English
- UI update: `Sync to Other Tools` and `Uninstall` are now displayed on one row.
- Copy update: button text changed from `卸载技能` to `卸载`.
- Interaction fix: clicking `Uninstall` always opens a confirmation dialog.
- Behavior fix: fixed no-response uninstall issue; confirmed uninstall now removes skill and refreshes list.
- macOS-only assets (no Windows/Linux).

### Install & "app is damaged" workaround
1. Move `SkillFlow Mac.app` to `/Applications`.
2. If macOS reports the app is damaged, run:

```bash
xattr -cr /Applications/SkillFlow\ Mac.app
```

3. Launch the app again.

## Assets
- SkillFlow-Mac_0.1.2_aarch64.app.zip
- SkillFlow-Mac_0.1.2_aarch64.dmg
- SHA256SUMS.txt
