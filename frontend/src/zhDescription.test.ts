import test from 'node:test';
import assert from 'node:assert/strict';

import { deriveZhDescriptionFromSource } from './zhDescription.ts';

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
