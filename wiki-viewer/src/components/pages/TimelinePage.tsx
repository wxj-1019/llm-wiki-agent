import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { motion } from 'framer-motion';
import { Calendar, GitCommit, Search, Activity, BarChart3, Layers, Wrench, RefreshCw, Frown } from 'lucide-react';
import { fetchLog, type LogEntry } from '@/services/dataService';
import { TimelineSkeleton } from '@/components/ui/Skeleton';

interface TimelineEvent {
  date: string;
  type: string;
  title: string;
  description: string;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  ingest: GitCommit,
  query: Search,
  health: Activity,
  lint: BarChart3,
  graph: Layers,
  heal: Wrench,
  refresh: RefreshCw,
  report: BarChart3,
};

const TYPE_COLORS: Record<string, string> = {
  ingest: 'bg-apple-blue',
  query: 'bg-apple-green',
  health: 'bg-apple-teal',
  lint: 'bg-apple-orange',
  graph: 'bg-apple-purple',
  heal: 'bg-apple-pink',
  refresh: 'bg-apple-indigo',
  report: 'bg-apple-yellow',
};

function logEntryToEvent(entry: LogEntry): TimelineEvent {
  const typeDesc: Record<string, string> = {
    ingest: t('timeline.type.ingest'),
    query: t('timeline.type.query'),
    health: t('timeline.type.health'),
    lint: t('timeline.type.lint'),
    graph: t('timeline.type.graph'),
    heal: t('timeline.type.heal'),
    refresh: t('timeline.type.refresh'),
    report: t('timeline.type.report'),
  };
  return {
    date: entry.date,
    type: entry.operation,
    title: entry.title,
    description: typeDesc[entry.operation] || 'Wiki operation',
  };
}

export function TimelinePage() {
  const { t } = useTranslation();
  useDocumentTitle(t('nav.timeline') || 'Timeline');

  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { entries } = await fetchLog(200);
      const mapped = entries.map(logEntryToEvent);
      setEvents(mapped);
    } catch (e) {
      setError((e as Error).message);
      // Fallback: try to read log.md directly
      try {
        const res = await fetch('/data/wiki/log.md');
        if (res.ok) {
          const text = await res.text();
          const lines = text.split('\n');
          const parsed: TimelineEvent[] = [];
          const re = /^##\s+\[(\d{4}-\d{2}-\d{2})\]\s+(\w+)\s+\|\s+(.+)$/;
          for (const line of lines) {
            const m = line.match(re);
            if (m) {
              parsed.push(logEntryToEvent({
                date: m[1],
                operation: m[2].toLowerCase(),
                title: m[3].trim(),
              }));
            }
          }
          setEvents(parsed.reverse());
          setError(null);
        }
      } catch {
        // keep original error
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Filter by type
  const [filterTypes, setFilterTypes] = useState<Set<string>>(new Set());
  const allTypes = useMemo(() => {
    const types = new Set<string>();
    events.forEach((e) => types.add(e.type));
    return Array.from(types);
  }, [events]);

  const filteredEvents = useMemo(() => {
    if (filterTypes.size === 0) return events;
    return events.filter((e) => filterTypes.has(e.type));
  }, [events, filterTypes]);

  // Group by month
  const grouped = useMemo(() => {
    const groups: Record<string, TimelineEvent[]> = {};
    for (const e of filteredEvents) {
      const month = e.date.slice(0, 7);
      if (!groups[month]) groups[month] = [];
      groups[month].push(e);
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredEvents]);

  if (loading) {
    return <TimelineSkeleton />;
  }

  if (error && events.length === 0) {
    return (
      <div className="empty-state-warm mt-20">
        <div className="flex justify-center mb-3">
          <Frown size={40} className="text-apple-orange" />
        </div>
        <h3 className="text-lg font-semibold mb-1">{t('timeline.error.title', 'Failed to load timeline')}</h3>
        <p className="text-sm text-[var(--text-secondary)] mb-4">{error}</p>
        <button onClick={loadEvents} className="apple-button text-xs">
          {t('error.retry', 'Retry')}
        </button>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="empty-state-warm mt-20">
        <Calendar size={48} className="text-[var(--text-tertiary)] mb-3" />
        <h3 className="text-lg font-semibold">{t('timeline.empty.title', 'No timeline events yet')}</h3>
        <p className="text-sm text-[var(--text-secondary)] mt-2">
          {t('timeline.empty.description', 'Start ingesting documents to see your knowledge timeline.')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">{t('nav.timeline') || 'Knowledge Timeline'}</h1>
        <button
          onClick={loadEvents}
          className="apple-button-ghost flex items-center gap-2 px-3 py-2 text-sm"
          title={t('timeline.refresh', 'Refresh timeline')}
        >
          <RefreshCw size={14} />
          <span className="hidden sm:inline">{t('timeline.refresh', 'Refresh')}</span>
        </button>
      </div>

      {/* Type filters */}
      {allTypes.length > 1 && (
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <span className="text-xs text-[var(--text-tertiary)]">{t('timeline.filterByType', 'Filter')}:</span>
          {allTypes.map((type) => {
            const active = filterTypes.has(type);
            const color = TYPE_COLORS[type] || 'bg-gray-400';
            return (
              <button
                key={type}
                onClick={() => {
                  setFilterTypes((prev) => {
                    const next = new Set(prev);
                    if (next.has(type)) next.delete(type);
                    else next.add(type);
                    return next;
                  });
                }}
                className={`text-xs px-2 py-1 rounded-full transition-colors ${
                  active ? `${color} text-white` : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                }`}
              >
                {type}
              </button>
            );
          })}
          {filterTypes.size > 0 && (
            <button
              onClick={() => setFilterTypes(new Set())}
              className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] underline"
            >
              {t('timeline.clearFilters', 'Clear')}
            </button>
          )}
        </div>
      )}

      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-0 bottom-0 w-px bg-[var(--border-default)]" />

        {grouped.map(([month, monthEvents]) => (
          <div key={month} className="mb-8">
            <div className="flex items-center gap-3 mb-4 ml-1">
              <div className="w-6 h-6 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-default)] flex items-center justify-center z-10">
                <Calendar size={12} className="text-[var(--text-secondary)]" />
              </div>
              <h2 className="text-lg font-semibold">{month}</h2>
              <span className="text-xs text-[var(--text-tertiary)] ml-1">
                {monthEvents.length} {t('timeline.events', 'events')}
              </span>
            </div>

            <div className="space-y-4 ml-10">
              {monthEvents.map((event, i) => {
                const Icon = TYPE_ICONS[event.type] || GitCommit;
                const color = TYPE_COLORS[event.type] || 'bg-gray-400';
                return (
                  <motion.div
                    key={`${event.date}-${event.type}-${event.title}-${i}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="apple-card p-4 flex items-start gap-3"
                  >
                    <div className={`p-2 rounded-lg ${color} bg-opacity-20`}>
                      <Icon size={14} className="text-[var(--text-secondary)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs text-[var(--text-tertiary)]">{event.date}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full text-white ${color}`}>
                          {event.type}
                        </span>
                      </div>
                      <div className="font-medium text-sm">{event.title}</div>
                      {event.description && (
                        <div className="text-xs text-[var(--text-secondary)] mt-1">{event.description}</div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
