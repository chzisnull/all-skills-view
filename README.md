# SkillFlow Mac

[中文](#中文) | [English](#english)

---

## 中文

### 目录
- [项目介绍](#zh-overview)
- [安装](#zh-install)
- [开发调试](#zh-dev)
- [构建](#zh-build)
- [中文描述与搜索规则](#zh-description-rules)
- [FAQ 与运维排查](#zh-faq)
- [发布](#zh-release)

<a id="zh-overview"></a>
### 项目介绍

SkillFlow Mac 是一个基于 Tauri + React 的本地技能管理工具，面向多工具技能目录（例如 Codex / OpenCode / OpenClaw / Claude）提供：

- 本地扫描与索引（`scan_roots` + `build_index`）
- 技能详情预览（支持失败重试与入口兜底）
- 手动复制到目标工具目录（冲突策略：同名即拒绝，提示“已存在，不允许复制”）
- 支持技能卸载（在详情页一键卸载）

<a id="zh-description-rules"></a>
### 中文描述与搜索规则

#### 中文描述来源优先级

按以下顺序选择展示文案（命中即停止）：

1. SKILL.md/frontmatter 内已有中文字段（原文优先）
2. 高频技能白名单映射（术语统一）
3. 内置中文规则映射（离线）
4. 英文描述离线回退翻译（本地规则）
5. 无可用结果时显示：`暂无中文说明`

#### 搜索与高亮规则

- 搜索同时匹配 `技能名称 + 中文描述`。
- 中文关键词命中后，列表中的名称与中文描述都会高亮命中片段。
- 保持原有工具筛选与列表顺序，不因为搜索高亮改变排序逻辑。

#### 失败回退与隐私说明

- 默认主链路为离线中文描述，不依赖在线翻译服务。
- “启用智能翻译（实验性）”默认关闭；开启后仅做异步增强，失败或超时会自动回退离线描述，不阻塞 UI。
- 当前实现不向外部服务上传技能内容；若后续接入在线翻译，建议在发布说明中明确合规与数据边界。

<a id="zh-install"></a>
### 安装

开发环境建议：

- Node.js 20+
- Rust stable（含 `cargo`）
- macOS（当前发布仅提供 macOS 产物）

安装依赖：

```bash
npm install
cd frontend && npm install && cd ..
```

<a id="zh-dev"></a>
### 开发调试

启动桌面开发模式：

```bash
npm run tauri dev
```

常用命令：

```bash
# 根工程前端构建（代理到 frontend）
npm run build

# 前端子工程构建
cd frontend && npm run build

# 后端测试
cd src-tauri && cargo test -q
```

<a id="zh-build"></a>
### 构建

生成 macOS 应用包（.app）：

```bash
npm run tauri build -- --bundles app
```

构建产物示例：

- `src-tauri/target/release/bundle/macos/SkillFlow Mac.app`

<a id="zh-release"></a>
### 发布

#### 仅 macOS 发布策略

- GitHub Releases **只发布 macOS 产物**，不提供 Windows/Linux 包。
- 推荐发布资产：
  - `SkillFlow Mac.app`（可选）
  - `SkillFlow-Mac_*.app.zip`
  - `SkillFlow-Mac_*.dmg`（可选）

#### 下载与校验指引

1. 打开 GitHub Releases，选择最新 tag（例如 `v0.1.5`）。
2. 下载 `.app.zip` 或 `.dmg`。
3. 执行校验：

```bash
shasum -a 256 <downloaded-file>
```

4. 若为 `.app.zip`，解压后将 `SkillFlow Mac.app` 拖入 `/Applications`。

#### 发布排查（文案回退/界面未更新）

若发布后发现中文文案回退或仍显示旧版本 UI，优先检查打包入口和前端产物目录：

```bash
# 1) 确认 tauri 打包入口是否指向 frontend 子工程与 dist
rg -n "beforeDevCommand|beforeBuildCommand|frontendDist" src-tauri/tauri.conf.json

# 2) 重建前端产物并确认 dist 存在
npm --prefix frontend run build
ls -lah frontend/dist

# 3) 重新打包 mac 产物
npm run tauri build -- --bundles app,dmg
```

<a id="zh-faq"></a>
### FAQ 与运维排查

#### Q1：智能翻译开关是做什么的？默认为什么关闭？
- A：默认展示离线中文说明；开启后才会异步优化描述。默认关闭可避免不稳定翻译影响主链路体验。

#### Q2：如何让缓存失效并验证最新文案？
- A：缓存键基于 `content_hash + language`。修改技能内容并刷新扫描后会生成新 hash，自然触发新缓存。

#### Q3：翻译失败会不会影响使用？
- A：不会。失败或超时会自动降级到离线中文描述，不阻塞列表展示、详情预览、卸载和同步。

#### Q4：常见排查命令有哪些？

```bash
# 前端开发/构建
npm --prefix frontend run dev
npm --prefix frontend run build

# 后端测试
cargo test -q --manifest-path src-tauri/Cargo.toml

# 中文描述语义回归（20样本）
node release/verification/r3-03c-local-20-samples.cjs
```

---

## English

### Table of Contents
- [Overview](#en-overview)
- [Install](#en-install)
- [Dev](#en-dev)
- [Build](#en-build)
- [Chinese Description & Search Rules](#en-description-rules)
- [FAQ & Operations](#en-faq)
- [Release](#en-release)

<a id="en-overview"></a>
### Overview

SkillFlow Mac is a local skill management app built with Tauri + React. It provides:

- Local scan and indexing (`scan_roots` + `build_index`)
- Skill detail preview (with retry and fallback path handling)
- Manual copy to target tool directories (conflict policy: hard reject on duplicate name, message: `"已存在，不允许复制"`)
- Skill uninstall action from the detail panel

<a id="en-description-rules"></a>
### Chinese Description & Search Rules

#### Description source priority

UI text is selected in this order:

1. Existing Chinese text in SKILL.md/frontmatter
2. High-frequency whitelist mapping (term normalization)
3. Built-in Chinese rule mapping (offline)
4. Offline English-to-Chinese fallback
5. Final fallback: `暂无中文说明`

#### Search and highlight behavior

- Search matches both `skill name + Chinese description`.
- Matched Chinese keywords are highlighted in both fields.
- Existing filter and list ordering behavior remains unchanged.

#### Fallback and privacy

- Offline description is the default path (no external translation required).
- “Smart translation (experimental)” is OFF by default; when enabled, it runs asynchronously and falls back to offline text on timeout/failure.
- Current implementation does not send skill content to external services.

<a id="en-install"></a>
### Install

Recommended environment:

- Node.js 20+
- Rust stable (`cargo`)
- macOS (release artifacts are macOS-only)

Install dependencies:

```bash
npm install
cd frontend && npm install && cd ..
```

<a id="en-dev"></a>
### Dev

Run desktop app in development mode:

```bash
npm run tauri dev
```

Useful commands:

```bash
# Root build (delegates to frontend)
npm run build

# Frontend-only build
cd frontend && npm run build

# Backend tests
cd src-tauri && cargo test -q
```

<a id="en-build"></a>
### Build

Build macOS app bundle (.app):

```bash
npm run tauri build -- --bundles app
```

Output example:

- `src-tauri/target/release/bundle/macos/SkillFlow Mac.app`

<a id="en-release"></a>
### Release

#### macOS-only release policy

- GitHub Releases publish **macOS artifacts only**.
- Do not publish Windows/Linux artifacts.
- Recommended assets:
  - `SkillFlow Mac.app` (optional)
  - `SkillFlow-Mac_*.app.zip`
  - `SkillFlow-Mac_*.dmg` (optional)

#### Download guide

1. Open GitHub Releases and choose the latest tag (for example `v0.1.5`).
2. Download `.app.zip` or `.dmg`.
3. Verify checksum:

```bash
shasum -a 256 <downloaded-file>
```

4. If using `.app.zip`, unzip and move `SkillFlow Mac.app` into `/Applications`.

#### Release troubleshooting (text rollback / stale UI)

If a release still shows old UI text, verify build entry points and frontend dist first:

```bash
# 1) Check tauri entry points and frontend dist path
rg -n "beforeDevCommand|beforeBuildCommand|frontendDist" src-tauri/tauri.conf.json

# 2) Rebuild frontend and verify dist artifacts
npm --prefix frontend run build
ls -lah frontend/dist

# 3) Rebuild mac bundles
npm run tauri build -- --bundles app,dmg
```

<a id="en-faq"></a>
### FAQ & Operations

#### Q1: Why is smart translation off by default?
- A: Offline descriptions are the stable baseline. Smart translation only enhances text asynchronously and must not affect the core UX.

#### Q2: How do I invalidate cache?
- A: Cache key is `content_hash + language`. Updating skill content and rescanning changes hash and naturally refreshes cache.

#### Q3: What happens on translation failure?
- A: The UI auto-falls back to offline descriptions; list/detail/uninstall/sync flows are not blocked.

#### Q4: Useful troubleshooting commands

```bash
# Frontend dev/build
npm --prefix frontend run dev
npm --prefix frontend run build

# Backend tests
cargo test -q --manifest-path src-tauri/Cargo.toml

# Chinese description quality regression (20 samples)
node release/verification/r3-03c-local-20-samples.cjs
```
