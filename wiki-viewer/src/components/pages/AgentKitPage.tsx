import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bot, RefreshCw, Loader2, AlertCircle, Trash2,
  FileCode, FileText, FolderOpen, Download, Package,
  Layers, Terminal, ChevronRight, ChevronDown,
  Zap, Settings2, Image as ImageIcon, Table, CheckCircle
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

type GenerateTarget = 'all' | 'mcp' | 'skill';
type AssetTab = 'mcp-server' | 'skill' | 'schema' | 'diagrams';

const TAB_CONFIG: { key: AssetTab; label: string; icon: React.ElementType }[] = [
  { key: 'mcp-server', label: 'MCP Server', icon: Terminal },
  { key: 'skill', label: 'Skill', icon: Package },
  { key: 'schema', label: 'Schema', icon: Table },
  { key: 'diagrams', label: 'Diagrams', icon: ImageIcon },
];

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
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

  const addToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
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

  // Check API availability
  useEffect(() => {
    fetch('/api/health')
      .then((r) => setApiAvailable(r.ok))
      .catch(() => setApiAvailable(false));
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
      const res = await fetchAgentKitFiles(activeTab);
      setFiles(res.files);
    } catch {
      setFiles([]);
    } finally {
      setFilesLoading(false);
    }
  }, [activeTab, status?.generated]);

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

  return (
    <div className="space-y-6 relative">
      {/* Toast notifications */}
      <div className="fixed top-20 right-4 z-50 space-y-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className={`pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium ${
                toast.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                  : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'
              }`}
            >
              {toast.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
              {toast.message}
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
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-colors"
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
            className="flex items-center gap-3 p-4 rounded-xl bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
          >
            <AlertCircle size={18} />
            <span className="text-sm">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-xs underline">{t('agentKit.dismiss')}</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Layers} label={t('stat.nodes')} value={nodeCount} />
        <StatCard icon={Zap} label={t('stat.edges')} value={edgeCount} />
        <StatCard icon={FileText} label={t('agentKit.stat.pages')} value={status?.files?.length ?? 0} />
        <div className="bg-[var(--bg-secondary)] rounded-2xl p-4 flex flex-col justify-between">
          <div className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider">{t('agentKit.stat.lastRun')}</div>
          <div className="text-lg font-semibold text-[var(--text-primary)] mt-1">{formatDate(status?.last_run ?? null)}</div>
        </div>
      </div>

      {/* Generation controls */}
      <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Settings2 size={18} className="text-apple-blue" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t('agentKit.generation.title')}</h2>
        </div>

        {/* API offline warning */}
        {apiAvailable === false && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 text-sm">
            <AlertCircle size={14} />
            {t('agentKit.apiOffline')}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value as GenerateTarget)}
            className="px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-default)] text-sm text-[var(--text-primary)]"
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
        <div className="text-xs font-mono text-[var(--text-tertiary)] bg-[var(--bg-primary)] px-3 py-2 rounded-lg border border-[var(--border-default)]">
          <span className="text-[var(--text-secondary)]">$</span> python tools/export_agent_kit.py --target {target}
          {pkg ? ' --package' : ''}
          {incremental ? ' --incremental' : ''}
          {skipDiagrams ? ' --skip-diagrams' : ''}
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating || apiAvailable === false}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-apple-blue text-white text-sm font-medium hover:bg-apple-blue/90 disabled:opacity-50 transition-colors"
        >
          {generating ? <Loader2 size={16} className="animate-spin" /> : <Bot size={16} />}
          {generating ? t('agentKit.generation.running') : t('agentKit.generation.run')}
        </button>

        {/* Log output */}
        <AnimatePresence>
          {showLogs && (stdout || stderr || generating) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 border border-[var(--border-default)] rounded-xl overflow-hidden">
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
                <div className="p-3 bg-[var(--bg-primary)] max-h-80 overflow-auto">
                  {stdout && (
                    <pre className="text-xs font-mono text-[var(--text-secondary)] whitespace-pre-wrap">{stdout}</pre>
                  )}
                  {stderr && (
                    <pre className="text-xs font-mono text-red-500 whitespace-pre-wrap mt-2">{stderr}</pre>
                  )}
                  {generating && !stdout && !stderr && (
                    <p className="text-xs text-[var(--text-tertiary)] italic">{t('agentKit.logs.waiting')}</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Generated assets */}
      <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen size={18} className="text-apple-blue" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t('agentKit.assets.title')}</h2>
          </div>
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

        {!status?.generated ? (
          <div className="text-center py-12">
            <Bot size={40} className="mx-auto text-[var(--text-tertiary)] mb-3" />
            <p className="text-sm text-[var(--text-secondary)]">{t('agentKit.assets.empty.title')}</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">{t('agentKit.assets.empty.description')}</p>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-2 border-b border-[var(--border-default)] pb-2">
              {TAB_CONFIG.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    activeTab === tab.key
                      ? 'bg-apple-blue/10 text-apple-blue font-medium'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                  }`}
                >
                  <tab.icon size={14} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* File tree */}
            {filesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-[var(--text-tertiary)]" />
              </div>
            ) : files.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)] py-4">{t('agentKit.assets.noFiles')}</p>
            ) : (
              <div className="space-y-0.5">
                {files.map((file) => (
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

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="bg-[var(--bg-secondary)] rounded-2xl p-4 flex flex-col justify-between">
      <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
        <Icon size={14} />
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-semibold text-[var(--text-primary)] mt-2">{value}</div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-default)] cursor-pointer text-sm text-[var(--text-secondary)] select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-[var(--border-default)] text-apple-blue focus:ring-apple-blue"
      />
      {label}
    </label>
  );
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

  const Icon = file.is_dir ? FolderOpen : file.name.endsWith('.py') ? FileCode : FileText;
  const indent = depth * 20;

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

  if (file.is_dir) {
    return (
      <div>
        <button
          onClick={toggle}
          className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-sm text-[var(--text-primary)] transition-colors"
          style={{ paddingLeft: `${12 + indent}px` }}
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin text-[var(--text-tertiary)]" />
          ) : expanded ? (
            <ChevronDown size={14} className="text-[var(--text-tertiary)]" />
          ) : (
            <ChevronRight size={14} className="text-[var(--text-tertiary)]" />
          )}
          <Icon size={14} className="text-amber-500" />
          <span className="font-medium">{file.name}</span>
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
      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] group transition-colors"
      style={{ paddingLeft: `${12 + indent + 20}px` }}
    >
      <Icon size={14} className="text-[var(--text-tertiary)]" />
      <span className="text-sm text-[var(--text-primary)] flex-1 truncate">{file.name}</span>
      <span className="text-xs text-[var(--text-tertiary)]">{formatBytes(file.size)}</span>
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
