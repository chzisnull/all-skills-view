import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Clock3,
  Code2,
  Copy,
  Cpu,
  FileCode2,
  LayoutGrid,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { invoke } from '@tauri-apps/api/core';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type AppState = 'IDLE' | 'SCANNING' | 'LIST' | 'IMPORT_WIZARD' | 'SUCCESS' | 'ERROR';
type Tool = 'codex' | 'opencode' | 'openclaw' | 'claudcode' | 'All';

interface Skill {
  id: string;
  name: string;
  tool: string;
  path: string;
  transferSourcePath: string;
  contentHash: string;
  lastModified: string;
  description: string | null;
  offlineZhDescription: string;
  zhDescription: string;
  content: string;
}

interface CanonicalSkill {
  id: string;
  platform: string;
  name: string;
  description: string | null;
  scope: string;
  root_path: string;
  entry_path: string;
  content_hash: string;
  updated_at: number;
}

interface ScanResponse {
  skills: CanonicalSkill[];
  scanned_roots: string[];
}

interface PreviewSkillResponse {
  skill: CanonicalSkill;
  content: string;
  artifacts: unknown[];
}

interface CommandError {
  code?: string;
  message?: string;
  details?: string;
}

interface SkillCopyTarget {
  tool: string;
  scope: string;
  path: string;
  exists: boolean;
}

interface ListSkillTargetsResponse {
  targets: SkillCopyTarget[];
}

const TOOL_TABS: Tool[] = ['All', 'codex', 'opencode', 'openclaw', 'claudcode'];

const TOOL_LABELS: Record<Tool, string> = {
  All: '全部',
  codex: 'Codex',
  opencode: 'OpenCode',
  openclaw: 'OpenClaw',
  claudcode: 'Claude',
};

const NO_ZH_DESCRIPTION = '暂无中文说明';
const SMART_TRANSLATION_LANGUAGE = 'zh-CN';
const SMART_TRANSLATION_TIMEOUT_MS = 1200;
const TERM_SCAN_DISCOVER = '扫描与发现技能';
const TERM_PREVIEW = '预览内容';
const TERM_SYNC_CROSS_TOOL = '跨工具同步配置';
const TERM_SECURITY = '加强安全控制';

const HIGH_FREQUENCY_ZH_DESCRIPTION_WHITELIST: Array<{ keywords: string[]; text: string }> = [
  { keywords: ['brainstorming'], text: '用于在实现前澄清需求边界与方案方向，降低返工风险。' },
  { keywords: ['chat'], text: '用于会话消息发送、读取与协作沟通。' },
  { keywords: ['figma-implement-design'], text: '用于基于 Figma 节点进行高保真设计还原与代码实现。' },
  { keywords: ['figma'], text: '用于读取 Figma 设计上下文、截图与变量资产。' },
  { keywords: ['golutra-cli'], text: '用于调用 Golutra 本地 CLI 的命令协议能力。' },
  { keywords: ['gsd-progress'], text: '用于查看当前项目进度并路由下一步执行动作。' },
  { keywords: ['gsd-discuss-phase'], text: '用于阶段需求讨论与上下文确认。' },
  { keywords: ['gsd-plan-phase'], text: '用于生成阶段执行计划并补齐验证闭环。' },
  { keywords: ['gsd-execute-phase'], text: '用于按阶段计划执行实现任务。' },
  { keywords: ['gsd-verify-work'], text: '用于阶段成果验收与问题回归确认。' },
  { keywords: ['gsd-quick'], text: '用于快速完成小任务并保持最小验证闭环。' },
  { keywords: ['gsd-map-codebase'], text: '用于并行摸底代码库并生成结构化上下文。' },
  { keywords: ['gsd-debug'], text: '用于系统化排查问题并沉淀可复现修复路径。' },
  { keywords: ['gsd-resume-work'], text: '用于恢复历史会话上下文并续作当前任务。' },
  { keywords: ['linear'], text: '用于管理 Linear 工单、状态同步与协作流转。' },
  { keywords: ['playwright'], text: '用于浏览器自动化操作、截图采集与流程验证。' },
  { keywords: ['requesting-code-review'], text: '用于发起代码评审并确认实现质量。' },
  { keywords: ['receiving-code-review'], text: '用于处理评审意见并完成技术校准。' },
  { keywords: ['subagent-driven-development'], text: '用于多执行者并行推进实现任务。' },
  { keywords: ['dispatching-parallel-agents'], text: '用于拆分并调度可并行执行的子任务。' },
  { keywords: ['systematic-debugging'], text: '用于结构化定位故障根因并验证修复。' },
  { keywords: ['test-driven-development'], text: '用于先测后改，降低回归与实现偏差。' },
  { keywords: ['verification-before-completion'], text: '用于交付前执行最终验证并收敛风险。' },
  { keywords: ['writing-plans'], text: '用于编写实施计划与里程碑拆分。' },
  { keywords: ['skill-creator'], text: '用于创建或完善技能定义与使用说明。' },
];

