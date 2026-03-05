# SkillFlow Mac

[中文](#中文) | [English](#english)

---

## 中文

### 目录
- [项目介绍](#zh-overview)
- [安装](#zh-install)
- [开发调试](#zh-dev)
- [构建](#zh-build)
- [发布](#zh-release)

<a id="zh-overview"></a>
### 项目介绍

SkillFlow Mac 是一个基于 Tauri + React 的本地技能管理工具，面向多工具技能目录（例如 Codex / OpenCode / OpenClaw / Claude）提供：

- 本地扫描与索引（`scan_roots` + `build_index`）
- 技能预览与日志审计
- 手动复制到目标工具目录（冲突策略：同名即拒绝，提示“已存在，不允许复制”）

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

1. 打开 GitHub Releases，选择最新 tag（例如 `v0.1.0`）。
2. 下载 `.app.zip` 或 `.dmg`。
3. 执行校验：

```bash
shasum -a 256 <downloaded-file>
```

4. 若为 `.app.zip`，解压后将 `SkillFlow Mac.app` 拖入 `/Applications`。

---

## English

### Table of Contents
- [Overview](#en-overview)
- [Install](#en-install)
- [Dev](#en-dev)
- [Build](#en-build)
- [Release](#en-release)

<a id="en-overview"></a>
### Overview

SkillFlow Mac is a local skill management app built with Tauri + React. It provides:

- Local scan and indexing (`scan_roots` + `build_index`)
- Skill preview and audit logs
- Manual copy to target tool directories (conflict policy: hard reject on duplicate name, message: `"已存在，不允许复制"`)

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

1. Open GitHub Releases and choose the latest tag (for example `v0.1.0`).
2. Download `.app.zip` or `.dmg`.
3. Verify checksum:

```bash
shasum -a 256 <downloaded-file>
```

4. If using `.app.zip`, unzip and move `SkillFlow Mac.app` into `/Applications`.
