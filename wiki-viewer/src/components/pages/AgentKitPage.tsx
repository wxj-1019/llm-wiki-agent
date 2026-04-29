import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bot, RefreshCw, Loader2, AlertCircle, Trash2,
  FileCode, FileText, FolderOpen, Download, Package,
  Layers, Terminal, ChevronRight, ChevronDown,
  Zap, Settings2, Image as ImageIcon, Table, CheckCircle,
  Copy, Check, Search, X, Play, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  fetchAgentKitStatus,
  generateAgentKit,
  fetchAgentKitFiles,
  downloadAgentKitFile,
  downloadAgentKitZip,
} from '@/services/agentKitService';
import type { AgentKitStatus, AgentKitFile } from '@/services/agentKitService';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useWikiStore } from '@/stores/wikiStore';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\u001b\[[0-9;]*m/g, '');
}

function inferGenerationStep(stdout: string, generating: boolean): { step: string; percent: number } | null {
  if (!generating && !stdout) return null;
  const text = stdout.toLowerCase();
  if (text.includes('done') || text.includes('complete') || text.includes('success')) {
    return { step: 'Finalizing...', percent: 95 };
  }
  if (text.includes('package') || text.includes('packaging') || text.includes('zip')) {
    return { step: 'Packaging artifacts...', percent: 80 };
  }
  if (text.includes('skill')) {
    return { step: 'Generating Skill...', percent: 55 };
  }
  if (text.includes('mcp') || text.includes('server')) {
    return { step: 'Generating MCP Server...', percent: 30 };
  }
  if (generating) {
    return { step: 'Initializing...', percent: 10 };
  }
  return null;
}

type GenerateTarget = 'all' | 'mcp' | 'skill';
type AssetTab = 'mcp-server' | 'skill' | 'schema' | 'diagrams';

const TAB_CONFIG: { key: AssetTab; label: string; icon: React.ElementType }[] = [
  { key: 'mcp-server', label: 'MCP Server', icon: Terminal },
  { key: 'skill', label: 'Skill', icon: Package },
  { key: 'schema', label: 'Schema', icon: Table },
  { key: 'diagrams', label: 'Diagrams', icon: ImageIcon },
];

const TAB_TO_PATH: Record<AssetTab, string> = {
  'mcp-server': 'mcp-server',
  'skill': 'skills',
  'schema': 'schema',
  'diagrams': 'diagrams',
};

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
  paused: boolean;
  progress: number;
}

