import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Wrench, Play, Loader2, CheckCircle, XCircle, Terminal,
  RefreshCw, Sparkles, Layers, ShieldCheck,
} from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { fetchToolsList, type ToolInfo } from '@/services/dataService';
import { useNotificationStore } from '@/stores/notificationStore';

const ICON_MAP: Record<string, React.ElementType> = {
  lint: ShieldCheck,
  heal: Sparkles,
  refresh: RefreshCw,
  'build-graph': Layers,
};

const COLOR_MAP: Record<string, string> = {
  lint: 'text-apple-orange bg-apple-orange/10',
  heal: 'text-apple-pink bg-apple-pink/10',
  refresh: 'text-apple-blue bg-apple-blue/10',
  'build-graph': 'text-apple-purple bg-apple-purple/10',
};

interface ToolResult {
  name: string;
  success: boolean;
  stdout: string;
  stderr: string;
  returncode: number;
}

export function ToolsRegistryPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('tools.title', 'Tools'));
  const addNotification = useNotificationStore((s) => s.addNotification);

  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<ToolResult | null>(null);

  const loadTools = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchToolsList();
      setTools(data.tools);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTools();
  }, [loadTools]);

  const runTool = useCallback(async (tool: ToolInfo) => {
    setRunning(tool.name);
    setResult(null);
    try {
      const res = await fetch(tool.endpoint, {
        method: tool.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ args: [] }),
      });
      const data = await res.json();
      const tr: ToolResult = {
        name: tool.name,
        success: data.success ?? res.ok,
        stdout: data.stdout || '',
        stderr: data.stderr || '',
        returncode: data.returncode ?? (res.ok ? 0 : -1),
      };
      setResult(tr);
      addNotification(
        tr.success ? t('tools.runSuccess', { name: tool.name }) : t('tools.runFailed', { name: tool.name }),
        tr.success ? 'success' : 'error',
      );
    } catch (e) {
      const tr: ToolResult = {
        name: tool.name,
        success: false,
        stdout: '',
        stderr: (e as Error).message,
        returncode: -1,
      };
      setResult(tr);
      addNotification(tr.stderr, 'error');
    } finally {
      setRunning(null);
    }
  }, [addNotification, t]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 size={24} className="animate-spin text-[var(--text-tertiary)]" />
        <p className="text-sm text-[var(--text-tertiary)]">{t('tools.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <XCircle size={24} className="text-apple-red" />
        <p className="text-sm text-apple-red">{error}</p>
        <button onClick={loadTools} className="apple-button text-xs">{t('error.retry')}</button>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-semibold flex items-center gap-3">
          <Wrench size={28} className="text-apple-blue" />
          {t('tools.title', 'Tools Registry')}
        </h1>
        <button onClick={loadTools} className="apple-button-ghost flex items-center gap-2 px-3 py-2 text-sm">
          <RefreshCw size={14} />
          {t('status.refresh')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {tools.map((tool) => {
          const Icon = ICON_MAP[tool.name] || Wrench;
          const color = COLOR_MAP[tool.name] || 'text-apple-blue bg-apple-blue/10';
          const isRunning = running === tool.name;
          return (
            <motion.div
              key={tool.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="apple-card p-5 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <h3 className="font-medium text-[var(--text-primary)] capitalize">{tool.name.replace('-', ' ')}</h3>
                    <p className="text-xs text-[var(--text-secondary)]">{tool.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => runTool(tool)}
                  disabled={isRunning}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl transition-all ${
                    isRunning
                      ? 'bg-apple-blue/10 text-apple-blue'
                      : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-apple-blue/10 hover:text-apple-blue'
                  }`}
                >
                  {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                  {isRunning ? t('tools.running') : t('tools.run')}
                </button>
              </div>
              {result?.name === tool.name && (
                <div className={`text-xs rounded-xl p-3 border ${
                  result.success
                    ? 'bg-apple-green/5 border-apple-green/20 text-[var(--text-secondary)]'
                    : 'bg-apple-red/5 border-apple-red/20 text-apple-red'
                }`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    {result.success ? <CheckCircle size={12} className="text-apple-green" /> : <XCircle size={12} />}
                    <span className="font-medium">{result.success ? t('tools.success') : t('tools.failed')}</span>
                    <span className="text-[var(--text-tertiary)] ml-auto">code {result.returncode}</span>
                  </div>
                  {result.stdout && (
                    <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed opacity-80">
                      {result.stdout}
                    </pre>
                  )}
                  {result.stderr && (
                    <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-apple-red/80">
                      {result.stderr}
                    </pre>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {tools.length === 0 && !loading && (
        <div className="empty-state-warm">
          <Terminal size={32} className="text-[var(--text-tertiary)]" />
          <p className="text-sm text-[var(--text-secondary)]">{t('tools.empty')}</p>
        </div>
      )}
    </motion.div>
  );
}
