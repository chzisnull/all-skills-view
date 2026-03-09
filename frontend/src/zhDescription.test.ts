import test from 'node:test';
import assert from 'node:assert/strict';

import { deriveZhDescriptionFromSource, translateZhDescriptionWithFallback } from './zhDescription.ts';

test('derives zh description for executor-agent style source text', () => {
  const source = 'Use when carrying out concrete implementation or verification tasks delegated by a coordinator agent in Codex.';

  assert.equal(deriveZhDescriptionFromSource(source), '用于在 Codex 中执行由协调者代理委派的具体实现或验证任务。');
});

test('derives zh description for commander-orchestrator style source text', () => {
  const source = 'Use only when the user explicitly asks to enable commander-orchestrator, collaborative mode, or commander/executor multi-agent orchestration in Codex; orchestrate with gsd-* skills by default.';

  assert.equal(
    deriveZhDescriptionFromSource(source),
    '仅在用户明确要求启用 commander-orchestrator、协作模式或在 Codex 中使用 commander/executor 多代理编排时使用；默认使用 gsd-* skills 进行编排。',
  );
});

test('derives zh description for agent-reach style source text', () => {
  const source =
    'Use the internet: search, read, and interact with 13+ platforms including Twitter/X, Reddit, YouTube, GitHub, Bilibili, XiaoHongShu (小红书), Douyin (抖音), WeChat Articles (微信公众号), LinkedIn, Boss直聘, RSS, Exa web search, and any web page.';

  assert.equal(
    deriveZhDescriptionFromSource(source),
    '用于联网搜索、阅读并与多个平台交互，包括 Twitter/X、Reddit、YouTube、GitHub、Bilibili、小红书、抖音、微信公众号、LinkedIn、Boss直聘、RSS、Exa 和任意网页。',
  );
});

test('derives zh description for systematic-debugging style source text', () => {
  const source = 'Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes';

  assert.equal(deriveZhDescriptionFromSource(source), '用于在遇到 bug、测试失败或异常行为时，先做系统化排查，再提出修复。');
});

test('derives zh description for test-driven-development style source text', () => {
  const source = 'Use when implementing any feature or bugfix, before writing implementation code';

  assert.equal(deriveZhDescriptionFromSource(source), '用于在编写实现代码前，先通过测试驱动方式落实功能或修复缺陷。');
});

test('derives zh description for writing-plans style source text', () => {
  const source = 'Use when you have a spec or requirements for a multi-step task, before touching code';

  assert.equal(deriveZhDescriptionFromSource(source), '用于在开始改代码前，依据规格或需求先编写多步骤任务计划。');
});

test('derives zh description for ui-tars-routing style source text', () => {
  const source =
    'Use when the user asks to operate any on-screen UI (websites, desktop apps, system dialogs, settings pages, file pickers). Always execute via UI-TARS. Do not route to browser DOM automation. Do not route to TuriX unless the user explicitly overrides this policy.';

  assert.equal(
    deriveZhDescriptionFromSource(source),
    '用于在用户要求操作屏幕界面时，通过 UI-TARS 执行网站、桌面应用、系统弹窗、设置页和文件选择器等交互；默认不要切到浏览器 DOM 自动化或 TuriX。',
  );
});

test('derives zh description for requesting-code-review style source text', () => {
  const source = 'Use when completing tasks, implementing major features, or before merging to verify work meets requirements';

  assert.equal(deriveZhDescriptionFromSource(source), '用于在完成任务、实现主要功能或合并前发起检查，确认工作符合要求。');
});

test('derives zh description for dispatching-parallel-agents style source text', () => {
  const source = 'Use when facing 2+ independent tasks that can be worked on without shared state or sequential dependencies';

  assert.equal(deriveZhDescriptionFromSource(source), '用于处理 2 个及以上彼此独立、无需共享状态或顺序依赖的任务。');
});

