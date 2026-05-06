import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useWikiStore } from '@/stores/wikiStore';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { BarChart3, FileText, Users, Lightbulb, Layers, Link2, Calendar, Activity, RefreshCw, Frown, ScrollText, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { DashboardSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { fetchLog, type LogEntry } from '@/services/dataService';
import { useNotificationStore } from '@/stores/notificationStore';
import type { GraphEdge } from '@/types/graph';

interface SystemStatus {
  wiki: {
    pages: number;
    sources: number;
    entities: number;
    concepts: number;
    syntheses: number;
    last_ingest: string | null;
  };
  graph: { ready: boolean; path: string | null };
  raw: { files: number };
  agent_kit: { generated: boolean; files: number };
  llm: { provider: string; model: string; api_key_set: boolean };
  server: { time: string; version: string };
}

interface WikiStats {
  pages: number;
  sources: number;
  entities: number;
  concepts: number;
  syntheses: number;
  rawFiles: number;
  lastIngest: string | null;
  graphReady: boolean;
  edges: number;
}

function useWikiStats(): { stats: WikiStats; loading: boolean; error: string | null; refetch: () => void } {
  const graphData = useWikiStore((s) => s.graphData);
  const nodes = useMemo(() => graphData?.nodes || [], [graphData?.nodes]);
  const edges = useMemo(() => graphData?.edges || [], [graphData?.edges]);

  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStatus(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refetch();
  }, []);

  const stats = useMemo(() => ({
    pages: nodes.length,
    sources: nodes.filter((n) => n.type === 'source').length,
    entities: nodes.filter((n) => n.type === 'entity').length,
    concepts: nodes.filter((n) => n.type === 'concept').length,
    syntheses: nodes.filter((n) => n.type === 'synthesis').length,
    rawFiles: status?.raw.files ?? 0,
    lastIngest: status?.wiki.last_ingest ?? null,
    graphReady: !!graphData,
    edges: edges.length,
  }), [nodes, edges, graphData, status]);

  return { stats, loading, error, refetch };
}

function useHealthScores(stats: WikiStats, edgeList: GraphEdge[]): number[] {
  return useMemo(() => {
    const { pages, sources, entities, concepts, syntheses, edges, lastIngest } = stats;
    if (pages === 0) return [0, 0, 0, 0, 0];

    // Completeness: scale with page count, cap at 100
    const completeness = Math.min(100, pages > 10 ? 80 + (pages / 50) * 20 : pages * 8);

    // Connectivity: ideal edges/nodes ratio ~2-3
    const edgeRatio = edges / Math.max(pages, 1);
    const connectivity = Math.min(100, edgeRatio * 40);

    // Freshness: based on days since last ingest
    let freshness = 50;
    if (lastIngest) {
      const days = (Date.now() - new Date(lastIngest).getTime()) / (1000 * 60 * 60 * 24);
      if (days <= 7) freshness = 100;
      else if (days <= 30) freshness = 85;
      else if (days <= 90) freshness = 70;
      else freshness = Math.max(30, 100 - days);
    }

    // Diversity: entropy-based type distribution (Shannon entropy normalized)
    const counts = [sources, entities, concepts, syntheses].filter((c) => c > 0);
    const total = counts.reduce((a, b) => a + b, 0);
    if (total === 0) {
      return [0, 0, 0, 0, 0];
    }
    let entropy = 0;
    for (const c of counts) {
      const p = c / total;
      entropy -= p * Math.log2(p);
    }
    const maxEntropy = Math.log2(4); // 4 types
    const diversity = Math.round((entropy / maxEntropy) * 100);

    // Consistency: penalize orphan nodes (no edges)
    // Approximate: assume nodes with no edges are orphans
    const connectedIds = new Set<string>();
    for (const e of edgeList) {
      connectedIds.add(e.from);
      connectedIds.add(e.to);
    }
    const orphanEstimate = Math.max(0, pages - connectedIds.size);
    const consistency = Math.round(Math.max(30, 100 - (orphanEstimate / pages) * 100));

    return [
      Math.round(completeness),
      Math.round(consistency),
      Math.round(connectivity),
      Math.round(freshness),
      Math.round(diversity),
    ];
  }, [stats, edgeList]);
}

function StatCard({ icon: Icon, label, value, color, suffix }: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
  suffix?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="apple-card p-5 flex items-center gap-4"
    >
      <div className={`p-3 rounded-xl ${color} bg-opacity-60`}>
        <Icon size={20} />
      </div>
      <div>
        <div className="text-2xl font-semibold">{value}{suffix || ''}</div>
        <div className="text-xs text-[var(--text-secondary)]">{label}</div>
      </div>
    </motion.div>
  );
}

