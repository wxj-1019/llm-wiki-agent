import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Activity, CheckCircle, AlertCircle, RefreshCw, Loader2,
  Database, Network, FileText, Clock, HardDrive, XCircle,
} from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { fetchPipelineHealth, type PipelineHealth } from '@/services/dataService';

const CHECK_ICONS: Record<string, React.ElementType> = {
  state_file: Clock,
  fts_index: Database,
  graph: Network,
  wiki_structure: FileText,
};

const CHECK_COLORS: Record<string, string> = {
  state_file: 'text-apple-blue bg-apple-blue/10',
  fts_index: 'text-apple-green bg-apple-green/10',
  graph: 'text-apple-purple bg-apple-purple/10',
  wiki_structure: 'text-apple-orange bg-apple-orange/10',
};

export function PipelineHealthPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('pipeline.title', 'Pipeline Health'));

  const [health, setHealth] = useState<PipelineHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPipelineHealth();
      setHealth(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHealth();
    const interval = setInterval(loadHealth, 30000);
    return () => clearInterval(interval);
  }, [loadHealth]);

  if (loading && !health) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 size={24} className="animate-spin text-[var(--text-tertiary)]" />
        <p className="text-sm text-[var(--text-tertiary)]">{t('pipeline.loading')}</p>
      </div>
    );
  }

  if (error && !health) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <XCircle size={24} className="text-apple-red" />
        <p className="text-sm text-apple-red">{error}</p>
        <button onClick={loadHealth} className="apple-button text-xs">{t('error.retry')}</button>
      </div>
    );
  }

  const checks = health ? Object.entries(health.checks) : [];
  const stats = health ? Object.entries(health.stats) : [];
  const allOk = checks.every(([, v]) => v.ok);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-semibold flex items-center gap-3">
          <Activity size={28} className={allOk ? 'text-apple-green' : 'text-apple-red'} />
          {t('pipeline.title', 'Pipeline Health')}
        </h1>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
            allOk ? 'bg-apple-green/10 text-apple-green' : 'bg-apple-red/10 text-apple-red'
          }`}>
            {allOk ? t('pipeline.status.ok') : t('pipeline.status.degraded')}
          </span>
          <button onClick={loadHealth} className="apple-button-ghost flex items-center gap-2 px-3 py-2 text-sm">
            <RefreshCw size={14} />
            {t('status.refresh')}
          </button>
        </div>
      </div>

      {/* Checks */}
      <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-3 uppercase tracking-wide">
        {t('pipeline.checks')}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {checks.map(([name, check]) => {
          const Icon = CHECK_ICONS[name] || Activity;
          const color = check.ok
            ? (CHECK_COLORS[name] || 'text-apple-green bg-apple-green/10')
            : 'text-apple-red bg-apple-red/10';
          return (
            <motion.div
              key={name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="apple-card p-4 flex items-start gap-4"
            >
              <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center shrink-0`}>
                <Icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-[var(--text-primary)] capitalize">{name.replace('_', ' ')}</span>
                  {check.ok ? (
                    <CheckCircle size={14} className="text-apple-green" />
                  ) : (
                    <AlertCircle size={14} className="text-apple-red" />
                  )}
                </div>
                {'error' in check && check.error ? (
                  <p className="text-xs text-apple-red">{check.error}</p>
                ) : (
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)]">
                    {Object.entries(check)
                      .filter(([k]) => k !== 'ok')
                      .map(([k, v]) => (
                        <span key={k}>
                          <span className="text-[var(--text-tertiary)]">{k}:</span>{' '}
                          <span className="font-medium text-[var(--text-primary)]">{String(v)}</span>
                        </span>
                      ))}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Stats */}
      <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-3 uppercase tracking-wide">
        {t('pipeline.stats')}
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {stats.map(([key, value]) => (
          <div key={key} className="apple-card p-4">
            <p className="text-xs text-[var(--text-tertiary)] mb-1 capitalize">{key.replace(/_/g, ' ')}</p>
            <p className="text-xl font-semibold text-[var(--text-primary)]">{String(value)}</p>
          </div>
        ))}
      </div>

      {checks.length === 0 && (
        <div className="empty-state-warm">
          <HardDrive size={32} className="text-[var(--text-tertiary)]" />
          <p className="text-sm text-[var(--text-secondary)]">{t('pipeline.empty')}</p>
        </div>
      )}
    </motion.div>
  );
}
