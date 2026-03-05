import { useEffect, useMemo, useState } from 'react';
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
  lastModified: string;
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

  const [syncTargets, setSyncTargets] = useState<SkillCopyTarget[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<SkillCopyTarget | null>(null);
  const [targetToolFilter, setTargetToolFilter] = useState<Tool>('All');

  const filteredSkills = useMemo(
    () =>
      skills.filter(
        (skill) =>
          (selectedTool === 'All' || skill.tool === selectedTool) &&
          skill.name.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [skills, selectedTool, searchQuery],
  );

  const filteredTargets = useMemo(
    () => syncTargets.filter((target) => targetToolFilter === 'All' || target.tool === targetToolFilter),
    [syncTargets, targetToolFilter],
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

      const mappedSkills: Skill[] = response.skills.map((skill) => ({
        id: skill.id,
        name: skill.name,
        tool: skill.platform,
        path: skill.entry_path,
        transferSourcePath: resolveTransferSourcePath(skill.entry_path),
        lastModified: formatDate(skill.updated_at),
        content: '',
      }));

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

      const updatedSkill = { ...skill, content: response.content };
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

  const handleUninstallSkill = async () => {
    if (!selectedSkill || !isTauriInvokeAvailable()) {
      return;
    }

    const confirmed = window.confirm(`确定卸载技能“${selectedSkill.name}”吗？该操作不可恢复。`);
    if (!confirmed) {
      return;
    }

    try {
      await invoke('uninstall_skill', {
        targetPath: selectedSkill.transferSourcePath,
      });

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

      setState('ERROR');
      window.setTimeout(() => {
        setState('LIST');
        setErrorMessage(null);
      }, 2600);
    }
  };

  useEffect(() => {
    void handleScan(true);
  }, []);

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
              <p className="truncate text-sm font-semibold text-slate-700">{skill.name}</p>
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                {formatToolLabel(skill.tool)}
              </span>
            </div>
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
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-6">
            <pre className="min-h-full rounded-xl border border-slate-800 bg-slate-900 p-5 text-xs leading-6 text-slate-100">
              {selectedSkill.content || '加载中...'}
            </pre>
          </div>

          <div className="border-t border-slate-200 bg-white px-6 py-4">
            <div className="flex flex-col gap-2">
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
                onClick={() => void handleUninstallSkill()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#cf3643]/40 bg-[#fff5f5] px-4 py-3 text-sm font-bold text-[#cf3643] transition hover:bg-[#ffe9e9]"
              >
                <Trash2 className="h-4 w-4" />
                卸载技能
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
