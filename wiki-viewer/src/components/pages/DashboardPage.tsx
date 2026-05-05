import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useWikiStore } from '@/stores/wikiStore';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { BarChart3, FileText, Users, Lightbulb, Layers, Link2, Calendar, Activity, RefreshCw, Frown } from 'lucide-react';
import { motion } from 'framer-motion';
import { DashboardSkeleton } from '@/components/ui/Skeleton';
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
  const nodes = graphData?.nodes || [];
  const edges = graphData?.edges || [];

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
      <div className={`p-3 rounded-xl ${color}`}>
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
          fill="rgba(10, 132, 255, 0.15)"
          stroke="var(--apple-blue)"
          strokeWidth={2}
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
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2 text-[var(--text-secondary)] uppercase tracking-wider">
            <BarChart3 size={18} />
            {t('dashboard.pageDistribution', 'Page Distribution')}
          </h2>
          <TypeBarChart stats={stats} />
        </div>

        <div className="apple-card p-6">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2 text-[var(--text-secondary)] uppercase tracking-wider">
            <Activity size={18} />
            {t('dashboard.wikiHealth', 'Wiki Health')}
          </h2>
          <RadarChart values={healthScores} />
          <div className="mt-4 text-center text-xs text-[var(--text-secondary)]">
            {t('dashboard.overall', 'Overall')}: <span className={`font-semibold ${scoreColor}`}>{overallScore}</span> / 100
          </div>
        </div>
      </div>

      {/* Link Density */}
      <div className="apple-card p-6">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2 text-[var(--text-secondary)] uppercase tracking-wider">
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
    </motion.div>
  );
}
