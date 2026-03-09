function normalizeSourceText(description: string): string {
  return description.replace(/^[>\s]+/gm, '').replace(/\s+/g, ' ').trim();
}

function stripSupplementarySections(description: string): string {
  return description
    .replace(/\bTriggers:\s*[\s\S]*$/i, '')
    .replace(/\bUse when:\s*[\s\S]*$/i, '')
    .trim();
}

function firstSentence(description: string): string {
  const stripped = stripSupplementarySections(description);
  const match = stripped.match(/^(.+?[.!?。！？])(\s|$)/);
  return (match ? match[1] : stripped).trim();
}

function hasChinese(text: string): boolean {
  return /[\u3400-\u9fff]/.test(text);
}

const DIRECT_DESCRIPTION_RULES: Array<{ pattern: RegExp; text: string }> = [
  {
    pattern: /^Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes$/i,
    text: '用于在遇到 bug、测试失败或异常行为时，先做系统化排查，再提出修复。',
  },
  {
    pattern: /^Use when implementing any feature or bugfix, before writing implementation code$/i,
    text: '用于在编写实现代码前，先通过测试驱动方式落实功能或修复缺陷。',
  },
  {
    pattern: /^Use when you have a spec or requirements for a multi-step task, before touching code$/i,
    text: '用于在开始改代码前，依据规格或需求先编写多步骤任务计划。',
  },
  {
    pattern: /^Use when completing tasks, implementing major features, or before merging to verify work meets requirements$/i,
    text: '用于在完成任务、实现主要功能或合并前发起检查，确认工作符合要求。',
  },
  {
    pattern: /^Use when facing 2\+ independent tasks that can be worked on without shared state or sequential dependencies$/i,
    text: '用于处理 2 个及以上彼此独立、无需共享状态或顺序依赖的任务。',
  },
  {
    pattern: /^Use when you have a written implementation plan to execute in a separate session with review checkpoints$/i,
    text: '用于在已有书面实施计划时，于独立会话中按评审检查点推进执行。',
  },
  {
    pattern: /^Use when executing implementation plans with independent tasks in the current session$/i,
    text: '用于在当前会话中按实施计划推进彼此独立的任务。',
  },
  {
    pattern: /^Use when starting feature work that needs isolation from current workspace or before executing implementation plans - creates isolated git worktrees with smart directory selection and safety verification$/i,
    text: '用于在新功能开发需要与当前工作区隔离，或执行实施计划前，创建带安全校验的独立 git worktree。',
  },
  {
    pattern: /^Use when starting any conversation - establishes how to find and use skills, requiring Skill tool invocation before ANY response including clarifying questions$/i,
    text: '用于在任何对话开始前明确技能查找与使用方式，并要求在任何回复（含澄清问题）前先调用 Skill 工具。',
  },
  {
    pattern: /^Use when about to claim work is complete, fixed, or passing, before committing or creating PRs - requires running verification commands and confirming output before making any success claims$/i,
    text: '用于在宣称工作完成、修复或通过前，以及提交或创建 PR 前，先运行验证命令并确认输出。',
  },
  {
    pattern:
      /^Use when the user asks to operate any on-screen UI \(websites, desktop apps, system dialogs, settings pages, file pickers\)\. Always execute via UI-TARS\. Do not route to browser DOM automation\. Do not route to TuriX unless the user explicitly overrides this policy\.$/i,
    text: '用于在用户要求操作屏幕界面时，通过 UI-TARS 执行网站、桌面应用、系统弹窗、设置页和文件选择器等交互；默认不要切到浏览器 DOM 自动化或 TuriX。',
  },
  {
    pattern:
      /^Use when the task requires automating a real browser from the terminal \(navigation, form filling, snapshots, screenshots, data extraction, UI-flow debugging\) via `playwright-cli` or the bundled wrapper script\.?$/i,
    text: '用于在任务需要通过 `playwright-cli` 或内置包装脚本从终端自动化真实浏览器时，完成导航、表单填写、快照、截图、数据提取和 UI 流程调试。',
  },
  {
    pattern:
      /^Use when the task involves reading, creating, or editing `\.docx` documents, especially when formatting or layout fidelity matters; prefer `python-docx` plus the bundled `scripts\/render_docx\.py` for visual checks\.?$/i,
    text: '用于在任务涉及读取、创建或编辑 `.docx` 文档，且格式或版式还原很重要时优先使用。',
  },
  {
    pattern: /^Guide for creating effective skills(?:\. .+)?$/i,
    text: '用于为创建高质量技能提供方法与指导。',
  },
  {
    pattern: /^Lightweight autonomous engineering quality and maintainability workflow\.?$/i,
    text: '用于提供轻量级的自主工程质量与可维护性工作流。',
  },
  {
    pattern:
      /^Use when the user asks to generate or edit images via the OpenAI Image API \(for example: generate image, edit\/inpaint\/mask, background removal or replacement, transparent background, product shots, concept art, covers, or batch variants\); run the bundled CLI \(`scripts\/image_gen\.py`\) and require `OPENAI_API_KEY` for live calls\.?$/i,
    text: '用于在用户要求通过 OpenAI Image API 生成或编辑图像时处理生成图片、局部编辑、换背景、透明背景和批量变体等需求。',
  },
  {
    pattern:
      /^Use the Figma MCP server to fetch design context, screenshots, variables, and assets from Figma, and to translate Figma nodes into production code\. Trigger when a task involves Figma URLs, node IDs, design-to-code implementation, or Figma MCP setup and troubleshooting\.?$/i,
    text: '用于通过 Figma MCP 获取设计上下文、截图、变量和素材，并将 Figma 节点转换为生产代码。',
  },
  {
    pattern: /^Manage issues, projects & team workflows in Linear\. Use when the user wants to read, create or updates tickets in Linear\.?$/i,
    text: '用于在 Linear 中管理问题、项目和团队流程，并在用户要求读取、创建或更新工单时使用。',
  },
  {
    pattern:
      /^Translate Figma nodes into production-ready code with 1:1 visual fidelity using the Figma MCP workflow \(design context, screenshots, assets, and project-convention translation\)\.?$/i,
    text: '用于通过 Figma MCP 将 Figma 节点按 1:1 视觉还原要求转换为生产代码。',
  },
  {
    pattern:
      /^Connect to .+ over SSH using the fixed host `[^`]+`, username `[^`]+`, and hostname `[^`]+`\. Use when the user asks to connect\.?$/i,
    text: '用于通过 SSH 连接指定机器，并在用户要求远程接入该设备时使用。',
  },
  {
    pattern:
      /^Install Codex skills into \$CODEX_HOME\/skills from a curated list or a GitHub repo path\. Use when a user asks to list installable skills, install a curated skill, or install a.+$/i,
    text: '用于从精选列表或 GitHub 仓库路径安装 Codex skills，并在用户要求列出或安装技能时使用。',
  },
  {
    pattern:
      /^Build, edit, render, import, and export presentation decks with the preloaded @oai\/artifact-tool JavaScript surface through the artifacts tool\.?$/i,
    text: '用于通过 artifacts 工具构建、编辑、渲染、导入和导出演示文稿。',
  },
  {
    pattern:
      /^Build, edit, recalculate, import, and export spreadsheet workbooks with the preloaded @oai\/artifact-tool JavaScript surface through the artifacts tool\.?$/i,
    text: '用于通过 artifacts 工具构建、编辑、重算、导入和导出电子表格工作簿。',
  },
];

const TERM_SCAN_DISCOVER = '扫描与发现技能';
const TERM_PREVIEW = '预览内容';
const TERM_SYNC_CROSS_TOOL = '跨工具同步配置';
const TERM_SECURITY = '加强安全控制';

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
      /\bcross[- ]tool\b/i,
      /\bacross tools\b/i,
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

function translatePlatformList(text: string): string {
  return text
    .replace(/^search, read, and interact with /i, '')
    .replace(/13\+ platforms including /gi, '')
    .replace(/XiaoHongShu \(小红书\)/g, '小红书')
    .replace(/Douyin \(抖音\)/g, '抖音')
    .replace(/WeChat Articles \(微信公众号\)/g, '微信公众号')
    .replace(/Exa web search/g, 'Exa')
    .replace(/, and any web page/gi, ' 和任意网页')
    .replace(/any web page/g, '任意网页')
    .replace(/, and /g, '、')
    .replace(/ and /g, '、')
    .replace(/, /g, '、')
    .replace(/、+/g, '、')
    .replace(/[.!?。！？]+$/g, '')
    .trim();
}

function translateExecutorStyle(text: string): string {
  return text
    .replace(
      /carrying out concrete implementation or verification tasks delegated by a coordinator agent in Codex/gi,
      '在 Codex 中执行由协调者代理委派的具体实现或验证任务',
    )
    .replace(/carrying out/gi, '执行')
    .replace(/implementation or verification tasks/gi, '实现或验证任务')
    .replace(/implementation tasks/gi, '实现任务')
    .replace(/verification tasks/gi, '验证任务')
    .replace(/delegated by a coordinator agent/gi, '由协调者代理委派')
    .replace(/in Codex/gi, '在 Codex 中')
    .replace(/concrete/gi, '具体')
    .trim();
}

function translateCommanderCondition(text: string): string {
  return text
    .replace(/the user explicitly asks to enable /gi, '用户明确要求启用 ')
    .replace(/collaborative mode/gi, '协作模式')
    .replace(/commander\/executor multi-agent orchestration in Codex/gi, '在 Codex 中使用 commander/executor 多代理编排')
    .replace(/, or /g, '或')
    .replace(/, /g, '、')
    .replace(/\s+或\s+/g, '或')
    .trim();
}

function translateCommanderTail(text: string): string {
  return text
    .replace(/gsd-\* skills/gi, 'gsd-* skills')
    .replace(/orchestrate with (.+?) by default\.?/gi, '默认使用 $1 进行编排')
    .replace(/[.!?。！？]+$/g, '')
    .trim();
}

function cleanupZhText(text: string): string {
  return text
    .replace(/\s+([，。；])/g, '$1')
    .replace(/ +/g, ' ')
    .replace(/\s*；\s*/g, '；')
    .replace(/\s*，\s*/g, '，')
    .replace(/\s*。\s*/g, '。')
    .replace(/，或/g, '或')
    .replace(/。+$/g, '。')
    .trim();
}

function deriveZhDescriptionFromSignals(description: string): string | null {
  const actions: string[] = [];

  for (const entry of OFFLINE_FALLBACK_DICTIONARY) {
    if (!entry.patterns.some((pattern) => pattern.test(description))) {
      continue;
    }
    actions.push(entry.text);
  }

  const normalizedActions = Array.from(new Set(actions));
  if (normalizedActions.length === 0) {
    return null;
  }

  return cleanupZhText(`用于${normalizedActions.join('、')}。`);
}

function extractSmartTranslationText(result: unknown): string | null {
  if (typeof result === 'string') {
    return result.trim() || null;
  }

  if (!result || typeof result !== 'object') {
    return null;
  }

  const record = result as Record<string, unknown>;
  for (const key of ['translation', 'translatedText', 'translated', 'text', 'zhDescription', 'result']) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

export async function translateZhDescriptionWithFallback(
  description: string,
  remoteTranslator?: (description: string) => Promise<unknown> | unknown,
): Promise<string | null> {
  const offlineTranslation = deriveZhDescriptionFromSource(description);

  if (!remoteTranslator) {
    return offlineTranslation;
  }

  try {
    const remoteResult = extractSmartTranslationText(await remoteTranslator(description));
    if (remoteResult && hasChinese(remoteResult)) {
      return cleanupZhText(remoteResult);
    }
  } catch {
    return offlineTranslation;
  }

  return offlineTranslation;
}

export function deriveZhDescriptionFromSource(description: string): string | null {
  const normalized = normalizeSourceText(description);
  if (!normalized) {
    return null;
  }

  const primaryText = stripSupplementarySections(normalized);

  for (const rule of DIRECT_DESCRIPTION_RULES) {
    if (rule.pattern.test(normalized)) {
      return rule.text;
    }
  }

  const internetMatch = primaryText.match(/^Use the internet:\s*(.+)$/i);
  if (internetMatch) {
    return cleanupZhText(`用于联网搜索、阅读并与多个平台交互，包括 ${translatePlatformList(internetMatch[1])}。`);
  }

  const commanderMatch = primaryText.match(/^Use only when\s+(.+?);\s*(orchestrate with .+)$/i);
  if (commanderMatch) {
    return cleanupZhText(`仅在${translateCommanderCondition(commanderMatch[1])}时使用；${translateCommanderTail(commanderMatch[2])}。`);
  }

  const executorMatch = firstSentence(primaryText).match(/^Use when\s+(.+)$/i);
  if (executorMatch) {
    const translated = translateExecutorStyle(executorMatch[1]);
    if (translated && /[\u4e00-\u9fff]/.test(translated)) {
      return cleanupZhText(`用于${translated.replace(/[.!?。！？]+$/g, '')}。`);
    }
  }

  const derivedFromSignals = deriveZhDescriptionFromSignals(primaryText);
  if (derivedFromSignals) {
    return derivedFromSignals;
  }

  return null;
}
