import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bot, RefreshCw, Loader2, AlertCircle,
  FileCode, FileText, FolderOpen, Download, Package,
  Layers, Terminal, ChevronRight, ChevronDown,
  Zap, Settings2, Image as ImageIcon, Table
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

type GenerateTarget = 'all' | 'mcp' | 'skill';
type AssetTab = 'mcp-server' | 'skill' | 'schema' | 'diagrams';

const TAB_CONFIG: { key: AssetTab; label: string; icon: React.ElementType }[] = [
  { key: 'mcp-server', label: 'MCP Server', icon: Terminal },
  { key: 'skill', label: 'Skill', icon: Package },
  { key: 'schema', label: 'Schema', icon: Table },
  { key: 'diagrams', label: 'Diagrams', icon: ImageIcon },
];

export function AgentKitPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('agentKit.title'));

  const graphData = useWikiStore((s) => s.graphData);

  const [status, setStatus] = useState<AgentKitStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

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

  const handleGenerate = async () => {
    setGenerating(true);
    setStdout('');
    setStderr('');
    setShowLogs(true);
    try {
      const result = await generateAgentKit({ target, package: pkg, incremental, skipDiagrams });
      setStdout(result.stdout);
      setStderr(result.stderr);
      if (result.success) {
        await loadStatus();
      }
    } catch (e) {
      setError((e as Error).message);
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
    } catch (e) {
      // silently fail; files may not exist yet
    } finally {
      setFilesLoading(false);
    }
  }, [activeTab, status?.generated]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const toggleDir = (path: string) => {
    const next = new Set(expandedDirs);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setExpandedDirs(next);
  };

  const downloadAll = async () => {
    if (!status?.files?.length) return;
    try {
      await downloadAgentKitZip(status.files);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const nodeCount = graphData?.nodes?.length ?? 0;
  const edgeCount = graphData?.edges?.length ?? 0;

  return (
    <div className="space-y-6">
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

        <button
          onClick={handleGenerate}
          disabled={generating}
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
                  <button onClick={() => setShowLogs(false)} className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">{t('agentKit.logs.hide')}</button>
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
              <div className="space-y-1">
                {files.map((file) => (
                  <FileRow
                    key={file.path}
                    file={file}
                    expanded={expandedDirs.has(file.path)}
                    onToggle={() => toggleDir(file.path)}
                    onDownload={() => downloadAgentKitFile(file.path)}
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

function FileRow({
  file,
  expanded,
  onToggle,
  onDownload,
}: {
  file: AgentKitFile;
  expanded: boolean;
  onToggle: () => void;
  onDownload: () => void;
}) {
  const Icon = file.is_dir ? FolderOpen : file.name.endsWith('.py') ? FileCode : FileText;

  if (file.is_dir) {
    return (
      <div>
        <button
          onClick={onToggle}
          className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-sm text-[var(--text-primary)] transition-colors"
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <Icon size={14} className="text-amber-500" />
          <span className="font-medium">{file.name}</span>
        </button>
        {/* Directory children would be fetched on expand; simplified here */}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] group transition-colors">
      <span className="w-4" />
      <Icon size={14} className="text-[var(--text-tertiary)]" />
      <span className="text-sm text-[var(--text-primary)] flex-1 truncate">{file.name}</span>
      <span className="text-xs text-[var(--text-tertiary)]">{formatBytes(file.size)}</span>
      <button
        onClick={onDownload}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] transition-all"
        title="Download"
      >
        <Download size={14} />
      </button>
    </div>
  );
}