const BUILTIN_ZH_DESCRIPTION_RULES: Array<{ keywords: string[]; text: string }> = [
  { keywords: ['project-development-quality-maintainability'], text: '用于提升项目开发质量与可维护性的实践规范。' },
  { keywords: ['roadmap'], text: '用于维护路线图阶段与任务编排信息。' },
  { keywords: ['scan'], text: `用于${TERM_SCAN_DISCOVER}并生成可用列表。` },
  { keywords: ['preview'], text: `用于${TERM_PREVIEW}并辅助变更确认。` },
  { keywords: ['sync'], text: `用于${TERM_SYNC_CROSS_TOOL}。` },
  { keywords: ['security', 'secure', 'guardrail'], text: `用于${TERM_SECURITY}。` },
  { keywords: ['import'], text: '用于将技能导入目标工具目录。' },
  { keywords: ['export'], text: '用于将技能导出到外部目录。' },
  { keywords: ['audit'], text: '用于记录与查询操作审计日志。' },
  { keywords: ['verify'], text: '用于执行结果验收并确认交付质量。' },
  { keywords: ['validation'], text: '用于验证功能行为与边界场景。' },
  { keywords: ['plan'], text: '用于拆解执行计划并明确阶段目标。' },
  { keywords: ['execute'], text: '用于推进实现任务并落地阶段成果。' },
  { keywords: ['debug'], text: '用于定位问题根因并修复异常行为。' },
  { keywords: ['resume'], text: '用于恢复上下文并继续当前任务。' },
  { keywords: ['translate'], text: '用于进行多语言说明转换与优化。' },
];

const SMART_TRANSLATION_RULES: Array<{ keywords: string[]; text: string }> = [
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

type OfflineFallbackCategory =
  | 'scan'
  | 'preview'
  | 'sync'
  | 'security'
  | 'import'
  | 'export'
  | 'audit'
  | 'manage'
  | 'workflow'
  | 'plan'
  | 'execute'
  | 'debug'
  | 'translate';

const OFFLINE_FALLBACK_DICTIONARY: Array<{ category: OfflineFallbackCategory; patterns: RegExp[]; text: string }> = [
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

const ZH_DESCRIPTION_TEXT_WHITELIST_REPLACEMENTS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /Openclaw/gi, replacement: 'OpenClaw' },
  { pattern: /Opencode/gi, replacement: 'OpenCode' },
  { pattern: /Claudcode/gi, replacement: 'Claude' },
  { pattern: /Codex\s*CLI/gi, replacement: 'Codex CLI' },
  { pattern: /跨工具同步技能配置/g, replacement: TERM_SYNC_CROSS_TOOL },
  { pattern: /同步技能配置|同步配置/g, replacement: TERM_SYNC_CROSS_TOOL },
  { pattern: /增强安全防护|强化安全控制/g, replacement: TERM_SECURITY },
  { pattern: /扫描并预览技能目录/g, replacement: `${TERM_SCAN_DISCOVER}、${TERM_PREVIEW}` },
  { pattern: /扫描技能目录|扫描技能/g, replacement: TERM_SCAN_DISCOVER },
  { pattern: /预览技能内容/g, replacement: TERM_PREVIEW },
  { pattern: /连接多工具流程/g, replacement: '连接多工具协作流程' },
  { pattern: /目录目录+/g, replacement: '目录' },
  { pattern: /技能技能+/g, replacement: '技能' },
  { pattern: /内容内容+/g, replacement: '内容' },
  { pattern: /用于用于/g, replacement: '用于' },
  { pattern: /，。/g, replacement: '。' },
];

interface TranslationMetrics {
  requestCount: number;
  cacheHits: number;
  failedRequests: number;
  totalLatencyMs: number;
}

function buildTranslationCacheKey(contentHash: string, language = SMART_TRANSLATION_LANGUAGE): string {
  return `${contentHash}:${language}`;
}

function formatToolLabel(tool: string): string {
  if (tool === 'codex') return TOOL_LABELS.codex;
  if (tool === 'opencode') return TOOL_LABELS.opencode;
  if (tool === 'openclaw') return TOOL_LABELS.openclaw;
  if (tool === 'claudcode') return TOOL_LABELS.claudcode;
  if (tool === 'All') return TOOL_LABELS.All;
  return tool;
}

function resolveTransferSourcePath(entryPath: string): string {
  const normalizedPath = entryPath.replace(/\\/g, '/');
  const fileName = normalizedPath.split('/').pop()?.toLowerCase();
  if (fileName !== 'skill.md') {
    return entryPath;
  }

  const lastSlash = Math.max(entryPath.lastIndexOf('/'), entryPath.lastIndexOf('\\'));
  if (lastSlash <= 0) {
    return entryPath;
  }

  return entryPath.slice(0, lastSlash);
}

function hasChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

function normalizeKeyword(text: string): string {
  return text.toLowerCase().replace(/[_\s]+/g, '-');
}

