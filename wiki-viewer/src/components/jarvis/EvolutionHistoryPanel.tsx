import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, ChevronDown, ChevronRight, RefreshCw, AlertTriangle, CheckCircle, Zap, TrendingUp } from 'lucide-react';

interface EvolutionEntry {
  timestamp: string;
  step: string;
  status: string;
  details: Record<string, unknown>;
}

interface EvolutionHistoryPanelProps {
  entries?: EvolutionEntry[];
  maxEntries?: number;
}

const STEP_ICON: Record<string, typeof Activity> = {
  health: CheckCircle,
  heal: Zap,
  lint: AlertTriangle,
  graph: TrendingUp,
  refresh: RefreshCw,
};

const STEP_COLOR: Record<string, string> = {
  health: 'var(--apple-green)',
  heal: 'var(--apple-blue)',
  lint: 'var(--apple-orange)',
  graph: 'var(--apple-purple)',
  refresh: 'var(--apple-teal)',
};

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

function DetailBadges({ details }: { details: Record<string, unknown> }) {
  const badges: { label: string; value: string; color: string }[] = [];

  if (details.auto_healed != null) badges.push({ label: 'Auto-healed', value: String(details.auto_healed), color: 'var(--apple-blue)' });
  if (details.total_orphans != null) badges.push({ label: 'Orphans', value: String(details.total_orphans), color: 'var(--apple-orange)' });
  if (details.orphan_pages_created != null) badges.push({ label: 'Created', value: String(details.orphan_pages_created), color: 'var(--apple-green)' });
  if (details.total_communities != null) badges.push({ label: 'Communities', value: String(details.total_communities), color: 'var(--apple-purple)' });
  if (details.stale_count != null) badges.push({ label: 'Stale', value: String(details.stale_count), color: 'var(--apple-orange)' });
  if (details.refreshed != null) badges.push({ label: 'Refreshed', value: String(details.refreshed), color: 'var(--apple-teal)' });
  if (details.empty_count != null) badges.push({ label: 'Empty', value: String(details.empty_count), color: 'var(--apple-red)' });
  if (details.missing_from_index != null) badges.push({ label: 'Missing idx', value: String(details.missing_from_index), color: 'var(--apple-red)' });

  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {badges.map((b, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-mono-data"
          style={{
            backgroundColor: `color-mix(in srgb, ${b.color} 10%, transparent)`,
            color: b.color,
          }}
        >
          <span className="opacity-60">{b.label}:</span> {b.value}
        </span>
      ))}
    </div>
  );
}

export function EvolutionHistoryPanel({ entries: propEntries, maxEntries = 50 }: EvolutionHistoryPanelProps) {
  const [entries, setEntries] = useState<EvolutionEntry[]>(propEntries ?? []);
  const [loading, setLoading] = useState(!propEntries);
  const [expanded, setExpanded] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);

  useEffect(() => {
    if (propEntries) {
      setEntries(propEntries);
      return;
    }

    let cancelled = false;
    async function fetchHistory() {
      setLoading(true);
      try {
        const res = await fetch('/api/jarvis/optimize-history');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
          setEntries(items.slice(0, maxEntries));
        }
      } catch {
        // Silent fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchHistory();
    return () => { cancelled = true; };
  }, [propEntries, maxEntries]);

  const filtered = filter ? entries.filter((e) => e.step === filter) : entries;
  const stepCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.step] = (acc[e.step] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="apple-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-[var(--bg-secondary)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Activity size={15} className="text-apple-teal" style={{ filter: 'drop-shadow(0 0 4px rgba(100,210,255,0.4))' }} />
          <span className="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-tertiary)]">Evolution History</span>
          <span className="text-[10px] font-mono-data px-1.5 py-0.5 rounded-full bg-apple-teal/10 text-apple-teal">
            {entries.length}
          </span>
        </div>
        {expanded ? <ChevronDown size={14} className="text-[var(--text-tertiary)]" /> : <ChevronRight size={14} className="text-[var(--text-tertiary)]" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            {/* Filter chips */}
            {Object.keys(stepCounts).length > 0 && (
              <div className="flex flex-wrap gap-1 px-3 pb-1">
                <button
                  onClick={() => setFilter(null)}
                  className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                    filter === null
                      ? 'bg-apple-teal/15 text-apple-teal border border-apple-teal/30'
                      : 'bg-[var(--bg-secondary)] text-[var(--text-tertiary)] border border-transparent hover:border-[var(--border-default)]'
                  }`}
                >
                  All ({entries.length})
                </button>
                {Object.entries(stepCounts).map(([step, count]) => {
                  const Icon = STEP_ICON[step] || Activity;
                  const color = STEP_COLOR[step] || 'var(--text-tertiary)';
                  return (
                    <button
                      key={step}
                      onClick={() => setFilter(filter === step ? null : step)}
                      className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                        filter === step
                          ? 'border'
                          : 'bg-[var(--bg-secondary)] text-[var(--text-tertiary)] border border-transparent hover:border-[var(--border-default)]'
                      }`}
                      style={filter === step ? {
                        backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
                        color,
                        borderColor: `color-mix(in srgb, ${color} 30%, transparent)`,
                      } : undefined}
                    >
                      <Icon size={9} />
                      {step} ({count})
                    </button>
                  );
                })}
              </div>
            )}

            {/* Timeline */}
            <div className="px-3 pb-2 space-y-0 max-h-40 overflow-hidden">
              {loading ? (
                <div className="text-center py-6 text-xs text-[var(--text-tertiary)]">Loading history...</div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-6 text-xs text-[var(--text-tertiary)] italic">No evolution events yet</div>
              ) : (
                filtered.map((entry, i) => {
                  const Icon = STEP_ICON[entry.step] || Activity;
                  const color = STEP_COLOR[entry.step] || 'var(--text-tertiary)';
                  const isOk = entry.status === 'ok';
                  const isError = entry.status === 'error';

                  return (
                    <motion.div
                      key={`${entry.timestamp}-${i}`}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03, duration: 0.2 }}
                      className="flex gap-3 group"
                    >
                      {/* Timeline column */}
                      <div className="flex flex-col items-center shrink-0">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
                          style={{
                            backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
                            border: `1.5px solid ${isOk ? color : isError ? 'var(--apple-red)' : 'var(--border-default)'}`,
                          }}
                        >
                          <Icon size={11} style={{ color: isError ? 'var(--apple-red)' : color }} />
                        </div>
                        {i < filtered.length - 1 && (
                          <div className="w-px flex-1 min-h-[12px]" style={{ backgroundColor: 'var(--border-default)' }} />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>
                            {entry.step}
                          </span>
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full font-mono-data"
                            style={{
                              backgroundColor: isError ? 'rgba(255,69,58,0.1)' : isOk ? 'rgba(48,209,88,0.1)' : 'var(--bg-secondary)',
                              color: isError ? 'var(--apple-red)' : isOk ? 'var(--apple-green)' : 'var(--text-tertiary)',
                            }}
                          >
                            {entry.status}
                          </span>
                          <span className="text-[10px] text-[var(--text-tertiary)] ml-auto font-mono-data">
                            {formatTimestamp(entry.timestamp)}
                          </span>
                        </div>
                        <DetailBadges details={entry.details} />
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
