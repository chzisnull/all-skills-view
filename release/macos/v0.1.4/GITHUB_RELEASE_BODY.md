## 中文
- 发布版本：`v0.1.4`（mac-only）。
- 本次包含 R3 全量收口能力：
  - 智能翻译实验开关（默认关闭）
  - 离线优先 + 异步优化 + `content_hash + language` 缓存
  - 中文描述搜索命中与高亮
  - 术语词典修正与发布运维文档补齐
- 仅发布 macOS 资产，不包含 Windows/Linux。

### 安装与“文件已损坏”处理
1. 将 `SkillFlow Mac.app` 拖到 `/Applications`。
2. 若打开时提示“文件已损坏”，执行：

```bash
xattr -cr /Applications/SkillFlow\ Mac.app
```

3. 再次打开应用。

## English
- Release version: `v0.1.4` (mac-only).
- Includes complete R3 closure:
  - Smart translation experimental switch (default OFF)
  - Offline-first + async enhancement + `content_hash + language` cache
  - Chinese description search matching and highlighting
  - Terminology dictionary fixes and release ops documentation updates
- macOS-only assets, no Windows/Linux artifacts.

### Install & "app is damaged" workaround
1. Move `SkillFlow Mac.app` to `/Applications`.
2. If macOS reports the app is damaged, run:

```bash
xattr -cr /Applications/SkillFlow\ Mac.app
```

3. Launch the app again.

## Assets
- SkillFlow-Mac_0.1.4_aarch64.app.zip
- SkillFlow-Mac_0.1.4_aarch64.dmg
- SHA256SUMS.txt
