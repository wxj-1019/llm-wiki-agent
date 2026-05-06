import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Database, Network, Bot, FileText, Clock,
  Server, HardDrive, Zap, CheckCircle, AlertCircle, RefreshCw,
  Wrench, Sparkles, Layers, Terminal, X,
} from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

interface SystemStatus {
  wiki: {
    pages: number;
    sources: number;
    entities: number;
    concepts: number;
    syntheses: number;
    last_ingest: string | null;
  };
  graph: { ready: boolean; path: string | null };
  raw: { files: number };
  agent_kit: { generated: boolean; files: number };
  llm: { provider: string; model: string; api_key_set: boolean };
  server: { time: string; version: string };
}

interface ToolResult {
  name: string;
  success: boolean;
  stdout: string;
  stderr: string;
  returncode: number;
}

const TOOLS = [
  {
    name: 'lint',
    labelKey: 'status.tools.lint',
    descriptionKey: 'status.tools.lintDesc',
    icon: Wrench,
    color: 'text-apple-orange bg-apple-orange/10',
    endpoint: '/api/tools/lint',
  },
  {
    name: 'heal',
    labelKey: 'status.tools.heal',
    descriptionKey: 'status.tools.healDesc',
    icon: Sparkles,
    color: 'text-apple-pink bg-apple-pink/10',
    endpoint: '/api/tools/heal',
  },
  {
    name: 'refresh',
    labelKey: 'status.tools.refresh',
    descriptionKey: 'status.tools.refreshDesc',
    icon: RefreshCw,
    color: 'text-apple-blue bg-apple-blue/10',
    endpoint: '/api/tools/refresh',
  },
  {
    name: 'build-graph',
    labelKey: 'status.tools.buildGraph',
    descriptionKey: 'status.tools.buildGraphDesc',
    icon: Layers,
    color: 'text-apple-purple bg-apple-purple/10',
    endpoint: '/api/tools/build-graph',
  },
];

