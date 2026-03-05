const fs = require('fs');

const TERM_SCAN_DISCOVER = '扫描与发现技能';
const TERM_PREVIEW = '预览内容';
const TERM_SYNC_CROSS_TOOL = '跨工具同步配置';
const TERM_SECURITY = '加强安全控制';

const SMART_TRANSLATION_RULES = [
  { keywords: ['scan', 'discover'], text: TERM_SCAN_DISCOVER },
  { keywords: ['preview', 'review'], text: TERM_PREVIEW },
  { keywords: ['sync', 'synchronize', 'cross-tool', 'multi-tool'], text: TERM_SYNC_CROSS_TOOL },
  { keywords: ['import', 'ingest'], text: '导入技能到目标目录' },
  { keywords: ['export'], text: '导出技能到外部目录' },
  { keywords: ['security', 'secure', 'safe'], text: TERM_SECURITY },
  { keywords: ['audit', 'log', 'trace'], text: '记录审计日志' },
  { keywords: ['test', 'verify', 'validation'], text: '执行验证与测试流程' },
  { keywords: ['plan', 'planning', 'roadmap'], text: '规划阶段任务与里程碑' },
  { keywords: ['execute', 'delivery', 'ship'], text: '推进实现与交付流程' },
  { keywords: ['debug', 'troubleshoot', 'investigate'], text: '排查问题并定位根因' },
  { keywords: ['translate', 'translation', 'localization'], text: '优化中文说明质量' },
  { keywords: ['template', 'boilerplate'], text: '复用模板能力' },
  { keywords: ['automate', 'automation'], text: '提升自动化效率' },
];

const OFFLINE_FALLBACK_DICTIONARY = [
  {
    category: 'scan',
    patterns: [
      /\bscan(?:ning|ned|s)?\b/i,
      /\bcrawl(?:ing|ed|s)?\b/i,
      /\benumerat(?:e|ed|es|ing|ion)\b/i,
      /\bdiscover(?:y|ing|ed)?\b/i,
      /\bindex(?:ing|ed)?\b/i,
    ],
    text: TERM_SCAN_DISCOVER,
  },
  {
    category: 'preview',
    patterns: [
      /\bpreview(?:ing|ed|s)?\b/i,
      /\breview(?:ing|ed)?\b/i,
      /\binspect(?:ing|ion|ed)?\b/i,
      /\bview(?:ing|ed)?\b/i,
      /\bdry[- ]?run\b/i,
    ],
    text: TERM_PREVIEW,
  },
  {
    category: 'sync',
    patterns: [
      /\bsync(?:ed|s|ing)?\b/i,
      /\bsynchroni[sz](?:e|ed|es|ing|ation)\b/i,
      /\bmirror(?:ing|ed|s)?\b/i,
      /\bpropagat(?:e|ed|es|ing|ion)\b/i,
      /\balign(?:ment|ed|ing|s)?\b/i,
      /\bconverge(?:nce|d|s|ing)?\b/i,
    ],
    text: TERM_SYNC_CROSS_TOOL,
  },
  {
    category: 'security',
    patterns: [
      /\bsecurity\b/i,
      /\bsecure(?:ly|d)?\b/i,
      /\bsafe(?:ly)?\b/i,
      /\bguardrail(?:s)?\b/i,
      /\bsandbox(?:ed)?\b/i,
      /\bpermission(?:s)?\b/i,
      /\bprivacy\b/i,
      /\bcompliance\b/i,
      /\bpolicy\b/i,
      /\bsafeguard(?:s)?\b/i,
      /\bauthori[sz](?:e|ation|ed|ing)?\b/i,
      /\bauthentication\b/i,
      /\brisk(?:s)?\b/i,
    ],
    text: TERM_SECURITY,
  },
  { category: 'import', patterns: [/\bimport(?:ing)?\b/i, /\bingest(?:ion|ing)?\b/i], text: '导入技能' },
  { category: 'export', patterns: [/\bexport(?:ing)?\b/i], text: '导出技能' },
  { category: 'audit', patterns: [/\baudit\b/i, /\blog(?:ging)?\b/i, /\btrace(?:ability)?\b/i], text: '记录审计日志' },
  { category: 'manage', patterns: [/\bmanage(?:ment)?\b/i, /\badmin(?:istration)?\b/i], text: '管理技能' },
  { category: 'workflow', patterns: [/\btool(?:ing)?\b/i, /\bworkflow(?:s)?\b/i], text: '连接多工具协作流程' },
  { category: 'plan', patterns: [/\bplan(?:ning)?\b/i, /\broadmap\b/i], text: '规划阶段任务' },
  { category: 'execute', patterns: [/\bexecute\b/i, /\bdelivery\b/i, /\bship(?:ping)?\b/i], text: '推进实现交付' },
  { category: 'debug', patterns: [/\bdebug(?:ging)?\b/i, /\btroubleshoot(?:ing)?\b/i], text: '排查问题' },
  { category: 'translate', patterns: [/\btranslate(?:d|ion|ing)?\b/i, /\blocalization\b/i], text: '优化中文说明' },
];

