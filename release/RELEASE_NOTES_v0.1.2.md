# SkillFlow Mac v0.1.2 Release Notes

## 中文

### 本次更新
- 将 `同步到其他工具` 与 `卸载` 按钮改为同一行展示。
- 按钮文案由 `卸载技能` 调整为 `卸载`。
- 点击 `卸载` 强制弹出确认框，明确是否删除。
- 修复点击卸载无响应问题，确认后可正常删除并刷新列表。

### 发布策略
- 仅发布 macOS 资产。
- 不提供 Windows / Linux 安装包。

### 资产
- `SkillFlow-Mac_0.1.2_aarch64.app.zip`
- `SkillFlow-Mac_0.1.2_aarch64.dmg`
- `SHA256SUMS.txt`

### 损坏提示处理
```bash
xattr -cr /Applications/SkillFlow\ Mac.app
```

---

## English

### Changes
- `Sync to Other Tools` and `Uninstall` buttons are now in a single row.
- Button copy changed from `卸载技能` to `卸载`.
- Clicking `Uninstall` now always shows a confirmation dialog.
- Fixed no-response uninstall behavior; confirmed uninstall now works and refreshes list.

### Release Policy
- macOS-only assets.
- No Windows / Linux artifacts.

### Assets
- `SkillFlow-Mac_0.1.2_aarch64.app.zip`
- `SkillFlow-Mac_0.1.2_aarch64.dmg`
- `SHA256SUMS.txt`

### Damaged-app workaround
```bash
xattr -cr /Applications/SkillFlow\ Mac.app
```