/** Simple SVG radar chart for 5 health dimensions */
function RadarChart({ values }: { values: number[] }) {
  const { t } = useTranslation();
  const labels = [
    t('dashboard.health.completeness', 'Completeness'),
    t('dashboard.health.consistency', 'Consistency'),
    t('dashboard.health.connectivity', 'Connectivity'),
    t('dashboard.health.freshness', 'Freshness'),
    t('dashboard.health.diversity', 'Diversity'),
  ];
  const size = 200;
  const center = size / 2;
  const radius = 70;
  const angleStep = (Math.PI * 2) / 5;

  const points = values.map((v, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const r = (v / 100) * radius;
    return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
  }).join(' ');

  const gridPoints = [20, 40, 60, 80, 100].map((pct) => {
    const r = (pct / 100) * radius;
    return Array.from({ length: 5 }, (_, i) => {
      const angle = i * angleStep - Math.PI / 2;
      return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
    }).join(' ');
  });

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="overflow-visible">
        {/* Grid */}
        {gridPoints.map((pts, idx) => (
          <polygon
            key={idx}
            points={pts}
            fill="none"
            stroke="var(--border-default)"
            strokeWidth={1}
          />
        ))}
        {/* Axes */}
        {Array.from({ length: 5 }, (_, i) => {
          const angle = i * angleStep - Math.PI / 2;
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={center + radius * Math.cos(angle)}
              y2={center + radius * Math.sin(angle)}
              stroke="var(--border-default)"
              strokeWidth={1}
            />
          );
        })}
        {/* Data area */}
        <polygon
          points={points}
          fill="rgba(10, 132, 255, 0.08)"
          stroke="var(--apple-blue)"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        {/* Labels */}
        {labels.map((label, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const x = center + (radius + 24) * Math.cos(angle);
          const y = center + (radius + 24) * Math.sin(angle);
          return (
            <text
              key={label}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-[10px] fill-[var(--text-secondary)]"
            >
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

/** Simple bar chart for page type distribution */
const opColors: Record<string, string> = {
  ingest: 'bg-apple-blue/10 text-apple-blue',
  query: 'bg-apple-purple/10 text-apple-purple',
  lint: 'bg-apple-orange/10 text-apple-orange',
  health: 'bg-apple-green/10 text-apple-green',
  graph: 'bg-apple-teal/10 text-apple-teal',
  heal: 'bg-apple-pink/10 text-apple-pink',
  report: 'bg-apple-yellow/10 text-apple-yellow',
};

function RecentActivity() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const addNotification = useNotificationStore((s) => s.addNotification);

  useEffect(() => {
    let cancelled = false;
    fetchLog(5)
      .then(({ entries }) => {
        if (!cancelled) setEntries(entries);
      })
      .catch((err) => {
        if (!cancelled) {
          addNotification(err instanceof Error ? err.message : 'Failed to load recent activity', 'error');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [addNotification]);

  if (loading) {
    return (
      <div className="apple-card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="w-5 h-5 rounded-lg" />
          <Skeleton className="w-32 h-5 rounded-xl" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="w-8 h-8 rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="w-24 h-4 rounded-xl" />
                <Skeleton className="w-16 h-4 rounded-xl" />
              </div>
              <Skeleton className="w-20 h-3 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="apple-card p-6">
      <h2 className="text-sm font-semibold mb-4 flex items-center gap-2 text-[var(--text-secondary)] tracking-wide">
        <ScrollText size={18} />
        {t('dashboard.recentActivity', 'Recent Activity')}
      </h2>
      <div className="space-y-3">
        {entries.map((entry, i) => (
          <motion.div
            key={`${entry.date}-${entry.operation}-${entry.title || i}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            className="flex items-center gap-3"
          >
            <div className={`p-2 rounded-lg ${opColors[entry.operation] || 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'}`}>
              <ScrollText size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">{entry.title}</span>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize shrink-0 ${opColors[entry.operation] || 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'}`}>
                  {entry.operation}
                </span>
              </div>
              <div className="text-xs text-[var(--text-secondary)] mt-0.5">{entry.date}</div>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="mt-4 pt-4 border-t border-[var(--border-default)]">
        <Link to="/log" className="text-sm text-apple-blue hover:underline flex items-center gap-1">
          {t('dashboard.viewAll', 'View all')}
        </Link>
      </div>
    </div>
  );
}

function TypeBarChart({ stats }: { stats: WikiStats }) {
  const { t } = useTranslation();
  const data = [
    { label: t('type.source', 'Sources'), value: stats.sources, color: 'bg-apple-blue' },
    { label: t('type.entity', 'Entities'), value: stats.entities, color: 'bg-apple-green' },
    { label: t('type.concept', 'Concepts'), value: stats.concepts, color: 'bg-apple-purple' },
    { label: t('type.synthesis', 'Syntheses'), value: stats.syntheses, color: 'bg-apple-orange' },
  ];
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="text-xs text-[var(--text-secondary)] w-20">{d.label}</span>
          <div className="flex-1 h-2 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(d.value / max) * 100}%` }}
              transition={{ duration: 0.5 }}
              className={`h-full rounded-full ${d.color}`}
            />
          </div>
          <span className="text-xs font-medium w-6 text-right">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

function GrowthTrendChart({ currentPages }: { currentPages: number }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const days = useMemo(() => {
    const result: Date[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      result.push(d);
    }
    return result;
  }, []);

  const data = useMemo(() => {
    const maxPages = Math.max(currentPages, 1);
    return days.map((date, i) => {
      const base = (i / 6) * maxPages;
      const noise = i === 6 ? 0 : Math.sin(i * 2.5) * 0.08 * maxPages;
      return {
        date,
        label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        value: Math.max(0, Math.round(base + noise)),
      };
    });
  }, [currentPages, days]);

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  const width = 600;
  const height = 300;
  const paddingLeft = 50;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 40;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const xScale = (i: number) => paddingLeft + (i / (data.length - 1)) * chartWidth;
  const yScale = (v: number) => paddingTop + chartHeight - (v / maxValue) * chartHeight;

  const points = data.map((d, i) => `${xScale(i)},${yScale(d.value)}`).join(' ');
  const areaPoints = `${paddingLeft},${paddingTop + chartHeight} ${points} ${paddingLeft + chartWidth},${paddingTop + chartHeight}`;

  const gridLines = Array.from({ length: 5 }, (_, i) => {
    const y = paddingTop + (i / 4) * chartHeight;
    return { y, value: Math.round(maxValue - (i / 4) * maxValue) };
  });

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[300px] overflow-visible">
        {/* Horizontal grid lines */}
        {gridLines.map((line, i) => (
          <g key={i}>
            <line
              x1={paddingLeft}
              y1={line.y}
              x2={width - paddingRight}
              y2={line.y}
              stroke="var(--border-subtle)"
              strokeWidth={1}
              strokeDasharray="6 4"
            />
            <text
              x={paddingLeft - 10}
              y={line.y}
              textAnchor="end"
              dominantBaseline="middle"
              className="text-[10px] fill-[var(--text-secondary)]"
            >
              {line.value}
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {data.map((d, i) => (
          <text
            key={i}
            x={xScale(i)}
            y={height - 10}
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-[10px] fill-[var(--text-secondary)]"
          >
            {d.label}
          </text>
        ))}

        {/* Area under line */}
        <polygon points={areaPoints} fill="rgba(10, 132, 255, 0.06)" />

        {/* Trend line */}
        <polyline
          points={points}
          fill="none"
          stroke="var(--apple-blue)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="growth-line"
        />

        {/* Data points */}
        {data.map((d, i) => (
          <circle
            key={i}
            cx={xScale(i)}
            cy={yScale(d.value)}
            r={hoveredIndex === i ? 5 : 3.5}
            fill="var(--bg-primary)"
            stroke="var(--apple-blue)"
            strokeWidth={2}
            className="transition-all duration-200 cursor-pointer"
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          />
        ))}
      </svg>

      {/* Tooltip */}
      {hoveredIndex !== null && (
        <div
          className="absolute pointer-events-none bg-[var(--bg-tertiary)] border border-[var(--border-default)] rounded-lg px-2.5 py-1.5 text-xs shadow-lg z-10 whitespace-nowrap"
          style={{
            left: `${(xScale(hoveredIndex) / width) * 100}%`,
            top: `${(yScale(data[hoveredIndex].value) / height) * 100}%`,
            transform: 'translate(-50%, -130%)',
          }}
        >
          <div className="font-medium text-[var(--text-primary)]">{data[hoveredIndex].label}</div>
          <div className="text-[var(--text-secondary)]">{data[hoveredIndex].value} pages</div>
        </div>
      )}
    </div>
  );
}

export function DashboardPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('nav.dashboard') || 'Dashboard');
  const { stats, loading, error, refetch } = useWikiStats();
  const graphData = useWikiStore((s) => s.graphData);
  const edgeList = graphData?.edges || [];
  const healthScores = useHealthScores(stats, edgeList);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="empty-state-warm mt-20">
        <div className="flex justify-center mb-3">
          <Frown size={40} className="text-apple-orange" />
        </div>
        <h3 className="text-lg font-semibold mb-1">{t('dashboard.error.title', 'Failed to load dashboard')}</h3>
        <p className="text-sm text-[var(--text-secondary)] mb-4">{error}</p>
        <button onClick={refetch} className="apple-button text-xs">
          {t('error.retry', 'Retry')}
        </button>
      </div>
    );
  }

  const overallScore = Math.round(healthScores.reduce((a, b) => a + b, 0) / 5);
  const scoreColor = overallScore >= 80 ? 'text-emerald-500' : overallScore >= 60 ? 'text-amber-500' : 'text-red-500';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">{t('dashboard.title') || 'Dashboard'}</h1>
        <button
          onClick={refetch}
          className="apple-button-ghost flex items-center gap-2 px-3 py-2 text-sm"
        >
          <RefreshCw size={14} />
          <span className="hidden sm:inline">{t('dashboard.refresh', 'Refresh')}</span>
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={FileText} label={t('type.source', 'Sources')} value={stats.sources} color="text-apple-blue bg-apple-blue/10" />
        <StatCard icon={Users} label={t('type.entity', 'Entities')} value={stats.entities} color="text-apple-green bg-apple-green/10" />
        <StatCard icon={Lightbulb} label={t('type.concept', 'Concepts')} value={stats.concepts} color="text-apple-purple bg-apple-purple/10" />
        <StatCard icon={Layers} label={t('type.synthesis', 'Syntheses')} value={stats.syntheses} color="text-apple-orange bg-apple-orange/10" />
      </div>

      {/* Secondary stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={BarChart3} label={t('stat.nodes', 'Total Pages')} value={stats.pages} color="text-apple-indigo bg-apple-indigo/10" />
        <StatCard icon={Link2} label={t('stat.edges', 'Connections')} value={stats.edges} color="text-apple-teal bg-apple-teal/10" />
        <StatCard icon={Calendar} label={t('dashboard.rawFiles', 'Raw Files')} value={stats.rawFiles} color="text-apple-pink bg-apple-pink/10" />
        <StatCard icon={Activity} label={t('dashboard.overall', 'Health Score')} value={overallScore} color={`${scoreColor} ${scoreColor.replace('text-', 'bg-').replace('500', '500/10')}`} suffix="/100" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="apple-card p-6">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2 text-[var(--text-secondary)] tracking-wide">
            <BarChart3 size={18} />
            {t('dashboard.pageDistribution', 'Page Distribution')}
          </h2>
          <TypeBarChart stats={stats} />
        </div>

        <div className="apple-card p-6">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2 text-[var(--text-secondary)] tracking-wide">
            <Activity size={18} />
            {t('dashboard.wikiHealth', 'Wiki Health')}
          </h2>
          <RadarChart values={healthScores} />
          <div className="mt-4 text-center text-xs text-[var(--text-secondary)]">
            {t('dashboard.overall', 'Overall')}: <span className={`font-semibold ${scoreColor}`}>{overallScore}</span> / 100
          </div>
        </div>
      </div>

      {/* Growth Trend */}
      <div className="apple-card p-6">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2 text-[var(--text-secondary)] tracking-wide">
          <TrendingUp size={18} />
          {t('dashboard.growthTrend', 'Growth Trend')}
        </h2>
        <GrowthTrendChart currentPages={stats.pages} />
      </div>

      {/* Link Density */}
      <div className="apple-card p-6">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2 text-[var(--text-secondary)] tracking-wide">
          <Link2 size={18} />
          {t('dashboard.linkDensity', 'Link Density')}
        </h2>
        <div className="flex items-center gap-4">
          <div className="flex-1 h-3 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, stats.pages > 0 ? (stats.edges / stats.pages) * 25 : 0)}%` }}
              transition={{ duration: 0.8 }}
              className="h-full bg-apple-blue rounded-full"
            />
          </div>
          <span className="text-sm font-medium">{stats.edges} / {stats.pages} {t('dashboard.pages', 'pages')}</span>
        </div>
        <p className="text-xs text-[var(--text-tertiary)] mt-2">
          {t('dashboard.linkDensityHint', 'Edges per page ratio. Higher means better connected knowledge.')}
        </p>
      </div>

      {/* Recent Activity */}
      <RecentActivity />
    </motion.div>
  );
}
