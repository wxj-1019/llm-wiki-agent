import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { GitBranch, Zap, TrendingUp, AlertTriangle, CheckCircle, RefreshCw, Activity, ChevronLeft, ChevronRight } from 'lucide-react';

interface EvolutionEvent {
  date: string;
  step: string;
  title: string;
  details: string[];
  metrics?: { label: string; before?: string; after: string; improvement?: boolean }[];
}

interface EvolutionTimelineProps {
  events?: EvolutionEvent[];
}

const STEP_CONFIG: Record<string, { icon: typeof Activity; color: string }> = {
  health: { icon: CheckCircle, color: 'var(--apple-green)' },
  heal: { icon: Zap, color: 'var(--apple-blue)' },
  lint: { icon: AlertTriangle, color: 'var(--apple-orange)' },
  graph: { icon: TrendingUp, color: 'var(--apple-purple)' },
  refresh: { icon: RefreshCw, color: 'var(--apple-teal)' },
  ingest: { icon: GitBranch, color: 'var(--apple-indigo)' },
  optimize: { icon: Activity, color: 'var(--marshmallow-lavender)' },
  learn: { icon: Zap, color: 'var(--marshmallow-mint)' },
};

function groupByDate(events: EvolutionEvent[]): Map<string, EvolutionEvent[]> {
  const map = new Map<string, EvolutionEvent[]>();
  for (const ev of events) {
    const existing = map.get(ev.date) || [];
    existing.push(ev);
    map.set(ev.date, existing);
  }
  return map;
}