const ZH_DESCRIPTION_TEXT_WHITELIST_REPLACEMENTS = [
  [/Openclaw/gi, 'OpenClaw'],
  [/Opencode/gi, 'OpenCode'],
  [/Claudcode/gi, 'Claude'],
  [/Codex\s*CLI/gi, 'Codex CLI'],
  [/跨工具同步技能配置/g, TERM_SYNC_CROSS_TOOL],
  [/同步技能配置|同步配置/g, TERM_SYNC_CROSS_TOOL],
  [/增强安全防护|强化安全控制/g, TERM_SECURITY],
  [/扫描并预览技能目录/g, `${TERM_SCAN_DISCOVER}、${TERM_PREVIEW}`],
  [/扫描技能目录|扫描技能/g, TERM_SCAN_DISCOVER],
  [/预览技能内容/g, TERM_PREVIEW],
  [/连接多工具流程/g, '连接多工具协作流程'],
  [/目录目录+/g, '目录'],
  [/技能技能+/g, '技能'],
  [/内容内容+/g, '内容'],
  [/用于用于/g, '用于'],
  [/，。/g, '。'],
];

function applyZhDescriptionWhitelistFixes(text) {
  let normalized = text.trim();
  for (const [pattern, replacement] of ZH_DESCRIPTION_TEXT_WHITELIST_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized.replace(/\s+/g, ' ').trim();
}

function normalizeDescriptionActions(actions) {
  const normalized = actions.map((action) => applyZhDescriptionWhitelistFixes(action));
  return Array.from(new Set(normalized));
}

function translateEnglishDescriptionFallback(description) {
  const text = description.toLowerCase();
  const actions = [];
  const categories = new Set();

  for (const dictionaryEntry of OFFLINE_FALLBACK_DICTIONARY) {
    if (!dictionaryEntry.patterns.some((pattern) => pattern.test(text))) {
      continue;
    }
    categories.add(dictionaryEntry.category);
    actions.push(dictionaryEntry.text);
  }

  const normalizedActions = normalizeDescriptionActions(actions);
  if (normalizedActions.length === 0) {
    return null;
  }

  if (categories.has('scan') && categories.has('preview') && categories.has('sync') && categories.has('security')) {
    return `用于${TERM_SCAN_DISCOVER}、${TERM_PREVIEW}、${TERM_SYNC_CROSS_TOOL}，并${TERM_SECURITY}。`;
  }

  if (categories.has('scan') && categories.has('sync') && categories.has('security')) {
    return `用于${TERM_SCAN_DISCOVER}、${TERM_SYNC_CROSS_TOOL}，并${TERM_SECURITY}。`;
  }

  if (categories.has('preview') && categories.has('sync') && categories.has('security')) {
    return `用于${TERM_PREVIEW}、${TERM_SYNC_CROSS_TOOL}，并${TERM_SECURITY}。`;
  }

  if (categories.has('sync') && categories.has('security')) {
    return `用于${TERM_SYNC_CROSS_TOOL}，并${TERM_SECURITY}。`;
  }

  if (categories.has('scan') && categories.has('preview') && categories.has('security')) {
    return `用于${TERM_SCAN_DISCOVER}、${TERM_PREVIEW}，并${TERM_SECURITY}。`;
  }

  if (categories.has('scan') && categories.has('sync')) {
    return `用于${TERM_SCAN_DISCOVER}、${TERM_SYNC_CROSS_TOOL}。`;
  }

  return `用于${normalizedActions.join('、')}。`;
}

function translateEnglishDescriptionSmart(description) {
  const normalized = description.toLowerCase();
  const actions = [];

  for (const rule of SMART_TRANSLATION_RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
      actions.push(rule.text);
    }
  }

  const normalizedActions = normalizeDescriptionActions(actions);
  if (normalizedActions.length === 0) {
    return null;
  }

  const suffix = normalized.includes('experiment') || normalized.includes('beta') ? '（实验性）' : '';
  return `用于${normalizedActions.join('、')}，提升技能协作效率${suffix}。`;
}

