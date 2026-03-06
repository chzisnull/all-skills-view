# R6-03 Correction - 多行 frontmatter description 解析修复

## 背景

独立复核指出：`src-tauri/src/adapters/mod.rs` 仅支持单行 `key: value` frontmatter，遇到 YAML 多行块标量：

- `description: >`
- `description: |`

会把值错误读成单个 `>` 或 `|`，导致前端即使已有基于原始 description 的中文派生逻辑，也仍可能回退到模板句。

## 修复内容

- 扩展 `read_frontmatter_value()` / `parse_frontmatter_line()`
- 新增 `parse_multiline_frontmatter_value()`
- 支持读取 YAML folded (`>`) 与 literal (`|`) 多行 frontmatter
- folded 模式按空格折叠为单行字符串
- literal 模式保留换行

## 新增 Rust 回归测试

- `read_description_supports_folded_multiline_frontmatter`
- `read_description_supports_literal_multiline_frontmatter`

## 本次复测命令

### 1. Rust 新增回归用例

```bash
cargo test -q --manifest-path src-tauri/Cargo.toml read_description_supports_
```

### 2. Rust 全量测试

```bash
cargo test -q --manifest-path src-tauri/Cargo.toml
```

### 3. 前端中文派生回归

```bash
node --experimental-strip-types --test frontend/src/zhDescription.test.ts
```

### 4. 前端构建

```bash
npm --prefix frontend run build
```

## 实测结果

- `cargo test -q --manifest-path src-tauri/Cargo.toml read_description_supports_` -> 通过
- `cargo test -q --manifest-path src-tauri/Cargo.toml` -> `28 passed / 0 failed`
- `node --experimental-strip-types --test frontend/src/zhDescription.test.ts` -> `3 passed / 0 failed`
- `npm --prefix frontend run build` -> 通过

## 影响范围

- 修复后，像 `/Users/chz/.agents/skills/agent-reach/SKILL.md` 这类使用 `description: >` 的技能，会把完整 description 传到前端，再进入中文派生链路。
- 这次修复的是数据源读取根因，不是仅在前端继续兜底。