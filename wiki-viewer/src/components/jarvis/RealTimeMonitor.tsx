import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Activity, Cpu, Zap, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MonitorMetric {
  label: string;
  value: number;
  unit: string;
  icon: React.ElementType;
  color: string;
  history: number[];
  trend: 'up' | 'down' | 'flat';
}

interface StatusData {
  cycle_count: number;
  total_tool_calls: number;
  total_success: number;
  total_failed: number;
  success_rate: string;
  event_stats: Record<string, number>;
}

const TREND_ICONS = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
};

const TREND_COLORS = {
  up: 'var(--apple-green)',
  down: 'var(--apple-red)',
  flat: 'var(--text-tertiary)',
};

function MiniSparkline({ data, color, width = 60, height = 16 }: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MetricCard({ metric }: { metric: MonitorMetric }) {
  const TrendIcon = TREND_ICONS[metric.trend];
  const trendColor = TREND_COLORS[metric.trend];

  return (
    <div className="rounded-lg p-2.5" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <metric.icon size={10} style={{ color: metric.color }} />
          <span className="text-[9px] font-mono-data" style={{ color: 'var(--text-tertiary)' }}>
            {metric.label}
          </span>
        </div>
        <TrendIcon size={9} style={{ color: trendColor }} />
      </div>
      <div className="flex items-end justify-between">
        <span className="text-sm font-mono-data font-bold" style={{ color: 'var(--text-primary)' }}>
          {metric.value}
          <span className="text-[9px] font-normal ml-0.5" style={{ color: 'var(--text-tertiary)' }}>
            {metric.unit}
          </span>
        </span>
        <MiniSparkline data={metric.history} color={metric.color} />
      </div>
    </div>
  );
}

export function RealTimeMonitor() {
  const [metrics, setMetrics] = useState<MonitorMetric[]>([]);
  const historyRef = useRef<Map<string, number[]>>(new Map());

  const updateMetrics = useCallback(async () => {
    try {
      const res = await fetch('/api/jarvis/status');
      if (!res.ok) return;
      const json = await res.json();
      const data = (json?.data ?? json) as StatusData;
      if (!data) return;

      const history = historyRef.current;
      const maxHistory = 20;

      const pushHistory = (key: string, value: number) => {
        const arr = history.get(key) ?? [];
        arr.push(value);
        if (arr.length > maxHistory) arr.shift();
        history.set(key, arr);
        return [...arr];
      };

      const getTrend = (arr: number[]): 'up' | 'down' | 'flat' => {
        if (arr.length < 3) return 'flat';
        const recent = arr.slice(-3);
        const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const prev = arr.slice(-6, -3);
        if (prev.length === 0) return 'flat';
        const prevAvg = prev.reduce((a, b) => a + b, 0) / prev.length;
        if (avg > prevAvg * 1.1) return 'up';
        if (avg < prevAvg * 0.9) return 'down';
        return 'flat';
      };

      const totalEvents = Object.values(data.event_stats ?? {}).reduce((a, b) => a + b, 0);

      const newMetrics: MonitorMetric[] = [
        {
          label: 'Cycles',
          value: data.cycle_count ?? 0,
          unit: '',
          icon: Cpu,
          color: 'var(--apple-teal)',
          history: pushHistory('cycles', data.cycle_count ?? 0),
          trend: getTrend(history.get('cycles') ?? []),
        },
        {
          label: 'Tool Calls',
          value: data.total_tool_calls ?? 0,
          unit: '',
          icon: Zap,
          color: 'var(--apple-blue)',
          history: pushHistory('calls', data.total_tool_calls ?? 0),
          trend: getTrend(history.get('calls') ?? []),
        },
        {
          label: 'Success Rate',
          value: parseFloat(data.success_rate ?? '0'),
          unit: '%',
          icon: Activity,
          color: parseFloat(data.success_rate ?? '0') >= 90 ? 'var(--apple-green)' : parseFloat(data.success_rate ?? '0') >= 70 ? 'var(--apple-orange)' : 'var(--apple-red)',
          history: pushHistory('rate', parseFloat(data.success_rate ?? '0')),
          trend: getTrend(history.get('rate') ?? []),
        },
        {
          label: 'Events',
          value: totalEvents,
          unit: '',
          icon: Clock,
          color: 'var(--marshmallow-lavender)',
          history: pushHistory('events', totalEvents),
          trend: getTrend(history.get('events') ?? []),
        },
      ];

      setMetrics(newMetrics);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    updateMetrics();
    const interval = setInterval(updateMetrics, 5000);
    return () => clearInterval(interval);
  }, [updateMetrics]);

  return (
    <div className="glass p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={14} style={{ color: 'var(--apple-teal)' }} />
          <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
            Real-time Monitor
          </span>
        </div>
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: 'var(--apple-green)' }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {metrics.map((m) => (
          <MetricCard key={m.label} metric={m} />
        ))}
      </div>
    </div>
  );
}
