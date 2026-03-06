# R6-03 Verification - 中文作用说明依据原始 description 派生

## 目标

修复 Skills 中文“作用说明”在存在原始 `description` 时仍回退为模板化文案的问题。

## 变更摘要

- 新增 `frontend/src/zhDescription.ts`
  - 提供 `deriveZhDescriptionFromSource()`
  - 对常见技能说明句式做离线中文派生：
    - `Use when ...`
    - `Use only when ...; ... by default.`
    - `Use the internet: ...`
- 调整 `frontend/src/App.tsx`
  - 在模板文案回退前，优先尝试基于原始 `description` 派生中文说明
  - 仅当派生失败时，才保留原模板回退
- 新增回归测试 `frontend/src/zhDescription.test.ts`
  - 覆盖 `executor-agent`
  - 覆盖 `commander-orchestrator`
  - 覆盖 `agent-reach`

## 复测命令

### 1. 最小回归测试

```bash
node --experimental-strip-types --test frontend/src/zhDescription.test.ts
```

预期：`3 passed / 0 failed`

### 2. 前端构建

```bash
npm --prefix frontend run build
```

预期：构建成功，生成新的 `dist/assets/index-*.js`

### 3. Rust 侧回归

```bash
cargo test -q --manifest-path src-tauri/Cargo.toml
```

预期：`26 passed / 0 failed`

## 本次实测结果

### 回归测试

- 命令：`node --experimental-strip-types --test frontend/src/zhDescription.test.ts`
- 结果：通过
- 明细：`3 passed / 0 failed`

### 前端构建

- 命令：`npm --prefix frontend run build`
- 结果：通过
- 产物：`dist/assets/index-Db4o3IeP.js`

## 样本期望

### executor-agent

原始描述：

> Use when carrying out concrete implementation or verification tasks delegated by a coordinator agent in Codex.

期望中文：

> 用于在 Codex 中执行由协调者代理委派的具体实现或验证任务。

### commander-orchestrator

原始描述：

> Use only when the user explicitly asks to enable commander-orchestrator, collaborative mode, or commander/executor multi-agent orchestration in Codex; orchestrate with gsd-* skills by default.

期望中文：

> 仅在用户明确要求启用 commander-orchestrator、协作模式或在 Codex 中使用 commander/executor 多代理编排时使用；默认使用 gsd-* skills 进行编排。

### agent-reach

原始描述：

> Use the internet: search, read, and interact with 13+ platforms including Twitter/X, Reddit, YouTube, GitHub, Bilibili, XiaoHongShu (小红书), Douyin (抖音), WeChat Articles (微信公众号), LinkedIn, Boss直聘, RSS, Exa web search, and any web page.

期望中文：

> 用于联网搜索、阅读并与多个平台交互，包括 Twitter/X、Reddit、YouTube、GitHub、Bilibili、小红书、抖音、微信公众号、LinkedIn、Boss直聘、RSS、Exa 和任意网页。
