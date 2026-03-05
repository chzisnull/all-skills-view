## 中文
- 首个公开版本，支持技能扫描、预览与同步。
- 仅发布 macOS 资产（无 Windows/Linux）。
- 下载后请按 SHA256 校验。\
  校验清单：`SHA256SUMS.txt`
- Source commit: `fcd6e0d`

### 安装与“文件已损坏”处理
1. 将 `SkillFlow Mac.app` 拖到 `/Applications`。
2. 若打开时提示“文件已损坏”，在终端执行：

```bash
xattr -cr /Applications/SkillFlow\ Mac.app
```

3. 再次打开应用。

## English
- First public release with scan/preview/sync workflows.
- macOS-only assets (no Windows/Linux).
- Verify binaries with SHA256.\
  Checksum file: `SHA256SUMS.txt`
- Source commit: `fcd6e0d`

### Install & "app is damaged" workaround
1. Move `SkillFlow Mac.app` to `/Applications`.
2. If macOS reports the app is damaged, run:

```bash
xattr -cr /Applications/SkillFlow\ Mac.app
```

3. Launch the app again.

## Assets
- SkillFlow-Mac_0.1.0_aarch64.app.zip
- SkillFlow-Mac_0.1.0_aarch64.dmg
- SHA256SUMS.txt
