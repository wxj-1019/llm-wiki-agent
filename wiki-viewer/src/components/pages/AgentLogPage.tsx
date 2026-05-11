import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  FileText, RefreshCw, AlertCircle, CheckCircle, XCircle,
  Clock, Filter, X,
} from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

interface AuditEntry {
  id?: string;
  step_id?: string;
  timestamp: string;
  tool: string;
  tool_name?: string;
  risk_level: string;
  success: boolean;
  duration_ms: number;
  error?: string;
  detail?: string;
}

export function AgentLogPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('nav.agentLog', 'Agent Log'));

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toolFilter, setToolFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [successFilter, setSuccessFilter] = useState<'' | 'true' | 'false'>('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch('/api/jarvis/audit?limit=200');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const rawList: AuditEntry[] = data?.entries ?? (Array.isArray(data) ? data : []);
      const list = rawList.map((e, i) => ({
        ...e,
        tool_name: e.tool_name ?? e.tool ?? 'unknown',
        detail: e.detail ?? e.error ?? '',
        id: e.step_id ?? `entry-${i}`,
      }));
      setEntries(list);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
    intervalRef.current = setInterval(fetchEntries, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchEntries]);

  const toolNames = [...new Set(entries.map((e) => e.tool_name))].sort();

  const filtered = entries.filter((entry) => {
    if (toolFilter && entry.tool_name !== toolFilter) return false;
    if (riskFilter && entry.risk_level !== riskFilter) return false;
    if (successFilter === 'true' && !entry.success) return false;
    if (successFilter === 'false' && entry.success) return false;
    return true;
  });

  const hasFilters = toolFilter || riskFilter || successFilter;

  const clearFilters = useCallback(() => {
    setToolFilter('');
    setRiskFilter('');
    setSuccessFilter('');
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <RefreshCw size={24} className="animate-spin text-[var(--text-tertiary)]" />
        <p className="text-sm text-[var(--text-tertiary)]">{t('common.loading', 'Loading...')}</p>
      </div>
    );
  }

  if (error && entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <AlertCircle size={24} className="text-apple-red" />
        <p className="text-sm text-apple-red">{error}</p>
        <button onClick={fetchEntries} className="apple-button text-xs">{t('error.retry')}</button>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-semibold flex items-center gap-3">
          <FileText size={28} className="text-apple-purple" />
          {t('nav.agentLog', 'Agent Log')}
        </h1>
        <button
          onClick={fetchEntries}
          className="apple-button-ghost flex items-center gap-2 px-3 py-2 text-sm"
        >
          <RefreshCw size={14} />
          {t('status.refresh', 'Refresh')}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
          <Filter size={14} />
          Filters:
        </div>

        <select
          value={toolFilter}
          onChange={(e) => setToolFilter(e.target.value)}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)]"
        >
          <option value="">All Tools</option>
          {toolNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)]"
        >
          <option value="">All Risks</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>

        <select
          value={successFilter}
          onChange={(e) => setSuccessFilter(e.target.value as '' | 'true' | 'false')}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)]"
        >
          <option value="">All Outcomes</option>
          <option value="true">Success</option>
          <option value="false">Failed</option>
        </select>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-apple-red hover:underline"
          >
            <X size={12} />
            Clear
          </button>
        )}

        <div className="ml-auto text-xs text-[var(--text-tertiary)]">
          {filtered.length} of {entries.length} entries
        </div>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="apple-card p-8 text-center">
            <Clock size={24} className="mx-auto text-[var(--text-tertiary)] mb-2" />
            <p className="text-sm text-[var(--text-tertiary)]">
              {entries.length === 0 ? 'No audit entries yet' : 'No entries match filters'}
            </p>
          </div>
        ) : (
          filtered.map((entry) => (
            <div key={entry.id} className="apple-card p-3 flex items-center gap-3">
              <div className="shrink-0">
                {entry.success ? (
                  <CheckCircle size={16} className="text-apple-green" />
                ) : (
                  <XCircle size={16} className="text-apple-red" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-[var(--text-primary)]">{entry.tool_name}</span>
                  <RiskBadge level={entry.risk_level} />
                </div>
                {entry.detail && (
                  <p className="text-xs text-[var(--text-tertiary)] mt-0.5 truncate">{entry.detail}</p>
                )}
              </div>

              <div className="text-xs text-[var(--text-tertiary)] whitespace-nowrap tabular-nums">
                {entry.duration_ms >= 1000
                  ? `${(entry.duration_ms / 1000).toFixed(1)}s`
                  : `${entry.duration_ms}ms`}
              </div>

              <div className="text-xs text-[var(--text-tertiary)] whitespace-nowrap tabular-nums">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))
        )}
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 text-xs text-amber-500">
          <AlertCircle size={12} />
          <span>{error}</span>
        </div>
      )}
    </motion.div>
  );
}

function RiskBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    low: 'bg-apple-green/10 text-apple-green',
    medium: 'bg-apple-orange/10 text-apple-orange',
    high: 'bg-apple-red/10 text-apple-red',
    critical: 'bg-apple-red/20 text-apple-red font-semibold',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${styles[level] ?? 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'}`}>
      {level}
    </span>
  );
}
