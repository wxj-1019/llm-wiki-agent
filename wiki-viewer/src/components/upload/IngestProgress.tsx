import { useState } from 'react';
import { useIngestStore } from '@/stores/ingestStore';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  X,
  ChevronDown,
  ChevronUp,
  Zap,
} from 'lucide-react';

export function IngestProgress() {
  const jobs = useIngestStore((s) => s.jobs);
  const dismissJob = useIngestStore((s) => s.dismissJob);
  const dismissAllCompleted = useIngestStore((s) => s.dismissAllCompleted);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [minimized, setMinimized] = useState(false);

  if (jobs.length === 0) return null;

  // Limit to 8 most recent jobs: running first, then failed, then completed
  const visibleJobs = [...jobs]
    .sort((a, b) => {
      const priority = { running: 0, failed: 1, completed: 2 };
      if (priority[a.status] !== priority[b.status]) return priority[a.status] - priority[b.status];
      return b.updatedAt - a.updatedAt;
    })
    .slice(0, 8);

  const runningCount = jobs.filter((j) => j.status === 'running').length;
  const completedCount = jobs.filter((j) => j.status === 'completed').length;
  const failedCount = jobs.filter((j) => j.status === 'failed').length;

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (minimized) {
    return (
      <motion.button
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={() => setMinimized(false)}
        className="fixed bottom-4 right-4 z-[60] flex items-center gap-2 px-4 py-2.5 apple-card shadow-xl"
      >
        {runningCount > 0 && <Loader2 size={14} className="animate-spin text-apple-blue" />}
        {completedCount > 0 && <CheckCircle2 size={14} className="text-apple-green" />}
        {failedCount > 0 && <XCircle size={14} className="text-red-500" />}
        <span className="text-xs font-medium">
          {runningCount > 0 && `${runningCount} 进行中`}
          {completedCount > 0 && `${completedCount} 完成`}
          {failedCount > 0 && `${failedCount} 失败`}
        </span>
      </motion.button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[60] w-80 max-w-[calc(100vw-2rem)] flex flex-col gap-2">
      {/* Header */}
      <div className="apple-card p-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-apple-blue" />
          <span className="text-xs font-semibold">摄取进度</span>
          {runningCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-apple-blue/10 text-apple-blue font-medium">
              {runningCount} 进行中
            </span>
          )}
          {jobs.length > 8 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] font-medium">
              +{jobs.length - 8} 隐藏
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {(completedCount > 0 || failedCount > 0) && (
            <button
              onClick={dismissAllCompleted}
              className="text-[10px] px-2 py-1 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] transition-colors"
              title="清除已完成"
            >
              清除已完成
            </button>
          )}
          <button
            onClick={() => setMinimized(true)}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] transition-colors"
          >
            <ChevronDown size={14} />
          </button>
        </div>
      </div>

      {/* Job Cards */}
      <AnimatePresence>
        {visibleJobs.map((job) => (
          <motion.div
            key={job.id}
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="apple-card overflow-hidden shadow-lg"
          >
            <div className="p-3">
              <div className="flex items-center gap-2 mb-2">
                {job.status === 'running' && (
                  <Loader2 size={14} className="animate-spin text-apple-blue shrink-0" />
                )}
                {job.status === 'completed' && (
                  <CheckCircle2 size={14} className="text-apple-green shrink-0" />
                )}
                {job.status === 'failed' && (
                  <XCircle size={14} className="text-red-500 shrink-0" />
                )}
                <span className="text-xs font-medium truncate flex-1" title={job.name}>
                  {job.name}
                </span>
                <button
                  onClick={() => dismissJob(job.id)}
                  className="p-1 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] transition-colors shrink-0"
                >
                  <X size={12} />
                </button>
              </div>

              <div className="w-full h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden mb-1.5">
                <motion.div
                  className={`h-full rounded-full ${
                    job.status === 'failed'
                      ? 'bg-red-500'
                      : job.status === 'completed'
                      ? 'bg-apple-green'
                      : 'bg-apple-blue'
                  }`}
                  animate={{ width: `${job.progress}%` }}
                  transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--text-tertiary)] tabular-nums">
                  {job.progress}%
                </span>
                <button
                  onClick={() => toggleExpand(job.id)}
                  className="p-1 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] transition-colors"
                >
                  {expanded.has(job.id) ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {expanded.has(job.id) && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-3 pb-3">
                    <div className="bg-[var(--bg-secondary)] rounded-xl p-2 max-h-48 overflow-y-auto text-[10px] font-mono text-[var(--text-secondary)] space-y-0.5 scrollbar-thin">
                      {job.logs.length === 0 ? (
                        <div className="text-[var(--text-tertiary)] italic">等待日志...</div>
                      ) : (
                        job.logs.map((log, i) => (
                          <div key={i} className="truncate leading-relaxed">
                            {log.startsWith('stderr:') ? (
                              <span className="text-red-400">{log}</span>
                            ) : (
                              log
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
