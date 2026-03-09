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
- 当前离线中文描述链路本身就是免费的；不开启增强翻译也可正常使用。
- 用户开启智能翻译后，即使不配置任何环境变量，应用也会默认尝试内置的免费 `LibreTranslate` 社区镜像；若配置了 `LIBRETRANSLATE_URL`，则优先使用你自己的服务。
- 智能翻译开启时，应用会把当前技能的 `description` 文本发送到实际命中的外部翻译后端；默认公共镜像属于 best-effort 社区资源，可能限流、波动或失效。
- 增强翻译遵循“离线优先、在线增强”策略：在线结果只做覆盖优化，不改变离线回退链路。

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

#### 增强翻译环境变量（可选）

默认情况下无需任何配置：开启智能翻译后，应用会先尝试内置公共免费镜像；只有你想改成私有或自托管后端时，才需要下面这些变量：

```bash
# 可选：改用你自己的 LibreTranslate 兼容服务
export LIBRETRANSLATE_URL="http://127.0.0.1:5000"
export LIBRETRANSLATE_API_KEY=""

# 可选：无自定义 LibreTranslate 时，追加 OpenAI 作为后备
export OPENAI_API_KEY="<your-api-key>"
export OPENAI_TRANSLATION_MODEL="gpt-4.1-mini"

# 通用超时配置
export OPENAI_TRANSLATION_TIMEOUT_MS="15000"
```

- `LIBRETRANSLATE_URL`：可选。用于覆盖默认公共免费镜像，接入你自己的自托管或兼容服务；可写基础地址，应用会自动补成 `/translate`。
- `LIBRETRANSLATE_API_KEY`：可选，服务端若要求鉴权再配置。
- `OPENAI_API_KEY`：可选后备，仅在未配置 `LIBRETRANSLATE_URL` 时才会加入后备链路。
- `OPENAI_TRANSLATION_MODEL`：可选，默认 `gpt-4.1-mini`。
- `OPENAI_TRANSLATION_TIMEOUT_MS`：通用请求超时毫秒数，默认 `15000`。

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

#### Q5：如何做一次真实智能翻译烟测？
- A：现在默认无需配置环境变量；直接启动 `npm run tauri dev`，然后开启“启用智能翻译（实验性）”即可。
- A：选择一个仅含英文 `description` 的技能，确认列表说明会在异步请求后变成更完整的中文。
- A：若无变化，先检查公共免费镜像是否暂时不可用；若你需要更稳定或私有的服务，再设置 `LIBRETRANSLATE_URL`。

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
- The offline description path is already free and works without any network service.
- When smart translation is enabled, the app now works out of the box: it first tries a built-in free `LibreTranslate` community mirror even if you provide no configuration.
- Smart translation sends the current skill `description` to the active external translation backend; the default public mirror is a best-effort community resource and may be rate-limited, unstable, or unavailable.
- The translation flow remains offline-first and online-enhanced: online output only improves displayed text and never replaces the offline fallback chain.

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

#### Optional enhanced translation environment variables

No configuration is required for the default online-enhanced path. Set these only when you want to override the built-in public free mirror or add a private fallback.

```bash
# Optional: use your own LibreTranslate-compatible service
export LIBRETRANSLATE_URL="http://127.0.0.1:5000"
export LIBRETRANSLATE_API_KEY=""

# Optional: add OpenAI only when no custom LibreTranslate URL is set
export OPENAI_API_KEY="<your-api-key>"
export OPENAI_TRANSLATION_MODEL="gpt-4.1-mini"

# Shared timeout
export OPENAI_TRANSLATION_TIMEOUT_MS="15000"
```

- `LIBRETRANSLATE_URL`: optional override for the built-in public free mirror; you can provide a base URL and the app auto-normalizes it to `/translate`.
- `LIBRETRANSLATE_API_KEY`: optional, only needed when your LibreTranslate service requires authentication.
- `OPENAI_API_KEY`: optional fallback, added only when `LIBRETRANSLATE_URL` is not configured.
- `OPENAI_TRANSLATION_MODEL`: optional, defaults to `gpt-4.1-mini`.
- `OPENAI_TRANSLATION_TIMEOUT_MS`: shared request timeout in milliseconds, defaults to `15000`.

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

#### Q5: How do I run a real smart-translation smoke test?
- A: No environment variables are required now; start the app with `npm run tauri dev`, then turn on “Smart translation (experimental)”.
- A: Open a skill that only has an English `description` and confirm the list text upgrades asynchronously to a fuller Chinese translation.
- A: If nothing changes, the default public free mirror may be temporarily unavailable; set `LIBRETRANSLATE_URL` if you want a more stable or private backend.