export function AgentKitPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('agentKit.title'));

  const graphData = useWikiStore((s) => s.graphData);

  const [status, setStatus] = useState<AgentKitStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastTimers = useRef<Map<string, number>>(new Map());

  const [target, setTarget] = useState<GenerateTarget>('all');
  const [pkg, setPkg] = useState(false);
  const [incremental, setIncremental] = useState(false);
  const [skipDiagrams, setSkipDiagrams] = useState(false);

  const [stdout, setStdout] = useState('');
  const [stderr, setStderr] = useState('');
  const [showLogs, setShowLogs] = useState(false);

  const [activeTab, setActiveTab] = useState<AssetTab>('mcp-server');
  const [files, setFiles] = useState<AgentKitFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);
  const [tabStats, setTabStats] = useState<Partial<Record<AssetTab, { total_files: number; total_size: number }>>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCmd, setCopiedCmd] = useState(false);

  const generationStep = useMemo(() => inferGenerationStep(stdout, generating), [stdout, generating]);

  const addToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type, paused: false, progress: 100 }]);

    const timer = window.setInterval(() => {
      setToasts((prev) => {
        const toast = prev.find((t) => t.id === id);
        if (!toast) {
          window.clearInterval(timer);
          return prev;
        }
        if (toast.paused) return prev;
        const next = toast.progress - (100 / 30);
        if (next <= 0) {
          window.clearInterval(timer);
          toastTimers.current.delete(id);
          return prev.filter((t) => t.id !== id);
        }
        return prev.map((t) => t.id === id ? { ...t, progress: next } : t);
      });
    }, 100);

    toastTimers.current.set(id, timer);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await fetchAgentKitStatus();
      setStatus(s);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => setApiAvailable(r.ok))
      .catch(() => setApiAvailable(false));
  }, []);

  const loadTabStats = useCallback(async (tab: AssetTab) => {
    try {
      const tabPath = TAB_TO_PATH[tab];
      const res = await fetchAgentKitFiles(tabPath, true);
      if (res.stats) {
        setTabStats((prev) => ({ ...prev, [tab]: res.stats! }));
      }
    } catch {
      // ignore stats errors
    }
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setStdout('');
    setStderr('');
    setShowLogs(true);
    try {
      const result = await generateAgentKit({ target, package: pkg, incremental, skipDiagrams });
      setStdout(stripAnsi(result.stdout));
      setStderr(stripAnsi(result.stderr));
      if (result.success) {
        addToast(t('agentKit.generation.success'), 'success');
        await loadStatus();
      } else {
        addToast(t('agentKit.generation.failed'), 'error');
      }
    } catch (e) {
      setError((e as Error).message);
      addToast(t('agentKit.generation.failed'), 'error');
    } finally {
      setGenerating(false);
    }
  };

  const loadFiles = useCallback(async () => {
    if (!status?.generated) return;
    setFilesLoading(true);
    try {
      const tabPath = TAB_TO_PATH[activeTab];
      const [res] = await Promise.all([
        fetchAgentKitFiles(tabPath),
        loadTabStats(activeTab),
      ]);
      setFiles(res.files);
    } catch {
      setFiles([]);
    } finally {
      setFilesLoading(false);
    }
  }, [activeTab, status?.generated, loadTabStats]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleDownloadFile = (path: string) => {
    try {
      downloadAgentKitFile(path);
      addToast(t('agentKit.download.success'), 'success');
    } catch (e) {
      addToast((e as Error).message, 'error');
    }
  };

  const downloadAll = async () => {
    if (!status?.files?.length) return;
    try {
      await downloadAgentKitZip(status.files);
      addToast(t('agentKit.download.zipSuccess'), 'success');
    } catch (e) {
      setError((e as Error).message);
      addToast((e as Error).message, 'error');
    }
  };

  const clearLogs = () => {
    setStdout('');
    setStderr('');
  };

  const nodeCount = graphData?.nodes?.length ?? 0;
  const edgeCount = graphData?.edges?.length ?? 0;

  const commandPreview = useMemo(() => {
    let cmd = `python tools/export_agent_kit.py --target ${target}`;
    if (pkg) cmd += ' --package';
    if (incremental) cmd += ' --incremental';
    if (skipDiagrams) cmd += ' --skip-diagrams';
    return cmd;
  }, [target, pkg, incremental, skipDiagrams]);

  const handleCopyCommand = async () => {
    try {
      await navigator.clipboard.writeText(commandPreview);
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 2000);
    } catch {
      // ignore
    }
  };

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files;
    const q = searchQuery.toLowerCase();
    return files.filter((f) => f.name.toLowerCase().includes(q));
  }, [files, searchQuery]);

  const totalAssetSize = useMemo(() => {
    return files.reduce((sum, f) => sum + f.size, 0);
  }, [files]);

  return (
    <div className="space-y-6 relative">
      {/* Toast notifications */}
      <div className="fixed top-20 right-4 z-50 space-y-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              onMouseEnter={() => setToasts((prev) => prev.map((t) => t.id === toast.id ? { ...t, paused: true } : t))}
              onMouseLeave={() => setToasts((prev) => prev.map((t) => t.id === toast.id ? { ...t, paused: false } : t))}
              className={`pointer-events-auto flex flex-col gap-1.5 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium min-w-[220px] overflow-hidden ${
                toast.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                  : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'
              }`}
            >
              <div className="flex items-center gap-2">
                {toast.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                <span className="flex-1">{toast.message}</span>
              </div>
              <div className="h-0.5 w-full bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full ${toast.type === 'success' ? 'bg-emerald-400' : 'bg-red-400'}`}
                  style={{ width: `${toast.progress}%` }}
                  transition={{ duration: 0.05 }}
                />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">{t('agentKit.title')}</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">{t('agentKit.subtitle')}</p>
        </div>
        <button
          onClick={loadStatus}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-[var(--bg-secondary)] border border-[var(--border-default)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {t('agentKit.refresh')}
        </button>
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 p-4 rounded-xl bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border border-red-100 dark:border-red-900/30"
          >
            <AlertCircle size={18} />
            <span className="text-sm">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-xs underline">{t('agentKit.dismiss')}</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Layers} label={t('stat.nodes')} value={nodeCount} colorClass="text-violet-500" />
        <StatCard icon={Zap} label={t('stat.edges')} value={edgeCount} colorClass="text-amber-500" />
        <StatCard icon={FileText} label={t('agentKit.stat.pages')} value={status?.files?.length ?? 0} colorClass="text-apple-blue" />
        <div className="bg-[var(--bg-secondary)] rounded-2xl p-4 flex flex-col justify-between border border-[var(--border-default)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--bg-primary)] flex items-center justify-center text-emerald-500">
              <Clock size={16} />
            </div>
            <span className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider">{t('agentKit.stat.lastRun')}</span>
          </div>
          <div className="text-lg font-semibold text-[var(--text-primary)] mt-2 tabular-nums">{formatDate(status?.last_run ?? null)}</div>
        </div>
      </div>

      {/* Generation controls */}
      <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 space-y-4 border border-[var(--border-default)]" id="generation-controls">
        <div className="flex items-center gap-2 pb-3 border-b border-[var(--border-default)]">
          <div className="w-8 h-8 rounded-lg bg-apple-blue/10 flex items-center justify-center">
            <Settings2 size={16} className="text-apple-blue" />
          </div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t('agentKit.generation.title')}</h2>
        </div>

        {/* API offline warning */}
        <AnimatePresence>
          {apiAvailable === false && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 text-sm border border-amber-100 dark:border-amber-900/30 overflow-hidden"
            >
              <AlertCircle size={14} />
              {t('agentKit.apiOffline')}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-wrap items-center gap-4">
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value as GenerateTarget)}
            className="px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-default)] text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-apple-blue/20 focus:border-apple-blue outline-none transition-shadow"
          >
            <option value="all">{t('agentKit.generation.target.all')}</option>
            <option value="mcp">{t('agentKit.generation.target.mcp')}</option>
            <option value="skill">{t('agentKit.generation.target.skill')}</option>
          </select>

          <Toggle label={t('agentKit.generation.package')} checked={pkg} onChange={setPkg} />
          <Toggle label={t('agentKit.generation.incremental')} checked={incremental} onChange={setIncremental} />
          <Toggle label={t('agentKit.generation.skipDiagrams')} checked={skipDiagrams} onChange={setSkipDiagrams} />
        </div>

        {/* Command preview */}
        <div className="flex items-center gap-2 text-xs font-mono text-[var(--text-tertiary)] bg-[var(--bg-primary)] px-3 py-2.5 rounded-lg border border-[var(--border-default)]">
          <span className="text-[var(--text-secondary)] select-none">$</span>
          <span className="flex-1 truncate">{commandPreview}</span>
          <button
            onClick={handleCopyCommand}
            className="p-1 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors shrink-0"
            title="Copy command"
          >
            {copiedCmd ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
          </button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleGenerate}
            disabled={generating || apiAvailable === false}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-apple-blue text-white text-sm font-medium hover:bg-apple-blue/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Bot size={16} />}
            {generating ? t('agentKit.generation.running') : t('agentKit.generation.run')}
          </button>

          {generating && generationStep && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"
            >
              <div className="w-24 h-1.5 bg-[var(--border-default)] rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-apple-blue rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${generationStep.percent}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <span className="text-xs">{generationStep.step}</span>
            </motion.div>
          )}
        </div>

        {/* Log output */}
        <AnimatePresence>
          {showLogs && (stdout || stderr || generating) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-2 border border-[var(--border-default)] rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-[var(--bg-tertiary)] border-b border-[var(--border-default)]">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">{t('agentKit.logs.title')}</span>
                  <div className="flex items-center gap-2">
                    {(stdout || stderr) && (
                      <button
                        onClick={clearLogs}
                        className="flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={12} />
                        {t('agentKit.logs.clear')}
                      </button>
                    )}
                    <button onClick={() => setShowLogs(false)} className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">{t('agentKit.logs.hide')}</button>
                  </div>
                </div>
                <div className="p-3 bg-[var(--bg-primary)] max-h-80 overflow-auto space-y-2">
                  {stdout && (
                    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)]/40 p-2.5">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <CheckCircle size={10} className="text-emerald-500" />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">stdout</span>
                      </div>
                      <pre className="text-xs font-mono text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">{stdout}</pre>
                    </div>
                  )}
                  {stderr && (
                    <div className="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50/60 dark:bg-red-950/20 p-2.5">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <AlertCircle size={10} className="text-red-500" />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-red-500/70">stderr</span>
                      </div>
                      <pre className="text-xs font-mono text-red-600 dark:text-red-400 whitespace-pre-wrap leading-relaxed">{stderr}</pre>
                    </div>
                  )}
                  {generating && !stdout && !stderr && (
                    <div className="flex items-center gap-2 py-4">
                      <Loader2 size={14} className="animate-spin text-[var(--text-tertiary)]" />
                      <p className="text-xs text-[var(--text-tertiary)] italic">{t('agentKit.logs.waiting')}</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Generated assets */}
      <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 space-y-4 border border-[var(--border-default)]">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-default)]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-apple-blue/10 flex items-center justify-center">
              <FolderOpen size={16} className="text-apple-blue" />
            </div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t('agentKit.assets.title')}</h2>
          </div>
          <div className="flex items-center gap-2">
            {status?.generated && totalAssetSize > 0 && (
              <span className="text-xs text-[var(--text-tertiary)]">
                {formatBytes(totalAssetSize)} total
              </span>
            )}
            {status?.files?.length ? (
              <button
                onClick={downloadAll}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-[var(--bg-primary)] border border-[var(--border-default)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-colors"
              >
                <Download size={14} />
                {t('agentKit.assets.downloadAll')}
              </button>
            ) : null}
          </div>
        </div>

        {!status?.generated ? (
          <div className="text-center py-16">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-apple-blue/15 to-purple-500/15 flex items-center justify-center mb-4"
            >
              <Bot size={28} className="text-apple-blue" />
            </motion.div>
            <p className="text-base font-medium text-[var(--text-primary)]">{t('agentKit.assets.empty.title')}</p>
            <p className="text-sm text-[var(--text-secondary)] mt-1 max-w-xs mx-auto">{t('agentKit.assets.empty.description')}</p>
            <button
              onClick={() => {
                const el = document.getElementById('generation-controls');
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-apple-blue text-white text-sm font-medium hover:bg-apple-blue/90 transition-colors active:scale-[0.98]"
            >
              <Play size={14} />
              {t('agentKit.generation.run')}
            </button>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-2 border-b border-[var(--border-default)] pb-2">
              {TAB_CONFIG.map((tab) => {
                const stat = tabStats[tab.key];
                return (
                  <button
                    key={tab.key}
                    onClick={() => {
                      setActiveTab(tab.key);
                      setSearchQuery('');
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${
                      activeTab === tab.key
                        ? 'bg-apple-blue/10 text-apple-blue font-medium shadow-sm'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                    }`}
                  >
                    <tab.icon size={14} />
                    {tab.label}
                    {stat !== undefined && (
                      <span className={`ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                        activeTab === tab.key
                          ? 'bg-apple-blue/20 text-apple-blue'
                          : 'bg-[var(--bg-primary)] text-[var(--text-tertiary)]'
                      }`}>
                        {stat.total_files}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('agentKit.search.placeholder')}
                className="w-full pl-8 pr-8 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-default)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:ring-2 focus:ring-apple-blue/20 focus:border-apple-blue outline-none transition-shadow"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* File tree */}
            {filesLoading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Loader2 size={20} className="animate-spin text-[var(--text-tertiary)]" />
                <span className="text-xs text-[var(--text-tertiary)]">{t('agentKit.files.loading')}</span>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="text-center py-8">
                <Search size={24} className="mx-auto text-[var(--text-tertiary)] mb-2" />
                <p className="text-sm text-[var(--text-tertiary)]">
                  {searchQuery ? t('agentKit.search.noResults') : t('agentKit.assets.noFiles')}
                </p>
              </div>
            ) : (
              <div className="space-y-0.5 max-h-[480px] overflow-auto rounded-lg border border-[var(--border-default)] p-1">
                {filteredFiles.map((file) => (
                  <FileTreeNode
                    key={file.path}
                    file={file}
                    depth={0}
                    onDownload={handleDownloadFile}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function StatCard({ icon: Icon, label, value, colorClass = 'text-apple-blue' }: { icon: React.ElementType; label: string; value: number; colorClass?: string }) {
  return (
    <div className="bg-[var(--bg-secondary)] rounded-2xl p-4 flex flex-col justify-between border border-[var(--border-default)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-lg bg-[var(--bg-primary)] flex items-center justify-center ${colorClass}`}>
          <Icon size={16} />
        </div>
        <span className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-semibold text-[var(--text-primary)] mt-2 tabular-nums">{value}</div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none group">
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-9 h-5 bg-[var(--border-default)] peer-checked:bg-apple-blue rounded-full transition-colors duration-200" />
        <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 peer-checked:translate-x-4 shadow-sm" />
      </div>
      <span className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">{label}</span>
    </label>
  );
}

function getFileIconInfo(name: string): { icon: React.ElementType; color: string } {
  if (name.endsWith('.py')) return { icon: FileCode, color: 'text-blue-500' };
  if (name.endsWith('.json')) return { icon: FileCode, color: 'text-amber-500' };
  if (name.endsWith('.md') || name.endsWith('.txt')) return { icon: FileText, color: 'text-slate-500 dark:text-slate-400' };
  if (name.endsWith('.yaml') || name.endsWith('.yml')) return { icon: FileCode, color: 'text-purple-500' };
  if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.svg') || name.endsWith('.gif')) {
    return { icon: ImageIcon, color: 'text-green-500' };
  }
  if (name.endsWith('.zip') || name.endsWith('.tar') || name.endsWith('.gz')) return { icon: Package, color: 'text-orange-500' };
  return { icon: FileText, color: 'text-[var(--text-tertiary)]' };
}

function FileTreeNode({
  file,
  depth,
  onDownload,
}: {
  file: AgentKitFile;
  depth: number;
  onDownload: (path: string) => void;
}) {
  const [children, setChildren] = useState<AgentKitFile[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    if (!file.is_dir) return;
    if (!expanded && children.length === 0) {
      setLoading(true);
      try {
        const res = await fetchAgentKitFiles(file.path);
        setChildren(res.files);
      } catch {
        setChildren([]);
      } finally {
        setLoading(false);
      }
    }
    setExpanded((v) => !v);
  };

  const { icon: FileIconComp, color: fileColor } = file.is_dir
    ? { icon: FolderOpen, color: 'text-amber-500' }
    : getFileIconInfo(file.name);

  const indent = depth * 16;

  if (file.is_dir) {
    return (
      <div>
        <button
          onClick={toggle}
          className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-sm text-[var(--text-primary)] transition-colors"
          style={{ paddingLeft: `${12 + indent}px` }}
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin text-[var(--text-tertiary)] shrink-0" />
          ) : expanded ? (
            <ChevronDown size={14} className="text-[var(--text-tertiary)] shrink-0" />
          ) : (
            <ChevronRight size={14} className="text-[var(--text-tertiary)] shrink-0" />
          )}
          <FileIconComp size={14} className={`${fileColor} shrink-0`} />
          <span className="font-medium truncate">{file.name}</span>
        </button>
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              {children.map((child) => (
                <FileTreeNode
                  key={child.path}
                  file={child}
                  depth={depth + 1}
                  onDownload={onDownload}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] group transition-colors cursor-default"
      style={{ paddingLeft: `${12 + indent + 20}px` }}
    >
      <FileIconComp size={14} className={`${fileColor} shrink-0`} />
      <span className="text-sm text-[var(--text-primary)] flex-1 truncate">{file.name}</span>
      <span className="text-xs text-[var(--text-tertiary)] tabular-nums">{formatBytes(file.size)}</span>
      <button
        onClick={() => onDownload(file.path)}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] transition-all"
        title="Download"
      >
        <Download size={14} />
      </button>
    </div>
  );
}