test('derives zh description for playwright requires style source text', () => {
  const source =
    'Use when the task requires automating a real browser from the terminal (navigation, form filling, snapshots, screenshots, data extraction, UI-flow debugging) via `playwright-cli` or the bundled wrapper script.';

  assert.equal(
    deriveZhDescriptionFromSource(source),
    '用于在任务需要通过 `playwright-cli` 或内置包装脚本从终端自动化真实浏览器时，完成导航、表单填写、快照、截图、数据提取和 UI 流程调试。',
  );
});

test('derives zh description for skill-creator source text', () => {
  const source = 'Guide for creating effective skills. This skill should be used when users want to create a new skill.';

  assert.equal(deriveZhDescriptionFromSource(source), '用于为创建高质量技能提供方法与指导。');
});

test('derives zh description for project development quality source text', () => {
  const source = 'Lightweight autonomous engineering quality and maintainability workflow.';

  assert.equal(deriveZhDescriptionFromSource(source), '用于提供轻量级的自主工程质量与可维护性工作流。');
});

test('derives zh description for doc involves style source text', () => {
  const source =
    'Use when the task involves reading, creating, or editing `.docx` documents, especially when formatting or layout fidelity matters; prefer `python-docx` plus the bundled `scripts/render_docx.py` for visual checks.';

  assert.equal(
    deriveZhDescriptionFromSource(source),
    '用于在任务涉及读取、创建或编辑 `.docx` 文档，且格式或版式还原很重要时优先使用。',
  );
});

test('derives zh description for imagegen user asks style source text', () => {
  const source =
    'Use when the user asks to generate or edit images via the OpenAI Image API (for example: generate image, edit/inpaint/mask, background removal or replacement, transparent background, product shots, concept art, covers, or batch variants); run the bundled CLI (`scripts/image_gen.py`) and require `OPENAI_API_KEY` for live calls.';

  assert.equal(
    deriveZhDescriptionFromSource(source),
    '用于在用户要求通过 OpenAI Image API 生成或编辑图像时处理生成图片、局部编辑、换背景、透明背景和批量变体等需求。',
  );
});

test('derives zh description for figma imperative source text', () => {
  const source =
    'Use the Figma MCP server to fetch design context, screenshots, variables, and assets from Figma, and to translate Figma nodes into production code. Trigger when a task involves Figma URLs, node IDs, design-to-code implementation, or Figma MCP setup and troubleshooting.';

  assert.equal(
    deriveZhDescriptionFromSource(source),
    '用于通过 Figma MCP 获取设计上下文、截图、变量和素材，并将 Figma 节点转换为生产代码。',
  );
});

test('derives zh description for linear manage style source text', () => {
  const source = 'Manage issues, projects & team workflows in Linear. Use when the user wants to read, create or updates tickets in Linear.';

  assert.equal(
    deriveZhDescriptionFromSource(source),
    '用于在 Linear 中管理问题、项目和团队流程，并在用户要求读取、创建或更新工单时使用。',
  );
});

test('keeps long description semantics instead of truncating to first sentence', () => {
  const source =
    'Use when scanning skill directories, previewing definitions, syncing configurations across tools, and enforcing security policies. Also supports audit logging for sensitive changes.';

  assert.equal(
    deriveZhDescriptionFromSource(source),
    '用于扫描与发现技能、预览内容、跨工具同步配置、加强安全控制、记录审计日志。',
  );
});

test('falls back to offline translation when smart translation request fails', async () => {
  const source =
    'Use when scanning skill directories, previewing definitions, syncing configurations across tools, and enforcing security policies. Also supports audit logging for sensitive changes.';

  const translated = await translateZhDescriptionWithFallback(source, async () => {
    throw new Error('COMMAND_NOT_FOUND');
  });

  assert.equal(translated, '用于扫描与发现技能、预览内容、跨工具同步配置、加强安全控制、记录审计日志。');
});

test('prefers smart translation result when backend translation succeeds', async () => {
  const translated = await translateZhDescriptionWithFallback('Use when reading skill descriptions.', async () => '用于后端智能翻译结果。');

  assert.equal(translated, '用于后端智能翻译结果。');
});