function hasRepeatedWordIssue(text) {
  return /(目录){3,}|(技能){3,}|(内容){3,}/.test(text);
}

const samples = [
  { id: 1, input: 'Scan and preview skills before sync to keep security guardrails.', required: [TERM_SCAN_DISCOVER, TERM_PREVIEW, TERM_SYNC_CROSS_TOOL, TERM_SECURITY], mode: 'offline' },
  { id: 2, input: 'Securely sync skills across tools with permission checks.', required: [TERM_SYNC_CROSS_TOOL, TERM_SECURITY], mode: 'offline' },
  { id: 3, input: 'Preview scanned skills and sync updates while reducing security risks.', required: [TERM_SCAN_DISCOVER, TERM_PREVIEW, TERM_SYNC_CROSS_TOOL, TERM_SECURITY], mode: 'offline' },
  { id: 4, input: 'Scan project skills and preview potential conflicts.', required: [TERM_SCAN_DISCOVER, TERM_PREVIEW], mode: 'offline' },
  { id: 5, input: 'Synchronize templates across toolchains with policy compliance.', required: [TERM_SYNC_CROSS_TOOL, TERM_SECURITY], mode: 'offline' },
  { id: 6, input: 'Discover and index skills quickly.', required: [TERM_SCAN_DISCOVER], mode: 'offline' },
  { id: 7, input: 'Review skill definitions in dry-run mode.', required: [TERM_PREVIEW], mode: 'offline' },
  { id: 8, input: 'Mirror skill configs between tools and enforce safeguard rules.', required: [TERM_SYNC_CROSS_TOOL, TERM_SECURITY], mode: 'offline' },
  { id: 9, input: 'Audit logs after sync and preview operations.', required: [TERM_PREVIEW, TERM_SYNC_CROSS_TOOL], mode: 'offline' },
  { id: 10, input: 'Scan then sync workspace skills with secure defaults.', required: [TERM_SCAN_DISCOVER, TERM_SYNC_CROSS_TOOL, TERM_SECURITY], mode: 'offline' },
  { id: 11, input: 'Scan and discover skills, then sync to multi-tool environments with safe guards.', required: [TERM_SCAN_DISCOVER, TERM_SYNC_CROSS_TOOL, TERM_SECURITY], mode: 'smart' },
  { id: 12, input: 'Preview and review generated skill docs before delivery.', required: [TERM_PREVIEW], mode: 'smart' },
  { id: 13, input: 'Cross-tool synchronization with policy-based security controls.', required: [TERM_SYNC_CROSS_TOOL, TERM_SECURITY], mode: 'smart' },
  { id: 14, input: 'Secure localization workflow to translate skill descriptions.', required: [TERM_SECURITY], mode: 'smart' },
  { id: 15, input: 'Scan preview and sync flows must keep strict security safeguards.', required: [TERM_SCAN_DISCOVER, TERM_PREVIEW, TERM_SYNC_CROSS_TOOL, TERM_SECURITY], mode: 'smart' },
  { id: 16, input: 'Synchronize and preview skill updates for multi-tool release.', required: [TERM_PREVIEW, TERM_SYNC_CROSS_TOOL], mode: 'smart' },
  { id: 17, input: 'Use secure sync automation to propagate skills safely.', required: [TERM_SYNC_CROSS_TOOL, TERM_SECURITY], mode: 'smart' },
  { id: 18, input: 'Discover, preview, and audit changes before importing skills.', required: [TERM_SCAN_DISCOVER, TERM_PREVIEW], mode: 'smart' },
  { id: 19, input: 'Plan and execute skill migration with synchronized tooling.', required: [TERM_SYNC_CROSS_TOOL], mode: 'smart' },
  { id: 20, input: 'Review scanned skills and secure cross-tool sync in one flow.', required: [TERM_SCAN_DISCOVER, TERM_PREVIEW, TERM_SYNC_CROSS_TOOL, TERM_SECURITY], mode: 'smart' },
];

