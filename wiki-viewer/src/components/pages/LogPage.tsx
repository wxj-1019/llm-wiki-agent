import { useEffect, useState, useMemo, useRef } from 'react';
import { ScrollText, Search, Wrench, Activity, Loader2, Copy, Check, ExternalLink, Frown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getPagePath } from '@/lib/wikilink';
import { useWikiStore } from '@/stores/wikiStore';

interface LogEntry {
  date: string;
  operation: string;
  title: string;
}

const opIcons: Record<string, React.ElementType> = {
  ingest: ScrollText,
  query: Search,
  lint: Wrench,
  health: Activity,
  graph: Activity,
  heal: Activity,
  report: ScrollText,
};

const opColors: Record<string, string> = {
  ingest: 'bg-apple-blue/10 text-apple-blue',
  query: 'bg-apple-purple/10 text-apple-purple',
  lint: 'bg-apple-orange/10 text-apple-orange',
  health: 'bg-apple-green/10 text-apple-green',
  graph: 'bg-apple-teal/10 text-apple-teal',
  heal: 'bg-apple-pink/10 text-apple-pink',
  report: 'bg-apple-yellow/10 text-apple-yellow',
};

export function LogPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useDocumentTitle(t('log.title'));
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const graphData = useWikiStore((s) => s.graphData);
  const nodes = graphData?.nodes || [];

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    entries.forEach((e) => {
      counts[e.operation] = (counts[e.operation] || 0) + 1;
    });
    return counts;
  }, [entries]);

  useEffect(() => {
    const fetchLog = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/log');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.markdown) {
          setEntries(parseLog(data.markdown));
        } else {
          setEntries([]);
        }
      } catch {
        try {
          const res = await fetch('/data/wiki/log.md');
          if (res.ok) {
            const text = await res.text();
            setEntries(parseLog(text));
          } else {
            setEntries([]);
          }
        } catch {
          setError(t('log.error.description'));
          setEntries([]);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchLog();
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-semibold mb-6">{t('log.title')}</h1>

      {!loading && !error && entries.length > 0 && (
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {Object.entries(stats).map(([op, count]) => (
            <span key={op} className={`text-xs font-medium px-2 py-1 rounded-full ${opColors[op] || 'bg-gray-100 text-gray-600'}`}>
              {t(`log.op.${op}` as string)}: {count}
            </span>
          ))}
          <span className="text-xs text-[var(--text-tertiary)] ml-auto">
            {t('log.stats.total', { count: entries.length })}
          </span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 size={32} className="text-apple-blue animate-spin mb-4" />
          <p className="text-sm text-[var(--text-secondary)]">{t('log.loading')}</p>
        </div>
      ) : error ? (
        <div className="empty-state-warm">
          <div className="flex justify-center mb-3">
            <Frown size={40} className="text-apple-orange" />
          </div>
          <h3 className="text-lg font-semibold mb-1">{t('log.error.title')}</h3>
          <p className="text-sm text-[var(--text-secondary)]">{error}</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="empty-state-warm">
          <div className="flex justify-center mb-3">
            <ScrollText size={40} className="text-apple-blue" />
          </div>
          <h3 className="text-lg font-semibold mb-1">{t('log.empty.title')}</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-4">{t('log.empty.description')}</p>
          <div className="bg-[var(--bg-secondary)] p-4 inline-block rounded-xl">
            <p className="text-xs text-[var(--text-tertiary)] mb-2">{t('log.empty.cta')}</p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <code className="text-sm font-mono text-apple-blue bg-[var(--bg-primary)] px-3 py-1.5 rounded-lg">
                python tools/ingest.py raw/your-document.md
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText('python tools/ingest.py raw/your-document.md');
                  setCopied(true);
                  if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
                  copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-[var(--bg-primary)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors border border-[var(--border-default)] rounded-xl"
              >
                {copied ? <Check size={12} className="text-apple-blue" /> : <Copy size={12} />}
                {copied ? t('log.empty.copied') : t('log.empty.copy')}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, i) => {
            const Icon = opIcons[entry.operation] || ScrollText;
            const linkedNode = nodes.find((n) =>
              entry.title.toLowerCase().includes(n.label.toLowerCase()) ||
              n.label.toLowerCase().includes(entry.title.toLowerCase())
            );
            const handleClick = () => {
              if (!linkedNode) return;
              navigate(getPagePath(linkedNode));
            };

            return (
              <motion.div
                key={`${entry.date}-${entry.operation}-${i}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.03 }}
                className={`apple-card p-4 flex items-center gap-4 cursor-pointer transition-colors ${linkedNode ? 'hover:bg-[var(--bg-secondary)]' : ''}`}
                onClick={handleClick}
              >
                <div className={`p-2 rounded-lg ${opColors[entry.operation] || 'bg-gray-100 text-gray-600'}`}>
                  <Icon size={16} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{entry.title}</span>
                    <span className="text-xs text-[var(--text-tertiary)] capitalize px-2 py-0.5 bg-[var(--bg-secondary)] rounded-full">
                      {t(`log.op.${entry.operation}` as string)}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] mt-0.5 flex items-center gap-1">
                    {entry.date}
                    {linkedNode && <ExternalLink size={10} className="text-apple-blue" />}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function parseLog(text: string): LogEntry[] {
  const lines = text.split('\n');
  const entries: LogEntry[] = [];
  for (const line of lines) {
    const match = line.match(/^##\s+\[(\d{4}-\d{2}-\d{2})\]\s+(\w+)\s+\|\s+(.+)$/);
    if (match) {
      entries.push({
        date: match[1],
        operation: match[2].toLowerCase(),
        title: match[3],
      });
    }
  }
  // Return newest entries first (log.md is append-only with newest at bottom)
  return entries.reverse();
}
