import { useEffect, useState } from 'react';
import { ScrollText, Search, Wrench, Activity } from 'lucide-react';
import { motion } from 'framer-motion';

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
};

const opColors: Record<string, string> = {
  ingest: 'bg-apple-blue/10 text-apple-blue',
  query: 'bg-apple-purple/10 text-apple-purple',
  lint: 'bg-apple-orange/10 text-apple-orange',
  health: 'bg-apple-green/10 text-apple-green',
  graph: 'bg-apple-teal/10 text-apple-teal',
};

export function LogPage() {
  const [entries, setEntries] = useState<LogEntry[]>([]);

  useEffect(() => {
    fetch('/data/wiki/log.md')
      .then((r) => r.text())
      .then((text) => {
        const parsed = parseLog(text);
        setEntries(parsed);
      })
      .catch(() => setEntries([]));
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-semibold mb-6">Operation Log</h1>

      {entries.length === 0 ? (
        <div className="empty-state-warm">
          <div className="text-4xl mb-3">📋</div>
          <h3 className="font-rounded text-lg font-semibold mb-1">No logs yet</h3>
          <p className="text-sm text-[var(--text-secondary)]">Operations will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, i) => {
            const Icon = opIcons[entry.operation] || ScrollText;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="apple-card p-4 flex items-center gap-4"
              >
                <div className={`p-2 rounded-lg ${opColors[entry.operation] || 'bg-gray-100 text-gray-600'}`}>
                  <Icon size={16} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{entry.title}</span>
                    <span className="text-xs text-[var(--text-tertiary)] capitalize px-2 py-0.5 rounded-full bg-[var(--bg-secondary)]">
                      {entry.operation}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] mt-0.5">{entry.date}</div>
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
    const match = line.match(/^##\s*\[?([^\]]+)\]?\s+(\w+)\s+\|\s+(.+)$/);
    if (match) {
      entries.push({ date: match[1], operation: match[2].toLowerCase(), title: match[3] });
    }
  }
  return entries;
}
