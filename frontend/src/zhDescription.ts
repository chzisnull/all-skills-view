function normalizeSourceText(description: string): string {
  return description.replace(/^[>\s]+/gm, '').replace(/\s+/g, ' ').trim();
}

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

export function deriveZhDescriptionFromSource(description: string): string | null {
  const normalized = normalizeSourceText(description);
  if (!normalized) {
    return null;
  }

  const internetMatch = normalized.match(/^Use the internet:\s*(.+)$/i);
  if (internetMatch) {
    return cleanupZhText(`用于联网搜索、阅读并与多个平台交互，包括 ${translatePlatformList(internetMatch[1])}。`);
  }

  const commanderMatch = normalized.match(/^Use only when\s+(.+?);\s*(orchestrate with .+)$/i);
  if (commanderMatch) {
    return cleanupZhText(`仅在${translateCommanderCondition(commanderMatch[1])}时使用；${translateCommanderTail(commanderMatch[2])}。`);
  }

  const executorMatch = normalized.match(/^Use when\s+(.+)$/i);
  if (executorMatch) {
    const translated = translateExecutorStyle(executorMatch[1]);
    if (translated && /[\u4e00-\u9fff]/.test(translated)) {
      return cleanupZhText(`用于${translated.replace(/[.!?。！？]+$/g, '')}。`);
    }
  }

  return null;
}