function formatDateLabel(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function EvolutionTimeline({ events: propEvents }: EvolutionTimelineProps) {
  const [rawEvents, setRawEvents] = useState<EvolutionEvent[]>(propEvents ?? []);
  const [loading, setLoading] = useState(!propEvents);
  const [selectedStep, setSelectedStep] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    if (propEvents) {
      setRawEvents(propEvents);
      return;
    }

    let cancelled = false;
    async function fetchHistory() {
      setLoading(true);
      try {
        const res = await fetch('/api/jarvis/optimize-history');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const items: EvolutionEvent[] = (Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [])
          .map((e: { timestamp?: string; step?: string; status?: string; details?: Record<string, unknown> }) => ({
            date: (e.timestamp || '').slice(0, 10),
            step: e.step || 'unknown',
            title: `${e.step || 'unknown'} ${e.status || ''}`.trim(),
            details: Object.entries(e.details || {}).map(([k, v]) => `${k}: ${v}`),
          }));
        if (!cancelled) setRawEvents(items);
      } catch {
        // Silent fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchHistory();
    return () => { cancelled = true; };
  }, [propEvents]);

  const filtered = selectedStep ? rawEvents.filter((e) => e.step === selectedStep) : rawEvents;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const grouped = useMemo(() => groupByDate(paged), [paged]);

  const availableSteps = [...new Set(rawEvents.map((e) => e.step))];

  return (
    <div className="space-y-2">
      {/* Filter chips */}
      {availableSteps.length > 1 && (
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => { setSelectedStep(null); setPage(0); }}
            className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
              selectedStep === null
                ? 'bg-apple-teal/15 text-apple-teal border border-apple-teal/30'
                : 'bg-[var(--bg-secondary)] text-[var(--text-tertiary)] border border-transparent hover:border-[var(--border-default)]'
            }`}
          >
            All
          </button>
          {availableSteps.map((step) => {
            const cfg = STEP_CONFIG[step] || { icon: Activity, color: 'var(--text-tertiary)' };
            const Icon = cfg.icon;
            return (
              <button
                key={step}
                onClick={() => { setSelectedStep(selectedStep === step ? null : step); setPage(0); }}
                className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                  selectedStep === step
                    ? 'border'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-tertiary)] border border-transparent hover:border-[var(--border-default)]'
                }`}
                style={selectedStep === step ? {
                  backgroundColor: `color-mix(in srgb, ${cfg.color} 12%, transparent)`,
                  color: cfg.color,
                  borderColor: `color-mix(in srgb, ${cfg.color} 30%, transparent)`,
                } : undefined}
              >
                <Icon size={9} />
                {step}
              </button>
            );
          })}
        </div>
      )}

      {/* Timeline */}
      {loading ? (
        <div className="text-center py-4 text-xs text-[var(--text-tertiary)]">Loading evolution timeline...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-4">
          <GitBranch size={20} className="mx-auto mb-1 text-[var(--text-tertiary)] opacity-30" />
          <p className="text-xs text-[var(--text-tertiary)] italic">No evolution events yet</p>
          <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">Events will appear as the agent learns and optimizes</p>
        </div>
      ) : (
        <div className="space-y-2">
          {[...grouped.entries()].map(([date, events]) => (
            <div key={date}>
              {/* Date header */}
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-semibold tracking-wider uppercase font-mono-data" style={{ color: 'var(--text-tertiary)' }}>
                  {formatDateLabel(date)}
                </span>
                <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-default)' }} />
              </div>

              {/* Events for this date */}
              <div className="space-y-1 ml-3 pl-4 relative" style={{ borderLeft: '2px solid var(--border-default)' }}>
                {events.map((ev, i) => {
                  const cfg = STEP_CONFIG[ev.step] || { icon: Activity, color: 'var(--text-tertiary)' };
                  const Icon = cfg.icon;

                  return (
                    <motion.div
                      key={`${ev.date}-${ev.step}-${i}`}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.25 }}
                      className="relative"
                    >
                      {/* Timeline dot */}
                      <div
                        className="absolute -left-[calc(1rem+7px)] top-2 w-3 h-3 rounded-full"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${cfg.color} 20%, transparent)`,
                          border: `2px solid ${cfg.color}`,
                          boxShadow: `0 0 6px color-mix(in srgb, ${cfg.color} 30%, transparent)`,
                        }}
                      />

                      <div
                        className="rounded-lg p-2 transition-colors hover:bg-[var(--bg-secondary)]"
                        style={{ border: '1px solid var(--border-default)' }}
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <Icon size={13} style={{ color: cfg.color }} />
                          <span className="text-xs font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>
                            {ev.step}
                          </span>
                          {ev.title && ev.title !== ev.step && (
                            <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                              — {ev.title}
                            </span>
                          )}
                        </div>

                        {ev.details.length > 0 && (
                          <ul className="space-y-0.5 mt-1">
                            {ev.details.map((d, j) => (
                              <li key={j} className="text-[10px] font-mono-data" style={{ color: 'var(--text-secondary)' }}>
                                {d}
                              </li>
                            ))}
                          </ul>
                        )}

                        {ev.metrics && ev.metrics.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {ev.metrics.map((m, j) => (
                              <div
                                key={j}
                                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-mono-data"
                                style={{
                                  backgroundColor: m.improvement ? 'rgba(48,209,88,0.08)' : 'var(--bg-secondary)',
                                  color: m.improvement ? 'var(--apple-green)' : 'var(--text-tertiary)',
                                }}
                              >
                                <span className="opacity-60">{m.label}:</span>
                                {m.before && <span className="line-through opacity-50">{m.before}</span>}
                                {m.before && <span>→</span>}
                                <span className="font-semibold">{m.after}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="p-1 rounded transition-colors hover:bg-[var(--bg-secondary)] disabled:opacity-30"
          >
            <ChevronLeft size={14} className="text-[var(--text-tertiary)]" />
          </button>
          <span className="text-[10px] font-mono-data text-[var(--text-tertiary)]">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="p-1 rounded transition-colors hover:bg-[var(--bg-secondary)] disabled:opacity-30"
          >
            <ChevronRight size={14} className="text-[var(--text-tertiary)]" />
          </button>
        </div>
      )}
    </div>
  );
}
