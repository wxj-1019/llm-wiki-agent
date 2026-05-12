import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Grid3X3, BarChart3, Clock, Zap } from 'lucide-react';

interface ToolStat {
  name: string;
  call_count: number;
  success_count: number;
  fail_count: number;
  avg_duration_ms: number;
  category?: string;
}

const HEAT_LEVELS = [
  { min: 0, max: 0, bg: 'var(--bg-secondary)', text: 'var(--text-tertiary)', label: 'Unused' },
  { min: 1, max: 3, bg: 'rgba(100,210,255,0.08)', text: 'var(--text-tertiary)', label: 'Low' },
  { min: 4, max: 10, bg: 'rgba(100,210,255,0.15)', text: 'var(--apple-teal)', label: 'Medium' },
  { min: 11, max: 25, bg: 'rgba(100,210,255,0.25)', text: 'var(--apple-teal)', label: 'High' },
  { min: 26, max: 999, bg: 'rgba(255,159,10,0.2)', text: 'var(--apple-orange)', label: 'Hot' },
];

function getHeatLevel(count: number) {
  return HEAT_LEVELS.find((l) => count >= l.min && count <= l.max) ?? HEAT_LEVELS[0];
}

function formatDuration(ms: number): string {
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function ToolHeatmap() {
  const [tools, setTools] = useState<ToolStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'usage' | 'success' | 'duration'>('usage');
  const [hoveredTool, setHoveredTool] = useState<string | null>(null);

  const fetchTools = useCallback(async () => {
    try {
      const res = await fetch('/api/jarvis/tools');
      if (!res.ok) return;
      const json = await res.json();
      const raw = json?.data?.tools ?? json?.tools ?? [];
      setTools(Array.isArray(raw) ? raw : []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTools();
    const interval = setInterval(fetchTools, 15000);
    return () => clearInterval(interval);
  }, [fetchTools]);

  const sortedTools = useMemo(() => {
    const copy = [...tools];
    switch (sortBy) {
      case 'usage': return copy.sort((a, b) => b.call_count - a.call_count);
      case 'success': return copy.sort((a, b) => {
        const rateA = a.call_count > 0 ? a.success_count / a.call_count : 0;
        const rateB = b.call_count > 0 ? b.success_count / b.call_count : 0;
        return rateB - rateA;
      });
      case 'duration': return copy.sort((a, b) => a.avg_duration_ms - b.avg_duration_ms);
      default: return copy;
    }
  }, [tools, sortBy]);

  if (loading) {
    return (
      <div className="glass p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Grid3X3 size={14} className="animate-pulse" style={{ color: 'var(--apple-teal)' }} />
          <span className="text-xs font-mono-data" style={{ color: 'var(--text-tertiary)' }}>
            LOADING HEATMAP...
          </span>
        </div>
      </div>
    );
  }

  const totalCalls = tools.reduce((a, t) => a + t.call_count, 0);
  const activeTools = tools.filter((t) => t.call_count > 0).length;

  return (
    <div className="glass p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Grid3X3 size={14} style={{ color: 'var(--apple-teal)' }} />
          <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
            Tool Usage Heatmap
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono-data" style={{ color: 'var(--text-tertiary)' }}>
          <span>{activeTools}/{tools.length} active</span>
          <span>{totalCalls} total calls</span>
        </div>
      </div>

      {/* Sort controls */}
      <div className="flex items-center gap-1">
        {[
          { key: 'usage' as const, icon: BarChart3, label: 'Usage' },
          { key: 'success' as const, icon: Zap, label: 'Success' },
          { key: 'duration' as const, icon: Clock, label: 'Speed' },
        ].map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setSortBy(key)}
            className={`flex items-center gap-1 text-[9px] font-mono-data px-2 py-1 rounded transition-colors ${
              sortBy === key ? 'text-[var(--apple-teal)] bg-[var(--bg-tertiary)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}
          >
            <Icon size={9} />
            {label}
          </button>
        ))}
      </div>

      {/* Heatmap Grid */}
      <div className="grid grid-cols-4 gap-1.5">
        {sortedTools.map((tool, i) => {
          const heat = getHeatLevel(tool.call_count);
          const successRate = tool.call_count > 0 ? tool.success_count / tool.call_count : 0;
          const isHovered = hoveredTool === tool.name;

          return (
            <motion.div
              key={tool.name}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.02 }}
              className="relative rounded-lg p-2 cursor-default transition-all"
              style={{
                backgroundColor: heat.bg,
                border: isHovered ? `1px solid ${heat.text}` : '1px solid transparent',
              }}
              onMouseEnter={() => setHoveredTool(tool.name)}
              onMouseLeave={() => setHoveredTool(null)}
            >
              <div className="text-[9px] font-mono-data font-medium truncate" style={{ color: heat.text }}>
                {tool.name.replace(/_/g, ' ')}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[8px] font-mono-data" style={{ color: 'var(--text-tertiary)' }}>
                  {tool.call_count}
                </span>
                {tool.call_count > 0 && (
                  <div className="w-6 h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${successRate * 100}%`,
                        backgroundColor: successRate >= 0.9 ? 'var(--apple-green)' : successRate >= 0.7 ? 'var(--apple-orange)' : 'var(--apple-red)',
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Tooltip */}
              {isHovered && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 z-20 p-2 rounded-lg shadow-lg whitespace-nowrap"
                  style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-default)' }}
                >
                  <div className="text-[10px] font-mono-data font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {tool.name}
                  </div>
                  <div className="text-[9px] font-mono-data space-y-0.5 mt-1" style={{ color: 'var(--text-secondary)' }}>
                    <div>Calls: {tool.call_count} ({tool.success_count} ok / {tool.fail_count} fail)</div>
                    <div>Success: {tool.call_count > 0 ? Math.round(successRate * 100) : 0}%</div>
                    <div>Avg time: {formatDuration(tool.avg_duration_ms)}</div>
                  </div>
                  <div className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 rotate-45"
                    style={{ backgroundColor: 'var(--bg-tertiary)', borderRight: '1px solid var(--border-default)', borderBottom: '1px solid var(--border-default)' }} />
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Heat legend */}
      <div className="flex items-center justify-center gap-2 text-[8px] font-mono-data" style={{ color: 'var(--text-tertiary)' }}>
        {HEAT_LEVELS.map((l) => (
          <div key={l.label} className="flex items-center gap-0.5">
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: l.bg, border: '1px solid var(--border-subtle)' }} />
            <span>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
