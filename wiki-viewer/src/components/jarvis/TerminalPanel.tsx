import { useEffect, useRef, useState } from 'react';
import { Terminal, Minimize2, Maximize2 } from 'lucide-react';

interface AgentEvent {
  id: string;
  timestamp: string;
  name: string;
  category: string;
  detail: string;
  source?: string;
}

const TAG_MAP: Record<string, string> = {
  tool: 'TOOL',
  system: 'SYS',
  learning: 'SYS',
  goal: 'AGT',
  error: 'ERR',
  approval: 'APR',
};

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return '--:--:--';
  }
}

function tagColor(tag: string): string {
  switch (tag) {
    case 'SYS':  return 'text-[var(--apple-teal)]';
    case 'AGT':  return 'text-[var(--apple-purple)]';
    case 'ERR':  return 'text-apple-red';
    case 'TOOL': return 'text-apple-green';
    case 'APR':  return 'text-apple-orange';
    default:     return 'text-[var(--text-tertiary)]';
  }
}

export function TerminalPanel({ events }: { events: AgentEvent[] }) {
  const [expanded, setExpanded] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events, autoScroll]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(nearBottom);
  };

  return (
    <div className={`apple-card transition-all duration-300 ${expanded ? 'h-80' : 'h-48'}`}>
      {/* header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-default)]">
        <div className="flex items-center gap-2">
          <Terminal size={13} className="text-[var(--apple-teal)]" />
          <span className="text-[11px] font-mono-data font-semibold tracking-widest uppercase text-[var(--text-tertiary)]">
            Event Stream
          </span>
          <span className="text-[10px] font-mono-data text-[var(--text-tertiary)] ml-1">
            {events.length} events
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setAutoScroll((s) => !s)}
            className={`text-[10px] font-mono-data px-2 py-0.5 rounded border transition-colors ${
              autoScroll
                ? 'border-apple-green/30 text-apple-green'
                : 'border-[var(--border-default)] text-[var(--text-tertiary)]'
            }`}
          >
            {autoScroll ? 'AUTO-SCROLL: ON' : 'AUTO-SCROLL: OFF'}
          </button>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] transition-colors"
          >
            {expanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        </div>
      </div>

      {/* log body */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="overflow-y-auto font-mono-data text-xs px-1 py-1 space-y-0"
        style={{ height: expanded ? 'calc(100% - 40px)' : 'calc(100% - 40px)' }}
      >
        {events.length === 0 ? (
          <div className="text-[var(--text-tertiary)] italic px-3 py-4 text-center">
            {'>'} awaiting telemetry...
          </div>
        ) : (
          events.map((ev) => {
            const tag = TAG_MAP[ev.category?.toLowerCase()] || 'SYS';
            return (
              <div
                key={ev.id}
                className="terminal-row flex items-start gap-2 rounded"
                data-tag={tag}
              >
                <span className="shrink-0 text-[10px] text-[var(--text-tertiary)] tabular-nums w-[60px]">
                  {formatTime(ev.timestamp)}
                </span>
                <span className={`shrink-0 text-[10px] font-bold w-[32px] ${tagColor(tag)}`}>
                  [{tag}]
                </span>
                <span className="text-[var(--text-secondary)] truncate">
                  {ev.name}
                </span>
                {ev.detail && (
                  <span className="text-[var(--text-tertiary)] truncate ml-auto text-[11px]">
                    — {ev.detail}
                  </span>
                )}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
