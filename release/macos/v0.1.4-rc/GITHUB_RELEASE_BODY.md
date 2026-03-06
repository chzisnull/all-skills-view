## 中文
- 产出 `v0.1.4 RC`（mac-only）候选包，用于 R4 回归验收。
- 本次 RC 覆盖能力：
  - 智能翻译实验开关（默认关闭）
  - 离线优先 + 异步优化 + 本地缓存策略
  - 中文描述搜索命中与高亮
  - 词典/术语修正与发布运维文档补齐
- 仅发布 macOS 资产（无 Windows/Linux）。

### 安装与“文件已损坏”处理
1. 将 `SkillFlow Mac.app` 拖到 `/Applications`。
2. 若打开时提示“文件已损坏”，执行：

```bash
xattr -cr /Applications/SkillFlow\ Mac.app
```

3. 再次打开应用。

## English
- Produced `v0.1.4 RC` (mac-only) candidate for R4 regression acceptance.
- This RC includes:
  - Smart translation experimental switch (default OFF)
  - Offline-first + async enhancement + local caching
  - Chinese description search matching and highlighting
  - Dictionary/terminology fixes and release ops documentation updates
- macOS-only assets (no Windows/Linux).

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