export function StatusPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('status.title'));
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [runningTool, setRunningTool] = useState<string | null>(null);
  const [toolResult, setToolResult] = useState<ToolResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useBodyScrollLock(showResult);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStatus(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    return () => {
      if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    };
  }, []);

  const runTool = useCallback(async (tool: typeof TOOLS[0]) => {
    setRunningTool(tool.name);
    setToolResult(null);
    setShowResult(false);
    try {
      const res = await fetch(tool.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ args: [] }),
      });
      const data = await res.json();
      setToolResult({
        name: tool.name,
        success: data.success,
        stdout: data.stdout || '',
        stderr: data.stderr || '',
        returncode: data.returncode ?? -1,
      });
      setShowResult(true);
      // Auto-hide after 30s
      if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
      resultTimerRef.current = setTimeout(() => setShowResult(false), 30000);
    } catch (e) {
      setToolResult({
        name: tool.name,
        success: false,
        stdout: '',
        stderr: (e as Error).message,
        returncode: -1,
      });
      setShowResult(true);
    } finally {
      setRunningTool(null);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <RefreshCw size={24} className="animate-spin text-[var(--text-tertiary)]" />
        <p className="text-sm text-[var(--text-tertiary)]">{t('status.loading')}</p>
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <AlertCircle size={24} className="text-red-500" />
        <p className="text-sm text-red-500">{t('status.error.title', { error })}</p>
        <button onClick={fetchStatus} className="apple-button text-xs">{t('error.retry')}</button>
      </div>
    );
  }

  const statCards = [
    { label: t('status.stat.wikiPages'), value: status.wiki.pages, icon: Database, color: 'text-apple-blue', bg: 'bg-apple-blue/10' },
    { label: t('status.stat.sources'), value: status.wiki.sources, icon: FileText, color: 'text-apple-green', bg: 'bg-apple-green/10' },
    { label: t('status.stat.entities'), value: status.wiki.entities, icon: Activity, color: 'text-apple-purple', bg: 'bg-apple-purple/10' },
    { label: t('status.stat.concepts'), value: status.wiki.concepts, icon: Zap, color: 'text-apple-orange', bg: 'bg-apple-orange/10' },
    { label: t('status.stat.rawFiles'), value: status.raw.files, icon: HardDrive, color: 'text-apple-orange', bg: 'bg-apple-orange/10' },
    { label: t('status.stat.agentKitFiles'), value: status.agent_kit.files, icon: Bot, color: 'text-apple-pink', bg: 'bg-apple-pink/10' },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-semibold flex items-center gap-3">
          <Activity size={28} className="text-apple-blue" />
          {t('status.title')}
        </h1>
        <button
          onClick={fetchStatus}
          className="apple-button-ghost flex items-center gap-2 px-3 py-2 text-sm"
        >
          <RefreshCw size={14} />
          {t('status.refresh')}
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {statCards.map((card) => (
          <div key={card.label} className="apple-card p-4 flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-xl ${card.bg} flex items-center justify-center ${card.color}`}>
                <card.icon size={16} />
              </div>
              <span className="text-xs text-[var(--text-tertiary)]">{card.label}</span>
            </div>
            <div className="text-2xl font-semibold text-[var(--text-primary)] mt-2 tabular-nums">{card.value}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2 text-[var(--text-secondary)] uppercase tracking-wider">
          <Terminal size={18} />
          {t('status.tools.title', 'Quick Actions')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TOOLS.map((tool) => (
            <button
              key={tool.name}
              onClick={() => runTool(tool)}
              disabled={runningTool === tool.name}
              className="apple-card p-4 text-left transition-all hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${tool.color}`}>
                  <tool.icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{t(tool.labelKey, tool.name)}</div>
                  <div className="text-xs text-[var(--text-tertiary)] truncate">{t(tool.descriptionKey, '')}</div>
                </div>
              </div>
              {runningTool === tool.name && (
                <div className="flex items-center gap-2 text-xs text-apple-blue mt-2">
                  <RefreshCw size={12} className="animate-spin" />
                  {t('status.tools.running', 'Running...')}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tool Result Modal */}
      <AnimatePresence>
        {showResult && toolResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
            onClick={() => setShowResult(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col"
              role="dialog"
              aria-modal="true"
              aria-label={t('status.tools.resultTitle', 'Tool Result')}
            >
              <div className="flex items-center justify-between p-4 border-b border-[var(--border-default)]">
                <div className="flex items-center gap-2">
                  {toolResult.success ? (
                    <CheckCircle size={18} className="text-emerald-500" />
                  ) : (
                    <AlertCircle size={18} className="text-red-500" />
                  )}
                  <span className="font-medium">
                    {t(`status.tools.${toolResult.name}`, toolResult.name)} — {toolResult.success ? t('status.tools.success', 'Success') : t('status.tools.failed', 'Failed')}
                  </span>
                </div>
                <button
                  onClick={() => setShowResult(false)}
                  className="p-1 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
                  aria-label={t('common.close', 'Close')}
                >
                  <X size={16} />
                </button>
              </div>
              <div className="p-4 overflow-y-auto space-y-3 text-sm font-mono">
                {toolResult.stdout && (
                  <div>
                    <div className="text-xs text-[var(--text-tertiary)] mb-1 uppercase tracking-wider">stdout</div>
                    <pre className="bg-[var(--bg-secondary)] p-3 rounded-xl whitespace-pre-wrap break-all text-xs">{toolResult.stdout}</pre>
                  </div>
                )}
                {toolResult.stderr && (
                  <div>
                    <div className="text-xs text-red-400 mb-1 uppercase tracking-wider">stderr</div>
                    <pre className="bg-red-500/5 text-red-500 p-3 rounded-xl whitespace-pre-wrap break-all text-xs">{toolResult.stderr}</pre>
                  </div>
                )}
                {!toolResult.stdout && !toolResult.stderr && (
                  <div className="text-[var(--text-tertiary)] italic">{t('status.tools.noOutput', 'No output')}</div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* LLM Status */}
        <div className="apple-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-apple-purple/10 flex items-center justify-center text-apple-purple">
              <Bot size={16} />
            </div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t('status.llm.title')}</h2>
          </div>
          <div className="space-y-3">
            <StatusRow label={t('status.llm.provider')} value={status.llm.provider} />
            <StatusRow label={t('status.llm.model')} value={status.llm.model} />
            <StatusRow
              label={t('status.llm.apiKey')}
              value={status.llm.api_key_set ? t('status.llm.configured') : t('status.llm.notSet')}
              valueClass={status.llm.api_key_set ? 'text-emerald-500' : 'text-amber-500'}
            />
          </div>
        </div>

        {/* Graph Status */}
        <div className="apple-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-apple-indigo/10 flex items-center justify-center text-apple-indigo">
              <Network size={16} />
            </div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t('status.graph.title')}</h2>
          </div>
          <div className="space-y-3">
            <StatusRow
              label={t('status.graph.status')}
              value={status.graph.ready ? t('status.graph.ready') : t('status.graph.notBuilt')}
              icon={status.graph.ready ? CheckCircle : AlertCircle}
              iconClass={status.graph.ready ? 'text-emerald-500' : 'text-amber-500'}
            />
            <StatusRow label={t('status.graph.path')} value={status.graph.path || '—'} />
          </div>
        </div>

        {/* Agent Kit */}
        <div className="apple-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-apple-pink/10 flex items-center justify-center text-apple-pink">
              <Bot size={16} />
            </div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t('status.agentKit.title')}</h2>
          </div>
          <div className="space-y-3">
            <StatusRow
              label={t('status.agentKit.generated')}
              value={status.agent_kit.generated ? t('status.yes') : t('status.no')}
              icon={status.agent_kit.generated ? CheckCircle : AlertCircle}
              iconClass={status.agent_kit.generated ? 'text-emerald-500' : 'text-amber-500'}
            />
            <StatusRow label={t('status.agentKit.files')} value={String(status.agent_kit.files)} />
          </div>
        </div>

        {/* Server */}
        <div className="apple-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-apple-blue/10 flex items-center justify-center text-apple-blue">
              <Server size={16} />
            </div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t('status.server.title')}</h2>
          </div>
          <div className="space-y-3">
            <StatusRow label={t('status.server.version')} value={status.server.version} />
            <StatusRow label={t('status.server.time')} value={status.server.time} />
            <StatusRow
              label={t('status.server.lastIngest')}
              value={status.wiki.last_ingest || t('status.never')}
              icon={Clock}
              iconClass="text-[var(--text-tertiary)]"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StatusRow({
  label,
  value,
  icon: Icon,
  valueClass,
  iconClass,
}: {
  label: string;
  value: string;
  icon?: React.ElementType;
  valueClass?: string;
  iconClass?: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <div className={`flex items-center gap-1.5 font-medium ${valueClass || 'text-[var(--text-primary)]'}`}>
        {Icon && <Icon size={14} className={iconClass} />}
        <span>{value}</span>
      </div>
    </div>
  );
}
