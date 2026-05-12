import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ListTodo, Loader2, RefreshCw, Clock, CheckCircle, XCircle, AlertCircle,
  ChevronDown, ChevronUp, Terminal, PlayCircle,
} from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { fetchIngestJobs, fetchIngestJob, type IngestJob } from '@/services/dataService';

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  pending: { icon: Clock, color: 'text-apple-orange bg-apple-orange/10', label: 'Pending' },
  running: { icon: Loader2, color: 'text-apple-blue bg-apple-blue/10', label: 'Running' },
  completed: { icon: CheckCircle, color: 'text-apple-green bg-apple-green/10', label: 'Completed' },
  failed: { icon: XCircle, color: 'text-apple-red bg-apple-red/10', label: 'Failed' },
};

export function IngestJobsPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('jobs.title', 'Ingest Jobs'));

  const [jobs, setJobs] = useState<IngestJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<IngestJob | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchIngestJobs();
      setJobs(data.jobs.sort((a, b) => b.updated_at - a.updated_at));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 5000);
    return () => clearInterval(interval);
  }, [loadJobs]);

  const toggleExpand = useCallback(async (job: IngestJob) => {
    if (expandedId === job.id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(job.id);
    setDetailLoading(true);
    try {
      const d = await fetchIngestJob(job.id);
      setDetail(d);
    } catch {
      setDetail(job);
    } finally {
      setDetailLoading(false);
    }
  }, [expandedId]);

  if (loading && jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 size={24} className="animate-spin text-[var(--text-tertiary)]" />
        <p className="text-sm text-[var(--text-tertiary)]">{t('jobs.loading')}</p>
      </div>
    );
  }

  if (error && jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <AlertCircle size={24} className="text-apple-red" />
        <p className="text-sm text-apple-red">{error}</p>
        <button onClick={loadJobs} className="apple-button text-xs">{t('error.retry')}</button>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-semibold flex items-center gap-3">
          <ListTodo size={28} className="text-apple-blue" />
          {t('jobs.title', 'Ingest Jobs')}
        </h1>
        <button onClick={loadJobs} className="apple-button-ghost flex items-center gap-2 px-3 py-2 text-sm">
          <RefreshCw size={14} />
          {t('status.refresh')}
        </button>
      </div>

      {jobs.length === 0 ? (
        <div className="empty-state-warm">
          <PlayCircle size={32} className="text-[var(--text-tertiary)]" />
          <p className="text-sm text-[var(--text-secondary)]">{t('jobs.empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const cfg = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending;
            const StatusIcon = cfg.icon;
            const isExpanded = expandedId === job.id;
            const duration = job.updated_at && job.created_at
              ? formatDuration((job.updated_at - job.created_at) * 1000)
              : null;

            return (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="apple-card overflow-hidden"
              >
                <button
                  onClick={() => toggleExpand(job)}
                  className="w-full flex items-center gap-4 p-4 text-left"
                >
                  <div className={`w-9 h-9 rounded-lg ${cfg.color} flex items-center justify-center shrink-0`}>
                    <StatusIcon size={16} className={job.status === 'running' ? 'animate-spin' : ''} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--text-primary)] text-sm truncate">
                        {job.path || job.id}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-[var(--text-tertiary)] mt-0.5">
                      <span>{formatTime(job.created_at)}</span>
                      {duration && <span>· {duration}</span>}
                      {typeof job.returncode === 'number' && <span>· exit {job.returncode}</span>}
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp size={16} className="text-[var(--text-tertiary)]" /> : <ChevronDown size={16} className="text-[var(--text-tertiary)]" />}
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 border-t border-[var(--border-default)] pt-3">
                        {detailLoading ? (
                          <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                            <Loader2 size={12} className="animate-spin" />
                            {t('jobs.loadingDetail')}
                          </div>
                        ) : (
                          <>
                            {detail?.stdout && (
                              <div className="mb-2">
                                <div className="flex items-center gap-1.5 text-xs text-apple-green mb-1">
                                  <Terminal size={12} />
                                  <span className="font-medium">stdout</span>
                                </div>
                                <pre className="bg-[var(--bg-secondary)] rounded-lg p-3 text-[11px] font-mono text-[var(--text-secondary)] whitespace-pre-wrap break-all max-h-48 overflow-auto">
                                  {detail.stdout}
                                </pre>
                              </div>
                            )}
                            {detail?.stderr && (
                              <div>
                                <div className="flex items-center gap-1.5 text-xs text-apple-red mb-1">
                                  <Terminal size={12} />
                                  <span className="font-medium">stderr</span>
                                </div>
                                <pre className="bg-[var(--bg-secondary)] rounded-lg p-3 text-[11px] font-mono text-apple-red/80 whitespace-pre-wrap break-all max-h-48 overflow-auto">
                                  {detail.stderr}
                                </pre>
                              </div>
                            )}
                            {!detail?.stdout && !detail?.stderr && (
                              <p className="text-xs text-[var(--text-tertiary)]">{t('jobs.noLogs')}</p>
                            )}
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