function normalizeSearchText(text: string): string {
  return text.trim().toLowerCase();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderHighlightedText(text: string, query: string): ReactNode {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return text;
  }

  const escapedQuery = escapeRegExp(trimmedQuery);
  if (!escapedQuery) {
    return text;
  }

  const matcher = new RegExp(`(${escapedQuery})`, 'gi');
  const normalizedQuery = trimmedQuery.toLowerCase();
  const chunks = text.split(matcher);

  return chunks.map((chunk, index) => {
    if (chunk.toLowerCase() === normalizedQuery) {
      return (
        <mark key={`${chunk}-${index}`} className="rounded bg-amber-200 px-0.5 text-slate-900">
          {chunk}
        </mark>
      );
    }
    return <span key={`${chunk}-${index}`}>{chunk}</span>;
  });
}

function resolveWhitelistedZhDescription(name: string, tool: string): string | null {
  const haystack = `${normalizeKeyword(name)} ${normalizeKeyword(tool)}`;
  for (const rule of HIGH_FREQUENCY_ZH_DESCRIPTION_WHITELIST) {
    if (rule.keywords.some((keyword) => haystack.includes(keyword))) {
      return rule.text;
    }
  }
  return null;
}

function applyZhDescriptionWhitelistFixes(text: string): string {
  let normalized = text.trim();
  for (const replacement of ZH_DESCRIPTION_TEXT_WHITELIST_REPLACEMENTS) {
    normalized = normalized.replace(replacement.pattern, replacement.replacement);
  }
  return normalized.replace(/\s+/g, ' ').trim();
}

function normalizeDescriptionActions(actions: string[]): string[] {
  const normalized = actions.map((action) => applyZhDescriptionWhitelistFixes(action));
  return Array.from(new Set(normalized));
}

function resolveBuiltinZhDescription(name: string, tool: string): string | null {
  const haystack = `${normalizeKeyword(name)} ${normalizeKeyword(tool)}`;
  for (const rule of BUILTIN_ZH_DESCRIPTION_RULES) {
    if (rule.keywords.some((keyword) => haystack.includes(keyword))) {
      return rule.text;
    }
  }
  return null;
}