const results = samples.map((sample) => {
  const offline = translateEnglishDescriptionFallback(sample.input) || '暂无中文说明';
  const smart = translateEnglishDescriptionSmart(sample.input) || '暂无中文说明';
  const targetText = sample.mode === 'offline' ? offline : smart;
  const missingTerms = sample.required.filter((term) => !targetText.includes(term));
  const hasRepeatIssue = hasRepeatedWordIssue(targetText);
  const passed = missingTerms.length === 0 && !hasRepeatIssue;

  return {
    ...sample,
    offline,
    smart,
    targetText,
    missingTerms,
    hasRepeatIssue,
    passed,
  };
});

const offlineCases = results.filter((item) => item.mode === 'offline');
const offlinePassed = offlineCases.filter((item) => item.passed).length;
const overallPassed = results.filter((item) => item.passed).length;

const summary = {
  total: results.length,
  overallPassed,
  overallAccuracy: Number(((overallPassed / results.length) * 100).toFixed(2)),
  offlineTotal: offlineCases.length,
  offlinePassed,
  offlineAccuracy: Number(((offlinePassed / offlineCases.length) * 100).toFixed(2)),
  threshold: { overall: 90, offline: 80 },
  passedGate: (overallPassed / results.length) * 100 >= 90 && (offlinePassed / offlineCases.length) * 100 >= 80,
  failedItems: results
    .filter((item) => !item.passed)
    .map((item) => ({
      id: item.id,
      mode: item.mode,
      input: item.input,
      missingTerms: item.missingTerms,
      hasRepeatIssue: item.hasRepeatIssue,
      output: item.targetText,
    })),
};

const outDir = 'release/verification';
fs.mkdirSync(outDir, { recursive: true });
const jsonPath = `${outDir}/r3-03c-local-20-summary.json`;
const mdPath = `${outDir}/r3-03c-local-20-summary.md`;
const detailPath = `${outDir}/r3-03c-local-20-details.json`;

fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2) + '\n');
fs.writeFileSync(detailPath, JSON.stringify(results, null, 2) + '\n');

const lines = [];
lines.push('# R3-03C 本地同口径 20 样本复测');
lines.push('');
lines.push(`- 总体准确率：${summary.overallAccuracy}% (${summary.overallPassed}/${summary.total})`);
lines.push(`- offline-fallback 准确率：${summary.offlineAccuracy}% (${summary.offlinePassed}/${summary.offlineTotal})`);
lines.push(`- 门禁阈值：总体 >= ${summary.threshold.overall}% 且 offline >= ${summary.threshold.offline}%`);
lines.push(`- 门禁结论：${summary.passedGate ? '通过' : '未通过'}`);
lines.push('');
if (summary.failedItems.length === 0) {
  lines.push('## 失败样本');
  lines.push('- 无');
} else {
  lines.push('## 失败样本');
  for (const item of summary.failedItems) {
    lines.push(`- #${item.id} [${item.mode}] missing=${item.missingTerms.join(',') || 'none'} repeat=${item.hasRepeatIssue}`);
  }
}

fs.writeFileSync(mdPath, lines.join('\n') + '\n');

console.log(`summary=${jsonPath}`);
console.log(`details=${detailPath}`);
console.log(`report=${mdPath}`);
console.log(`overall=${summary.overallAccuracy}% offline=${summary.offlineAccuracy}% gate=${summary.passedGate}`);
