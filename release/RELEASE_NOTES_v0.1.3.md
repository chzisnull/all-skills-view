# SkillFlow Mac v0.1.3 Release Notes

## 中文

### 本次重点
- 新增 skills 列表“中文描述”展示（支持省略显示）。
- 新增详情页“中文作用说明”区块。
- 描述来源采用离线优先策略，保证无网络也可用：
  1. 优先读取 `SKILL.md` / frontmatter 里的中文字段。
  2. 命中内置中文映射（按常见 skill/tool 名称）。
  3. 英文 description 走本地规则翻译回退。
- 若无可用中文描述，统一显示：`暂无中文说明`。

### 发布策略（重要）
- 本版本仅发布 macOS 资产。
- 不提供 Windows / Linux 安装包。

### 下载资产（macOS）
- `SkillFlow-Mac_0.1.3_aarch64.app.zip`
- `SkillFlow-Mac_0.1.3_aarch64.dmg`
- `SHA256SUMS.txt`

### 校验
```bash
shasum -a 256 SkillFlow-Mac_0.1.3_aarch64.app.zip
shasum -a 256 SkillFlow-Mac_0.1.3_aarch64.dmg
```

### 安装与损坏处理
- 将 `SkillFlow Mac.app` 拖到 `/Applications`。
- 如提示“文件已损坏”，执行：

```bash
xattr -cr /Applications/SkillFlow\ Mac.app
```

---

## English

### Highlights
- Added Chinese description line in the skills list (ellipsis-friendly).
- Added a dedicated “Chinese purpose description” section in the detail panel.
- Offline-first description strategy (no network dependency):
  1. Prefer Chinese fields from `SKILL.md` frontmatter.
  2. Fallback to built-in Chinese mappings by common skill/tool names.
  3. Fallback to local rule-based translation from English description.
- If no usable Chinese text is available, show `暂无中文说明`.

### Release Policy (Important)
- macOS assets only.
- No Windows / Linux artifacts.

### Assets (macOS)
- `SkillFlow-Mac_0.1.3_aarch64.app.zip`
- `SkillFlow-Mac_0.1.3_aarch64.dmg`
- `SHA256SUMS.txt`

### Verify
```bash
shasum -a 256 SkillFlow-Mac_0.1.3_aarch64.app.zip
shasum -a 256 SkillFlow-Mac_0.1.3_aarch64.dmg
```

### Install & Damaged-App Workaround
- Move `SkillFlow Mac.app` to `/Applications`.
- If macOS reports app damaged, run:

```bash
xattr -cr /Applications/SkillFlow\ Mac.app
```