function translateEnglishDescriptionFallback(description: string): string | null {
  const text = description.toLowerCase();
  const actions: string[] = [];
  const categories = new Set<OfflineFallbackCategory>();

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

function translateEnglishDescriptionSmart(description: string): string | null {
  const normalized = description.toLowerCase();
  const actions: string[] = [];

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

async function requestSmartTranslation(description: string): Promise<string> {
  const translatorTask = new Promise<string>((resolve, reject) => {
    globalThis.setTimeout(() => {
      const translated = translateEnglishDescriptionSmart(description);
      if (translated) {
        resolve(translated);
        return;
      }
      reject(new Error('SMART_TRANSLATION_NO_MATCH'));
    }, 120);
  });

  const timeoutTask = new Promise<string>((_, reject) => {
    globalThis.setTimeout(() => reject(new Error('SMART_TRANSLATION_TIMEOUT')), SMART_TRANSLATION_TIMEOUT_MS);
  });

  return Promise.race([translatorTask, timeoutTask]);
}

function resolveZhDescription(name: string, tool: string, rawDescription: string | null | undefined): string {
  const cleanedDescription = rawDescription?.trim() ?? '';

  let candidate: string | null = null;

  // A. 优先使用 SKILL.md/frontmatter 中已存在的中文描述
  if (cleanedDescription && hasChinese(cleanedDescription)) {
    candidate = cleanedDescription;
  } else {
    // A+. 高频技能白名单优先覆盖，确保关键技能描述一致性
    const whitelistedDescription = resolveWhitelistedZhDescription(name, tool);
    if (whitelistedDescription) {
      candidate = whitelistedDescription;
    } else {
      // B. 使用内置中文映射
      const builtinDescription = resolveBuiltinZhDescription(name, tool);
      if (builtinDescription) {
        candidate = builtinDescription;
      }
    }

    // C. 英文描述走本地规则翻译回退（离线，不阻塞 UI）
    if (!candidate && cleanedDescription) {
      const translated = translateEnglishDescriptionFallback(cleanedDescription);
      if (translated) {
        candidate = translated;
      }
    }
  }

  const normalized = candidate ? applyZhDescriptionWhitelistFixes(candidate) : '';
  if (normalized) {
    return normalized;
  }

  // 保底：无论是否存在英文 description，都保证返回一个非空中文占位
  return NO_ZH_DESCRIPTION;
}

function toUiSkill(skill: CanonicalSkill): Skill {
  const offlineZhDescription = resolveZhDescription(skill.name, skill.platform, skill.description);
  return {
    id: skill.id,
    name: skill.name,
    tool: skill.platform,
    path: skill.entry_path,
    transferSourcePath: resolveTransferSourcePath(skill.entry_path),
    contentHash: skill.content_hash,
    lastModified: formatDate(skill.updated_at),
    description: skill.description,
    offlineZhDescription,
    zhDescription: offlineZhDescription,
    content: '',
  };
}

function formatDate(unixTimestamp: number): string {
  return new Date(unixTimestamp * 1000).toLocaleString('zh-CN', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function parseCommandError(err: unknown): CommandError {
  if (typeof err === 'string') {
    return { message: err };
  }

  if (err && typeof err === 'object') {
    return err as CommandError;
  }

  return { message: '未知错误' };
}

function isTauriInvokeAvailable(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const tauriInternals = (window as typeof window & { __TAURI_INTERNALS__?: { invoke?: unknown } }).__TAURI_INTERNALS__;
  return typeof tauriInternals?.invoke === 'function';
}

export default function App() {
  const [state, setState] = useState<AppState>('IDLE');
  const [selectedTool, setSelectedTool] = useState<Tool>('All');
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showUninstallConfirm, setShowUninstallConfirm] = useState(false);
  const [isUninstalling, setIsUninstalling] = useState(false);
  const [smartTranslateEnabled, setSmartTranslateEnabled] = useState(false);
  const [translationMetrics, setTranslationMetrics] = useState<TranslationMetrics>({
    requestCount: 0,
    cacheHits: 0,
    failedRequests: 0,
    totalLatencyMs: 0,
  });

  const [syncTargets, setSyncTargets] = useState<SkillCopyTarget[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<SkillCopyTarget | null>(null);
  const [targetToolFilter, setTargetToolFilter] = useState<Tool>('All');
  const translationCacheRef = useRef<Map<string, string>>(new Map());
  const translationInFlightRef = useRef<Set<string>>(new Set());
  const smartTranslateEnabledRef = useRef(smartTranslateEnabled);

  const translationOverview = useMemo(() => {
    const totalQueries = translationMetrics.requestCount + translationMetrics.cacheHits;
    const cacheHitRate = totalQueries === 0 ? 0 : (translationMetrics.cacheHits / totalQueries) * 100;
    const failureRate =
      translationMetrics.requestCount === 0 ? 0 : (translationMetrics.failedRequests / translationMetrics.requestCount) * 100;
    const avgLatencyMs =
      translationMetrics.requestCount === 0 ? 0 : translationMetrics.totalLatencyMs / translationMetrics.requestCount;

    return {
      totalQueries,
      cacheHitRate,
      failureRate,
      avgLatencyMs,
    };
  }, [translationMetrics]);

  const normalizedSearchQuery = useMemo(() => normalizeSearchText(searchQuery), [searchQuery]);

  const filteredSkills = useMemo(
    () =>
      skills.filter(
        (skill) => {
          if (!(selectedTool === 'All' || skill.tool === selectedTool)) {
            return false;
          }

          if (!normalizedSearchQuery) {
            return true;
          }

          return [skill.name, skill.zhDescription]
            .map((field) => normalizeSearchText(field))
            .some((field) => field.includes(normalizedSearchQuery));
        },
      ),
    [skills, selectedTool, normalizedSearchQuery],
  );

  const filteredTargets = useMemo(
    () => syncTargets.filter((target) => targetToolFilter === 'All' || target.tool === targetToolFilter),
    [syncTargets, targetToolFilter],
  );

  const applyTranslatedDescription = useCallback((skillId: string, translatedDescription: string) => {
    setSkills((prev) =>
      prev.map((skill) => (skill.id === skillId ? { ...skill, zhDescription: translatedDescription } : skill)),
    );
    setSelectedSkill((prev) =>
      prev && prev.id === skillId ? { ...prev, zhDescription: translatedDescription } : prev,
    );
  }, []);

  const runSmartTranslation = useCallback(
    async (skill: Skill) => {
      if (!smartTranslateEnabledRef.current) {
        return;
      }

      if (resolveWhitelistedZhDescription(skill.name, skill.tool)) {
        return;
      }

      const sourceDescription = skill.description?.trim() ?? '';
      if (!sourceDescription || hasChinese(sourceDescription)) {
        return;
      }

      // 只对“离线描述”状态的技能发起智能翻译，避免重复覆盖。
      if (skill.zhDescription !== skill.offlineZhDescription) {
        return;
      }

      const cacheKey = buildTranslationCacheKey(skill.contentHash);
      const cached = translationCacheRef.current.get(cacheKey);
      if (cached) {
        setTranslationMetrics((prev) => ({ ...prev, cacheHits: prev.cacheHits + 1 }));
        applyTranslatedDescription(skill.id, cached);
        return;
      }

      if (translationInFlightRef.current.has(cacheKey)) {
        return;
      }
      translationInFlightRef.current.add(cacheKey);

      const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
      setTranslationMetrics((prev) => ({ ...prev, requestCount: prev.requestCount + 1 }));

      try {
        const translated = applyZhDescriptionWhitelistFixes(await requestSmartTranslation(sourceDescription));
        translationCacheRef.current.set(cacheKey, translated);
        if (smartTranslateEnabledRef.current) {
          applyTranslatedDescription(skill.id, translated);
        }
      } catch {
        setTranslationMetrics((prev) => ({ ...prev, failedRequests: prev.failedRequests + 1 }));
      } finally {
        const endedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
        setTranslationMetrics((prev) => ({
          ...prev,
          totalLatencyMs: prev.totalLatencyMs + Math.max(endedAt - startedAt, 0),
        }));
        translationInFlightRef.current.delete(cacheKey);
      }
    },
    [applyTranslatedDescription],
  );

  const handleScan = async (isAuto = false) => {
    if (!isTauriInvokeAvailable()) {
      setSkills([]);
      setState('LIST');
      return;
    }

    if (!isAuto) {
      setState('SCANNING');
    }

    try {
      const response = await invoke<ScanResponse>('scan_roots', { roots: null });
      await invoke('build_index', { roots: null });

      const mappedSkills: Skill[] = response.skills.map((skill) => toUiSkill(skill));

      setSkills(mappedSkills);
      setState('LIST');
    } catch (err) {
      const parsed = parseCommandError(err);
      setErrorMessage(parsed.message ?? '同步失败，请稍后重试');
      setState('ERROR');
    }
  };

  const handlePreview = async (skill: Skill) => {
    const fetchPreview = async () => invoke<PreviewSkillResponse>('preview_skill', { skillId: skill.id });

    try {
      let response: PreviewSkillResponse;
      try {
        response = await fetchPreview();
      } catch {
        await invoke('build_index', { roots: null });
        try {
          response = await fetchPreview();
        } catch {
          response = await invoke<PreviewSkillResponse>('preview_skill_by_path', {
            entryPath: skill.path,
            platform: skill.tool,
            name: skill.name,
            scope: null,
            rootPath: skill.transferSourcePath,
          });
        }
      }

      const resolvedName = response.skill.name ?? skill.name;
      const resolvedTool = response.skill.platform ?? skill.tool;
      const resolvedDescription = response.skill.description ?? skill.description;
      const offlineZhDescription = resolveZhDescription(resolvedName, resolvedTool, resolvedDescription);

      const updatedSkill = {
        ...skill,
        name: resolvedName,
        tool: resolvedTool,
        content: response.content,
        contentHash: response.skill.content_hash ?? skill.contentHash,
        description: resolvedDescription,
        offlineZhDescription,
        zhDescription: offlineZhDescription,
      };
      setSelectedSkill(updatedSkill);
      setSkills((prev) => prev.map((item) => (item.id === skill.id ? updatedSkill : item)));
      setState('LIST');
    } catch (err) {
      const parsed = parseCommandError(err);
      setErrorMessage(parsed.message ? `读取技能详情失败：${parsed.message}` : '读取技能详情失败');
      setState('ERROR');
    }
  };

  const handleStartImport = async () => {
    try {
      const response = await invoke<ListSkillTargetsResponse>('list_skill_targets');
      setSyncTargets(response.targets);
      setTargetToolFilter('All');

      const preferredTarget =
        response.targets.find((target) => target.tool !== selectedSkill?.tool) ?? response.targets[0] ?? null;
      setSelectedTarget(preferredTarget);
      setState('IMPORT_WIZARD');
    } catch {
      setErrorMessage('无法加载目标工具清单');
      setState('ERROR');
    }
  };

  const finalizeImport = async () => {
    if (!selectedSkill || !selectedTarget) {
      return;
    }

    try {
      await invoke('import_skill', {
        sourcePath: selectedSkill.transferSourcePath,
        targetPath: selectedTarget.path,
        conflictMode: null,
        renameTo: null,
      });

      setSuccessMessage('同步完成');
      setState('SUCCESS');
      window.setTimeout(() => {
        setState('LIST');
        setSuccessMessage(null);
      }, 1800);
    } catch (err) {
      const parsed = parseCommandError(err);
      if (parsed.code === 'ConflictDetected') {
        setErrorMessage('已存在，不允许复制');
      } else {
        setErrorMessage(parsed.message ?? '同步失败，请稍后重试');
      }

      setState('ERROR');
      window.setTimeout(() => {
        setState('LIST');
        setErrorMessage(null);
      }, 2600);
    }
  };

  const handleRequestUninstall = () => {
    if (!selectedSkill || !isTauriInvokeAvailable()) {
      return;
    }

    setShowUninstallConfirm(true);
  };

  const confirmUninstallSkill = async () => {
    if (!selectedSkill || !isTauriInvokeAvailable()) {
      return;
    }

    setIsUninstalling(true);

    try {
      try {
        await invoke('uninstall_skill', {
          targetPath: selectedSkill.transferSourcePath,
        });
      } catch (err) {
        const primaryError = parseCommandError(err);
        if (primaryError.code !== 'PermissionDenied' && primaryError.code !== 'PathNotFound') {
          throw err;
        }

        await invoke('uninstall_skill', {
          targetPath: selectedSkill.path,
        });
      }

      setShowUninstallConfirm(false);
      setSelectedSkill(null);
      await handleScan(true);

      setSuccessMessage('卸载完成');
      setState('SUCCESS');
      window.setTimeout(() => {
        setState('LIST');
        setSuccessMessage(null);
      }, 1800);
    } catch (err) {
      const parsed = parseCommandError(err);
      if (parsed.code === 'PathNotFound') {
        setErrorMessage('目标技能不存在或已被删除');
      } else {
        setErrorMessage(parsed.message ?? '卸载失败，请稍后重试');
      }

      setShowUninstallConfirm(false);
      setState('ERROR');
      window.setTimeout(() => {
        setState('LIST');
        setErrorMessage(null);
      }, 2600);
    } finally {
      setIsUninstalling(false);
    }
  };

  useEffect(() => {
    void handleScan(true);
  }, []);

  useEffect(() => {
    smartTranslateEnabledRef.current = smartTranslateEnabled;
  }, [smartTranslateEnabled]);

  useEffect(() => {
    if (smartTranslateEnabled) {
      return;
    }

    setSkills((prev) => {
      let changed = false;
      const reverted = prev.map((skill) => {
        if (skill.zhDescription === skill.offlineZhDescription) {
          return skill;
        }
        changed = true;
        return { ...skill, zhDescription: skill.offlineZhDescription };
      });
      return changed ? reverted : prev;
    });

    setSelectedSkill((prev) => {
      if (!prev || prev.zhDescription === prev.offlineZhDescription) {
        return prev;
      }
      return { ...prev, zhDescription: prev.offlineZhDescription };
    });
  }, [smartTranslateEnabled]);

  useEffect(() => {
    if (!smartTranslateEnabled || skills.length === 0) {
      return;
    }

    for (const skill of skills) {
      if (skill.zhDescription !== skill.offlineZhDescription) {
        continue;
      }
      void runSmartTranslation(skill);
    }
  }, [runSmartTranslation, skills, smartTranslateEnabled]);

  useEffect(() => {
    if (state !== 'IMPORT_WIZARD') {
      return;
    }

    if (filteredTargets.length === 0) {
      setSelectedTarget(null);
      return;
    }

    if (!selectedTarget || !filteredTargets.some((target) => target.path === selectedTarget.path)) {
      setSelectedTarget(filteredTargets[0]);
    }
  }, [filteredTargets, selectedTarget, state]);

  const renderMiddlePaneContent = () => {
    if (state === 'SCANNING') {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin text-[#137fec]" />
          <p className="text-sm font-medium">正在扫描本地技能目录...</p>
        </div>
      );
    }

    if (filteredSkills.length === 0) {
      return (
        <div className="flex h-full flex-col items-center justify-center p-8 text-center">
          <div className="mb-6 flex w-full max-w-[280px] aspect-video items-center justify-center rounded-xl border border-slate-200 bg-gradient-to-br from-slate-100 to-slate-200">
            <div className="flex flex-col items-center gap-2 opacity-40">
              <FileCode2 className="h-9 w-9 text-slate-500" />
              <span className="text-xs font-medium uppercase tracking-widest text-slate-600">暂无活跃技能</span>
            </div>
          </div>
          <h3 className="text-lg font-bold text-slate-800">0 个可用技能</h3>
          <p className="mt-3 max-w-[300px] text-sm leading-relaxed text-slate-500">
            当前项目尚未发现可用技能。请准备好本地目录后，点击下方按钮重新扫描。
          </p>
          <button
            type="button"
            onClick={() => void handleScan(false)}
            className="mt-6 inline-flex w-full max-w-[280px] items-center justify-center gap-2 rounded-lg bg-[#137fec] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#106fd0]"
          >
            <RefreshCw className="h-4 w-4" />
            刷新技能
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-2 p-3">
        {filteredSkills.map((skill) => (
          <button
            key={skill.id}
            type="button"
            onClick={() => void handlePreview(skill)}
            className={cn(
              'w-full rounded-lg border px-3 py-3 text-left transition',
              selectedSkill?.id === skill.id
                ? 'border-[#137fec] bg-[#eff6ff]'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
            )}
          >
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-slate-700">{renderHighlightedText(skill.name, searchQuery)}</p>
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                {formatToolLabel(skill.tool)}
              </span>
            </div>
            <p className="mt-1 truncate text-xs text-slate-600">{renderHighlightedText(skill.zhDescription, searchQuery)}</p>
            <p className="mt-1 truncate text-[11px] text-slate-400">{skill.path}</p>
          </button>
        ))}
      </div>
    );
  };

  const renderPreviewPane = () => {
    if (selectedSkill) {
      return (
        <div className="flex h-full flex-col bg-slate-50/30">
          <div className="border-b border-slate-200 bg-white px-6 py-5">
            <div className="inline-flex items-center gap-1 rounded-full bg-[#ebf4ff] px-2.5 py-1 text-[11px] font-semibold text-[#137fec]">
              <Code2 className="h-3.5 w-3.5" />
              技能详情
            </div>
            <h2 className="mt-3 text-2xl font-bold text-slate-800">{selectedSkill.name}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5" />
                {formatToolLabel(selectedSkill.tool)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5" />
                {selectedSkill.lastModified}
              </span>
            </div>
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="text-xs font-semibold tracking-wide text-slate-500">中文作用说明</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-700">{selectedSkill.zhDescription}</p>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-6">
            <pre className="min-h-full rounded-xl border border-slate-800 bg-slate-900 p-5 text-xs leading-6 text-slate-100">
              {selectedSkill.content || '加载中...'}
            </pre>
          </div>

          <div className="border-t border-slate-200 bg-white px-6 py-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void handleStartImport()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#137fec] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#106fd0]"
              >
                <Copy className="h-4 w-4" />
                同步到其他工具
              </button>
              <button
                type="button"
                onClick={() => void handleRequestUninstall()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#cf3643]/40 bg-[#fff5f5] px-4 py-3 text-sm font-bold text-[#cf3643] transition hover:bg-[#ffe9e9]"
              >
                <Trash2 className="h-4 w-4" />
                卸载
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex h-full flex-col items-center justify-center p-12 text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-200 text-slate-400">
          <LayoutGrid className="h-8 w-8" />
        </div>
        <h2 className="mb-3 text-2xl font-bold text-slate-800">技能预览</h2>
        <p className="mb-8 max-w-2xl text-sm leading-relaxed text-slate-500">
          当前未选择任何技能配置。请在左侧列表中选择条目，查看详细文档并执行同步。
        </p>

        <div className="grid w-full max-w-2xl grid-cols-1 gap-4 text-left sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <Sparkles className="mb-3 h-4 w-4 text-[#137fec]" />
            <h4 className="mb-1 text-sm font-bold text-slate-700">同步技能</h4>
            <p className="text-xs text-slate-500">将当前技能同步到目标工具，减少重复配置。</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <RefreshCw className="mb-3 h-4 w-4 text-[#137fec]" />
            <h4 className="mb-1 text-sm font-bold text-slate-700">刷新列表</h4>
            <p className="text-xs text-slate-500">点击左侧刷新按钮，重新扫描本机 skills 目录。</p>
          </div>
        </div>

        <div className="mt-10 w-full border-t border-slate-200 pt-8">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">支持集成</p>
          <div className="flex items-center justify-center gap-6 text-slate-300">
            <Cpu className="h-5 w-5" />
            <LayoutGrid className="h-5 w-5" />
            <RefreshCw className="h-5 w-5" />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f6f7f8] text-slate-900 antialiased">
      <aside className="flex w-full flex-col border-b border-slate-200 bg-white md:w-64 md:border-b-0 md:border-r">
        <div className="flex items-center gap-3 p-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#137fec] text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold leading-tight text-slate-900">SkillFlow</h1>
            <p className="text-xs font-medium text-slate-500">全局管理</p>
          </div>
        </div>

        <nav className="grid grid-cols-2 gap-2 px-3 pb-3 md:grid-cols-1">
          <button
            type="button"
            onClick={() => {
              setSelectedTool('All');
              setState('LIST');
            }}
            className={cn(
              'inline-flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-colors',
              selectedTool === 'All' ? 'bg-[#e8f2ff] text-[#137fec]' : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            <LayoutGrid className="h-4 w-4 shrink-0" />
            <span className="truncate">全部工具</span>
          </button>
          <button
            type="button"
            onClick={() => void handleScan(false)}
            className="inline-flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
          >
            <RefreshCw className="h-4 w-4 shrink-0" />
            <span className="truncate">刷新技能</span>
          </button>
        </nav>

        <div className="mt-auto border-t border-slate-200 p-4">
          <div className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-slate-100">
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-slate-600">
              <User className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-700">开发成员</p>
              <p className="truncate text-xs text-slate-500">设置</p>
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-700">启用智能翻译（实验性）</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  默认关闭。先显示离线中文说明，开启后异步优化翻译结果。
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={smartTranslateEnabled}
                onClick={() => setSmartTranslateEnabled((prev) => !prev)}
                className={cn(
                  'relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
                  smartTranslateEnabled ? 'bg-[#137fec]' : 'bg-slate-300',
                )}
              >
                <span
                  className={cn(
                    'inline-block h-5 w-5 rounded-full bg-white shadow transition-transform',
                    smartTranslateEnabled ? 'translate-x-5' : 'translate-x-0.5',
                  )}
                />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
              <div className="rounded border border-slate-200 bg-white px-2 py-1.5">请求数：{translationOverview.totalQueries}</div>
              <div className="rounded border border-slate-200 bg-white px-2 py-1.5">
                命中率：{translationOverview.cacheHitRate.toFixed(0)}%
              </div>
              <div className="rounded border border-slate-200 bg-white px-2 py-1.5">
                失败率：{translationOverview.failureRate.toFixed(0)}%
              </div>
              <div className="rounded border border-slate-200 bg-white px-2 py-1.5">
                平均耗时：{translationOverview.avgLatencyMs.toFixed(0)}ms
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col bg-white">
        <header className="border-b border-slate-200 px-8 pt-4">
          <div className="flex items-center gap-8">
            {TOOL_TABS.map((tool) => (
              <button
                key={tool}
                type="button"
                onClick={() => {
                  setSelectedTool(tool);
                  setState('LIST');
                }}
                className={cn(
                  'border-b-2 pb-3 text-sm font-semibold transition-colors',
                  selectedTool === tool ? 'border-[#137fec] text-[#137fec]' : 'border-transparent text-slate-500 hover:text-slate-700',
                )}
              >
                {TOOL_LABELS[tool]}
              </button>
            ))}
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
          <section className="flex w-full min-h-[260px] flex-col border-b border-slate-200 lg:w-[400px] lg:border-b-0 lg:border-r">
            <div className="p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="筛选技能配置（⌘F）"
                  className="h-10 w-full rounded-lg border-none bg-slate-100 pl-10 pr-4 text-sm text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:ring-2 focus:ring-[#137fec]/50"
                  type="text"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto bg-white">{renderMiddlePaneContent()}</div>
          </section>

          <section className="min-h-[280px] flex-1 overflow-y-auto bg-slate-50/50">{renderPreviewPane()}</section>
        </div>
      </main>

      {state === 'IMPORT_WIZARD' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-[0_20px_35px_rgba(0,0,0,0.2)]">
            <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">同步向导</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    源技能: <span className="font-semibold text-[#137fec]">{selectedSkill?.name ?? '-'}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setState('LIST')}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="px-5 py-4 sm:px-6 sm:py-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">选择目标位置</p>

              <div className="mb-3 flex flex-wrap gap-2">
                {TOOL_TABS.map((tool) => (
                  <button
                    key={`target-filter-${tool}`}
                    type="button"
                    onClick={() => setTargetToolFilter(tool)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-semibold transition',
                      targetToolFilter === tool
                        ? 'border-[#7eb6ff] bg-[#eff6ff] text-[#137fec]'
                        : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300',
                    )}
                  >
                    {TOOL_LABELS[tool]}
                  </button>
                ))}
              </div>

              {filteredTargets.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-500">
                  当前筛选条件下没有可选目标。
                </div>
              ) : (
                <div className="max-h-[280px] space-y-2 overflow-auto pr-1">
                  {filteredTargets.map((target) => (
                    <button
                      key={`${target.tool}-${target.scope}-${target.path}`}
                      type="button"
                      onClick={() => setSelectedTarget(target)}
                      className={cn(
                        'w-full rounded-lg border px-3 py-3 text-left transition',
                        selectedTarget?.path === target.path
                          ? 'border-[#7eb6ff] bg-[#f2f8ff]'
                          : 'border-slate-200 bg-white hover:border-slate-300',
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-700">{formatToolLabel(target.tool)}</span>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                            target.scope === 'global' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700',
                          )}
                        >
                          {target.scope === 'global' ? '全局' : '项目'}
                        </span>
                        {selectedTarget?.path === target.path && <Check className="h-4 w-4 text-[#137fec]" />}
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-500">{target.path}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 border-t border-slate-200 px-5 py-4 sm:px-6">
              <button
                type="button"
                onClick={() => setState('LIST')}
                className="inline-flex flex-1 items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void finalizeImport()}
                className="inline-flex flex-[1.4] items-center justify-center rounded-lg bg-[#137fec] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#106fd0]"
              >
                确认同步
              </button>
            </div>
          </div>
        </div>
      )}

      {showUninstallConfirm && selectedSkill && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_20px_35px_rgba(0,0,0,0.2)]">
            <h3 className="text-lg font-bold text-slate-800">确认卸载</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              确认删除技能 <span className="font-semibold text-slate-800">{selectedSkill.name}</span> 吗？该操作不可恢复。
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isUninstalling}
                onClick={() => setShowUninstallConfirm(false)}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                取消
              </button>
              <button
                type="button"
                disabled={isUninstalling}
                onClick={() => void confirmUninstallSkill()}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#cf3643] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#b92e3a] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isUninstalling ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isUninstalling ? '卸载中...' : '确认卸载'}
              </button>
            </div>
          </div>
        </div>
      )}

      {state === 'SUCCESS' && (
        <div className="fixed bottom-8 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#137fec] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(19,127,236,0.35)]">
          <Check className="h-4 w-4" />
          {successMessage ?? '操作完成'}
        </div>
      )}

      {state === 'ERROR' && errorMessage && (
        <div className="fixed bottom-8 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#cf3643] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(193,35,54,0.35)]">
          <AlertTriangle className="h-4 w-4" />
          {errorMessage}
        </div>
      )}
    </div>
  );
}
