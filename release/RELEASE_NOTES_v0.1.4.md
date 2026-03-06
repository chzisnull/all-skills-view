# SkillFlow Mac v0.1.4 Release Notes

## 中文

### 本次重点
- 新增智能翻译实验开关（默认关闭），维持离线优先主链路。
- 描述生成支持异步优化与本地缓存（`content_hash + language`）。
- 列表搜索支持中文描述命中，并提供中文高亮。
- 术语映射与离线 fallback 词典完成多轮修正，门禁复验通过。
- README 补齐中文描述来源、失败回退、隐私边界与发布排查。

### 发布策略
- 仅发布 macOS 资产（无 Windows/Linux）。

### 下载资产
- `SkillFlow-Mac_0.1.4_aarch64.app.zip`
- `SkillFlow-Mac_0.1.4_aarch64.dmg`
- `SHA256SUMS.txt`

### 校验
```bash
shasum -a 256 SkillFlow-Mac_0.1.4_aarch64.app.zip
shasum -a 256 SkillFlow-Mac_0.1.4_aarch64.dmg
```

---

## English

### Highlights
- Added smart translation experimental switch (default OFF), keeping offline-first baseline.
- Description flow supports async enhancement with local cache (`content_hash + language`).
- Search now matches Chinese descriptions and highlights Chinese keywords.
- Terminology mapping and offline fallback dictionary passed multi-round gate checks.
- README now includes source priority, fallback/privacy behavior, and release troubleshooting.

### Release Policy
- macOS-only assets (no Windows/Linux).

### Assets
- `SkillFlow-Mac_0.1.4_aarch64.app.zip`
- `SkillFlow-Mac_0.1.4_aarch64.dmg`
- `SHA256SUMS.txt`

### Verify
```bash
shasum -a 256 SkillFlow-Mac_0.1.4_aarch64.app.zip
shasum -a 256 SkillFlow-Mac_0.1.4_aarch64.dmg
```
