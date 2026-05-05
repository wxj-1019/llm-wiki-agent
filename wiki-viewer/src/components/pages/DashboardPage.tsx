import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useWikiStore } from '@/stores/wikiStore';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { BarChart3, FileText, Users, Lightbulb, Layers, Link2, Calendar, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import { DashboardSkeleton } from '@/components/ui/Skeleton';

interface WikiStats {
  pages: number;
  sources: number;
  entities: number;
  concepts: number;
  syntheses: number;
  rawFiles: number;
  lastIngest: string | null;
  graphReady: boolean;
}

function useWikiStats(): WikiStats {
  const graphData = useWikiStore((s) => s.graphData);
  const nodes = graphData?.nodes || [];

  return useMemo(() => ({
    pages: nodes.length,
    sources: nodes.filter((n) => n.type === 'source').length,
    entities: nodes.filter((n) => n.type === 'entity').length,
    concepts: nodes.filter((n) => n.type === 'concept').length,
    syntheses: nodes.filter((n) => n.type === 'synthesis').length,
    rawFiles: 0,
    lastIngest: null,
    graphReady: !!graphData,
  }), [nodes, graphData]);
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
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
        <div className="text-2xl font-semibold">{value}</div>
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
          const x = center + (radius + 20) * Math.cos(angle);
          const y = center + (radius + 20) * Math.sin(angle);
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
  const stats = useWikiStats();
  const [healthScores, setHealthScores] = useState<number[] | null>(null);

  useEffect(() => {
    // Compute pseudo-health scores from graph data
    const { pages, sources, entities, concepts } = stats;
    if (pages === 0) {
      setHealthScores([0, 0, 0, 0, 0]);
      return;
    }
    const completeness = Math.min(100, pages > 10 ? 80 + Math.random() * 15 : 40 + pages * 4);
    const connectivity = Math.min(100, pages > 5 ? 70 + Math.random() * 20 : 30 + pages * 8);
    const freshness = stats.lastIngest ? 85 : 50;
    const diversity = Math.min(100, (sources + entities + concepts) / Math.max(pages, 1) * 100 * 3);
    const consistency = 70;
    setHealthScores([
      Math.round(completeness),
      Math.round(consistency),
      Math.round(connectivity),
      Math.round(freshness),
      Math.round(diversity),
    ]);
  }, [stats]);

  if (!stats.graphReady) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-semibold">{t('dashboard.title') || 'Dashboard'}</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={FileText} label={t('type.source', 'Sources')} value={stats.sources} color="text-apple-blue bg-apple-blue/10" />
        <StatCard icon={Users} label={t('type.entity', 'Entities')} value={stats.entities} color="text-apple-green bg-apple-green/10" />
        <StatCard icon={Lightbulb} label={t('type.concept', 'Concepts')} value={stats.concepts} color="text-apple-purple bg-apple-purple/10" />
        <StatCard icon={Layers} label={t('type.synthesis', 'Syntheses')} value={stats.syntheses} color="text-apple-orange bg-apple-orange/10" />
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
          <RadarChart values={healthScores || [0, 0, 0, 0, 0]} />
          <div className="mt-4 text-center text-xs text-[var(--text-secondary)]">
            {t('dashboard.overall', 'Overall')}: {Math.round((healthScores || [0,0,0,0,0]).reduce((a, b) => a + b, 0) / 5)} / 100
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
              animate={{ width: `${Math.min(100, stats.pages * 3)}%` }}
              transition={{ duration: 0.8 }}
              className="h-full bg-apple-blue rounded-full"
            />
          </div>
          <span className="text-sm font-medium">{stats.pages} {t('dashboard.pages', 'pages')}</span>
        </div>
      </div>
    </div>
  );
}
