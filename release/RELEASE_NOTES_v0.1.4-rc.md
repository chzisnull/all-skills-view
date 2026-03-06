# SkillFlow Mac v0.1.4 RC Release Notes

## 中文

### 本次重点
- R3 第一阶段能力落地：
  - 新增“启用智能翻译（实验性）”开关（默认关闭）。
  - 描述加载链路为“离线优先 + 异步优化”。
  - 增加 `content_hash + language` 本地缓存策略与基础指标面板（请求数/命中率/失败率/平均耗时）。
- R3 质量修正落地：
  - 扩充离线 fallback 词典与术语白名单。
  - 修复术语漂移与重复词拼接异常。
  - 20 样本门禁复测达到通过阈值。
- R3 搜索体验增强：
  - 支持按“技能名 + 中文描述”命中。
  - 支持中文关键词高亮（名称与描述字段）。
- 文档与运维说明补齐：
  - README 增加中文描述来源优先级、失败回退与隐私说明、发布排查步骤。

### 发布策略（重要）
- 仅发布 macOS 资产。
- 不提供 Windows / Linux 安装包。

### RC 资产（macOS）
- `SkillFlow-Mac_0.1.4_aarch64.app.zip`
- `SkillFlow-Mac_0.1.4_aarch64.dmg`
- `SHA256SUMS.txt`

### 校验
```bash
shasum -a 256 SkillFlow-Mac_0.1.4_aarch64.app.zip
shasum -a 256 SkillFlow-Mac_0.1.4_aarch64.dmg
```

### 安装与损坏处理
- 将 `SkillFlow Mac.app` 拖到 `/Applications`。
- 若提示“文件已损坏”，执行：

```bash
xattr -cr /Applications/SkillFlow\ Mac.app
```

---

## English

### Highlights
- R3 phase-1 capabilities shipped:
  - Added `Enable Smart Translation (Experimental)` switch (default OFF).
  - Offline-first description flow with async enhancement.
  - Added local cache strategy (`content_hash + language`) and basic metrics panel.
- R3 quality hardening:
  - Expanded offline fallback dictionary and whitelist term mapping.
  - Fixed terminology drift and duplicate-token composition issues.
  - 20-sample gate recheck now meets pass thresholds.
- R3 search UX upgrade:
  - Search now matches both `skill name + Chinese description`.
  - Chinese keyword highlighting is enabled for both name and description.
- Docs and ops guide updates:
  - README now includes source-priority, fallback/privacy behavior, and release troubleshooting.

### Release Policy (Important)
- macOS assets only.
- No Windows / Linux artifacts.

### RC Assets (macOS)
- `SkillFlow-Mac_0.1.4_aarch64.app.zip`
- `SkillFlow-Mac_0.1.4_aarch64.dmg`
- `SHA256SUMS.txt`

### Verify
```bash
shasum -a 256 SkillFlow-Mac_0.1.4_aarch64.app.zip
shasum -a 256 SkillFlow-Mac_0.1.4_aarch64.dmg
```

### Install & Damaged-App Workaround
- Move `SkillFlow Mac.app` to `/Applications`.
- If macOS reports the app is damaged, run:

```bash
xattr -cr /Applications/SkillFlow\ Mac.app
```
