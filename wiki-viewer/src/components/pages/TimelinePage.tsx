import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useWikiStore } from '@/stores/wikiStore';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { motion } from 'framer-motion';
import { Calendar, GitCommit, Search, Activity, BarChart3, Layers } from 'lucide-react';

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
};

const TYPE_COLORS: Record<string, string> = {
  ingest: 'bg-apple-blue',
  query: 'bg-apple-green',
  health: 'bg-apple-teal',
  lint: 'bg-apple-orange',
  graph: 'bg-apple-purple',
};

function parseLogEvents(logContent: string): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const lines = logContent.split('\n');
  let currentDate = '';

  for (const line of lines) {
    const dateMatch = line.match(/^##\s*\[(\d{4}-\d{2}-\d{2})\]\s*(\w+)\s*\|\s*(.+)$/);
    if (dateMatch) {
      currentDate = dateMatch[1];
      const type = dateMatch[2].toLowerCase();
      const title = dateMatch[3].trim();
      events.push({
        date: currentDate,
        type,
        title,
        description: '',
      });
    }
  }

  return events.reverse().slice(0, 100);
}

export function TimelinePage() {
  const { t } = useTranslation();
  useDocumentTitle(t('nav.timeline') || 'Timeline');
  const graphData = useWikiStore((s) => s.graphData);

  const now = useMemo(() => Date.now(), []);

  const events = useMemo(() => {
    // In a real implementation, we'd fetch log.md content
    // For now, generate synthetic events from graph data
    const nodes = graphData?.nodes || [];
    const synthetic: TimelineEvent[] = nodes
      .filter((n) => n.type === 'source')
      .slice(0, 20)
      .map((n, i) => ({
        date: new Date(now - i * 86400000 * 3).toISOString().slice(0, 10),
        type: 'ingest',
        title: n.label,
        description: `Ingested ${n.type} page`,
      }));
    return synthetic;
  }, [graphData, now]);

  // Group by month
  const grouped = useMemo(() => {
    const groups: Record<string, TimelineEvent[]> = {};
    for (const e of events) {
      const month = e.date.slice(0, 7);
      if (!groups[month]) groups[month] = [];
      groups[month].push(e);
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [events]);

  if (events.length === 0) {
    return (
      <div className="empty-state-warm mt-20">
        <Calendar size={48} className="text-[var(--text-tertiary)] mb-3" />
        <h3 className="text-lg font-semibold">No timeline events yet</h3>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-semibold">{t('nav.timeline') || 'Knowledge Timeline'}</h1>

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
            </div>

            <div className="space-y-4 ml-10">
              {monthEvents.map((event, i) => {
                const Icon = TYPE_ICONS[event.type] || GitCommit;
                const color = TYPE_COLORS[event.type] || 'bg-gray-400';
                return (
                  <motion.div
                    key={`${event.date}-${i}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="apple-card p-4 flex items-start gap-3"
                  >
                    <div className={`p-2 rounded-lg ${color} bg-opacity-20 text-[var(--text-primary)]`}>
                      <Icon size={14} className="text-[var(--text-secondary)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
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
