import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, BookOpen, Network, Sparkles, ArrowRight, Clock, Copy, Check, RefreshCw, Heart, Inbox, Layers, Shuffle, Compass, GitBranch, Upload, MessageCircle, BarChart3, FileText, Users, Lightbulb, Link2, Calendar, Activity, Frown, ScrollText, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWikiStore } from '@/stores/wikiStore';
import { motion, AnimatePresence } from 'framer-motion';
import { typeLabelKey } from '@/i18n';
import { getPagePath } from '@/lib/wikilink';
import { searchNodes } from '@/lib/search';
import { stripMarkdown } from '@/lib/textUtils';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useDebounce } from '@/hooks/useDebounce';
import { Skeleton } from '@/components/ui/Skeleton';
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

    const completeness = Math.min(100, pages > 10 ? 80 + (pages / 50) * 20 : pages * 8);

    const edgeRatio = edges / Math.max(pages, 1);
    const connectivity = Math.min(100, edgeRatio * 40);

    let freshness = 50;
    if (lastIngest) {
      const days = (Date.now() - new Date(lastIngest).getTime()) / (1000 * 60 * 60 * 24);
      if (days <= 7) freshness = 100;
      else if (days <= 30) freshness = 85;
      else if (days <= 90) freshness = 70;
      else freshness = Math.max(30, 100 - days);
    }

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
    const maxEntropy = Math.log2(4);
    const diversity = Math.round((entropy / maxEntropy) * 100);

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

function RadarChart({ values }: { values: number[] }) {
  const { t } = useTranslation();
  const labels = [
    t('home.health.completeness'),
    t('home.health.consistency'),
    t('home.health.connectivity'),
    t('home.health.freshness'),
    t('home.health.diversity'),
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
        {gridPoints.map((pts, idx) => (
          <polygon key={idx} points={pts} fill="none" stroke="var(--border-default)" strokeWidth={1} />
        ))}
        {Array.from({ length: 5 }, (_, i) => {
          const angle = i * angleStep - Math.PI / 2;
          return (
            <line
              key={i}
              x1={center} y1={center}
              x2={center + radius * Math.cos(angle)}
              y2={center + radius * Math.sin(angle)}
              stroke="var(--border-default)" strokeWidth={1}
            />
          );
        })}
        <polygon
          points={points}
          fill="rgba(10, 132, 255, 0.08)"
          stroke="var(--apple-blue)"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        {labels.map((label, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const x = center + (radius + 24) * Math.cos(angle);
          const y = center + (radius + 24) * Math.sin(angle);
          return (
            <text key={label} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="text-[10px] fill-[var(--text-secondary)]">
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function TypeBarChart({ stats }: { stats: WikiStats }) {
  const { t } = useTranslation();
  const data = [
    { label: t('type.source'), value: stats.sources, color: 'bg-apple-blue' },
    { label: t('type.entity'), value: stats.entities, color: 'bg-apple-green' },
    { label: t('type.concept'), value: stats.concepts, color: 'bg-apple-purple' },
    { label: t('type.synthesis'), value: stats.syntheses, color: 'bg-apple-orange' },
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
        {gridLines.map((line, i) => (
          <g key={i}>
            <line x1={paddingLeft} y1={line.y} x2={width - paddingRight} y2={line.y} stroke="var(--border-subtle)" strokeWidth={1} strokeDasharray="6 4" />
            <text x={paddingLeft - 10} y={line.y} textAnchor="end" dominantBaseline="middle" className="text-[10px] fill-[var(--text-secondary)]">{line.value}</text>
          </g>
        ))}
        {data.map((d, i) => (
          <text key={i} x={xScale(i)} y={height - 10} textAnchor="middle" dominantBaseline="middle" className="text-[10px] fill-[var(--text-secondary)]">{d.label}</text>
        ))}
        <polygon points={areaPoints} fill="rgba(10, 132, 255, 0.06)" />
        <polyline points={points} fill="none" stroke="var(--apple-blue)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="growth-line" />
        {data.map((d, i) => (
          <circle
            key={i} cx={xScale(i)} cy={yScale(d.value)}
            r={hoveredIndex === i ? 5 : 3.5}
            fill="var(--bg-primary)" stroke="var(--apple-blue)" strokeWidth={2}
            className="transition-all duration-200 cursor-pointer"
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          />
        ))}
      </svg>
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
        {t('home.recentActivity')}
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
          {t('home.viewAll')}
        </Link>
      </div>
    </div>
  );
}

export function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const graphData = useWikiStore((s) => s.graphData);

  const initialize = useWikiStore((s) => s.initialize);
  const recentPages = useWikiStore((s) => s.recentPages);
  const favorites = useWikiStore((s) => s.favorites);
  const nodes = useMemo(() => graphData?.nodes || [], [graphData?.nodes]);

  const { stats, loading, error, refetch } = useWikiStats();
  const edgeList = graphData?.edges || [];
  const healthScores = useHealthScores(stats, edgeList);

  const [homeQuery, setHomeQuery] = useState('');
  const debouncedHomeQuery = useDebounce(homeQuery, 200);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const searchWrapperRef = useRef<HTMLDivElement>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => { if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current); };
  }, []);

  const homeResults = useMemo(
    () => (debouncedHomeQuery ? searchNodes(debouncedHomeQuery).slice(0, 5) : []),
    [debouncedHomeQuery]
  );

  useEffect(() => {
    setSelectedIdx(-1);
  }, [debouncedHomeQuery]);

  useEffect(() => {
    if (homeQuery.length === 0) return;
    const handler = (e: MouseEvent) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setHomeQuery('');
        setSelectedIdx(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [homeQuery]);

  const recentNodes = useMemo(
    () => recentPages.map((id) => nodes.find((n) => n.id === id)).filter(Boolean).slice(0, 3),
    [recentPages, nodes]
  );

  const randomNode = useMemo(() => {
    if (nodes.length === 0) return null;
    return nodes[Math.floor(Math.random() * nodes.length)];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length]);

  const handleRandomPick = useCallback(() => {
    if (nodes.length === 0) return;
    const node = nodes[Math.floor(Math.random() * nodes.length)];
    navigate(getPagePath(node));
  }, [nodes, navigate]);

  useDocumentTitle();

  const hour = new Date().getHours();
  const greetingKey = hour < 12 ? 'greeting.morning' : hour < 18 ? 'greeting.afternoon' : 'greeting.evening';

  if (loading && nodes.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-8">
        <div className="mb-10">
          <div className="text-3xl font-bold tracking-tight text-[var(--text-primary)] mb-2 font-rounded">{t(greetingKey)}</div>
          <p className="text-[var(--text-secondary)]">{t('home.subtitle')}</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="apple-card p-5 flex items-center gap-4">
              <Skeleton className="w-11 h-11 rounded-xl" />
              <div>
                <Skeleton className="w-10 h-7 rounded-xl mb-1" />
                <Skeleton className="w-16 h-4 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    );
  }

  if (error && nodes.length === 0) {
    return (
      <div className="empty-state-warm mt-20">
        <div className="flex justify-center mb-3">
          <Frown size={40} className="text-apple-orange" />
        </div>
        <h3 className="text-lg font-semibold mb-1">{t('home.error.title')}</h3>
        <p className="text-sm text-[var(--text-secondary)] mb-4">{error}</p>
        <button onClick={refetch} className="apple-button text-xs">
          {t('error.retry')}
        </button>
      </div>
    );
  }

  const overallScore = Math.round(healthScores.reduce((a, b) => a + b, 0) / 5);
  const scoreColor = overallScore >= 80 ? 'text-emerald-500' : overallScore >= 60 ? 'text-amber-500' : 'text-red-500';

  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="absolute -top-20 -left-20 w-80 h-80 bg-marshmallow-peach rounded-full ambient-blob" style={{ opacity: 0.06 }} />
      <div className="absolute top-40 -right-20 w-96 h-96 bg-marshmallow-lavender rounded-full ambient-blob" style={{ animationDelay: '3s', opacity: 0.06 }} />
      <div className="relative z-10">
        {/* Greeting + Refresh */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10 flex items-start justify-between"
        >
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)] mb-2 font-rounded">
              {t(greetingKey)}
            </h1>
            <p className="text-[var(--text-secondary)]">
              {t('home.subtitle')}
            </p>
          </div>
          <button
            onClick={refetch}
            className="apple-button-ghost flex items-center gap-2 px-3 py-2 text-sm"
          >
            <RefreshCw size={14} />
            <span className="hidden sm:inline">{t('home.refresh')}</span>
          </button>
        </motion.div>

        {/* Empty state: wiki has no pages yet */}
        {nodes.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-12"
          >
            <div className="apple-card p-8 max-w-3xl">
              <div className="text-center mb-8">
                <div className="flex justify-center mb-4">
                  <Inbox size={48} className="text-apple-blue" />
                </div>
                <h2 className="text-lg font-bold mb-2">{t('empty.title')}</h2>
                <p className="text-sm text-[var(--text-secondary)]">{t('empty.description')}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                {[
                  { icon: '01', title: t('home.empty.step1.title'), desc: t('home.empty.step1.desc') },
                  { icon: '02', title: t('home.empty.step2.title'), desc: t('home.empty.step2.desc') },
                  { icon: '03', title: t('home.empty.step3.title'), desc: t('home.empty.step3.desc') },
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-3 sm:block text-left sm:text-center">
                    <div className="text-sm text-apple-blue font-bold mb-0 sm:mb-1">{step.icon}</div>
                    <div>
                      <div className="font-medium text-sm">{step.title}</div>
                      <div className="text-xs text-[var(--text-secondary)]">{step.desc}</div>
                    </div>
                    {i < 2 && (
                      <div className="hidden sm:block text-[var(--text-tertiary)] my-1">
                        <ArrowRight size={14} className="mx-auto rotate-90 sm:rotate-0" />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="bg-[var(--bg-tertiary)] p-4 text-center rounded-xl border border-[var(--border-default)]">
                <p className="text-xs text-[var(--text-tertiary)] mb-2">{t('empty.ingestHint')}</p>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <code className="text-sm font-mono text-apple-blue bg-[var(--bg-primary)] px-3 py-1.5 border border-[var(--border-default)] rounded-lg">
                    {t('empty.ingestCommand')}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(t('empty.ingestCommand'));
                      setCopied(true);
                      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
                      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-[var(--bg-primary)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors border border-[var(--border-default)] hover:border-[var(--border-strong)] rounded-xl"
                  >
                    {copied ? <Check size={12} className="text-apple-blue" /> : <Copy size={12} />}
                    {copied ? t('home.empty.copied') : t('home.empty.copyCommand')}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Search bar */}
        {nodes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-10"
          >
            <div className="relative max-w-2xl" ref={searchWrapperRef} role="search">
              <div className="flex items-center gap-3 w-full px-6 py-4 bg-[var(--bg-secondary)] border border-[var(--border-default)] hover:border-apple-blue focus-within:border-apple-blue focus-within:shadow-[0_0_0_4px_rgba(10,132,255,0.08)] transition-all duration-200 rounded-2xl">
                <Search size={20} className="text-[var(--text-tertiary)] shrink-0" />
                <input
                  value={homeQuery}
                  onChange={(e) => { setHomeQuery(e.target.value); setSelectedIdx(-1); }}
                  placeholder={t('home.searchPlaceholder')}
                  className="flex-1 bg-transparent outline-none text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                  aria-label={t('home.searchPlaceholder')}
                  aria-autocomplete="list"
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setHomeQuery('');
                      setSelectedIdx(-1);
                    } else if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setSelectedIdx((prev) => Math.min(prev + 1, homeResults.length - 1));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setSelectedIdx((prev) => Math.max(prev - 1, -1));
                    } else if (e.key === 'Enter' && selectedIdx >= 0 && homeResults[selectedIdx]) {
                      e.preventDefault();
                      const node = homeResults[selectedIdx].item;
                      navigate(getPagePath(node));
                      setHomeQuery('');
                      setSelectedIdx(-1);
                    }
                  }}
                />
                <kbd className="ml-auto px-2.5 py-1 text-xs bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg">{t('shortcut.ctrlK')}</kbd>
              </div>
              <AnimatePresence>
                {homeResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 right-0 top-full mt-2 p-2 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-2xl shadow-lg z-50"
                  >
                    {homeResults.map((r, idx) => (
                      <button
                        key={r.item.id}
                        onClick={() => {
                          navigate(getPagePath(r.item));
                          setHomeQuery('');
                          setSelectedIdx(-1);
                        }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors ${
                          idx === selectedIdx
                            ? 'bg-apple-blue/10 text-apple-blue'
                            : 'hover:bg-[var(--bg-secondary)]'
                        }`}
                      >
                        <div className="font-medium text-sm">{r.item.label}</div>
                        <div className="text-xs text-[var(--text-tertiary)] truncate">{stripMarkdown(r.item.preview)}</div>
                      </button>
                    ))}
                    <Link
                      to={`/search?q=${encodeURIComponent(debouncedHomeQuery)}`}
                      className="block text-center text-sm text-apple-blue hover:underline py-2 mt-1"
                    >
                      {t('home.searchSeeAll', { query: debouncedHomeQuery })} →
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* Quick Actions */}
        {nodes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mb-10"
          >
            <div className="flex flex-wrap items-center gap-2">
              {[
                { key: 'browse', labelKey: 'home.quickActions.browse', icon: Compass, path: '/browse', color: 'text-apple-blue bg-apple-blue/10 hover:bg-apple-blue/20' },
                { key: 'graph', labelKey: 'home.quickActions.graph', icon: GitBranch, path: '/graph', color: 'text-apple-purple bg-apple-purple/10 hover:bg-apple-purple/20' },
                { key: 'upload', labelKey: 'home.quickActions.upload', icon: Upload, path: '/upload', color: 'text-apple-green bg-apple-green/10 hover:bg-apple-green/20' },
                { key: 'chat', labelKey: 'home.quickActions.chat', icon: MessageCircle, path: '/chat', color: 'text-apple-orange bg-apple-orange/10 hover:bg-apple-orange/20' },
              ].map((action) => (
                <Link
                  key={action.key}
                  to={action.path}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-[0.97] ${action.color}`}
                >
                  <action.icon size={16} />
                  {t(action.labelKey as string)}
                </Link>
              ))}
            </div>
          </motion.div>
        )}

        {/* Stat Cards — Primary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
        >
          <StatCard icon={FileText} label={t('type.source')} value={stats.sources} color="text-apple-blue bg-apple-blue/10" />
          <StatCard icon={Users} label={t('type.entity')} value={stats.entities} color="text-apple-green bg-apple-green/10" />
          <StatCard icon={Lightbulb} label={t('type.concept')} value={stats.concepts} color="text-apple-purple bg-apple-purple/10" />
          <StatCard icon={Layers} label={t('type.synthesis')} value={stats.syntheses} color="text-apple-orange bg-apple-orange/10" />
        </motion.div>

        {/* Stat Cards — Secondary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12"
        >
          <StatCard icon={BarChart3} label={t('stat.nodes')} value={stats.pages} color="text-apple-indigo bg-apple-indigo/10" />
          <StatCard icon={Link2} label={t('stat.edges')} value={stats.edges} color="text-apple-teal bg-apple-teal/10" />
          <StatCard icon={Calendar} label={t('home.rawFiles')} value={stats.rawFiles} color="text-apple-pink bg-apple-pink/10" />
          <StatCard icon={Activity} label={t('home.healthScore')} value={overallScore} color={`${scoreColor} ${scoreColor.replace('text-', 'bg-').replace('500', '500/10')}`} suffix="/100" />
        </motion.div>

        {/* Charts Row — Page Distribution + Health Radar */}
        {nodes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8"
          >
            <div className="apple-card p-6">
              <h2 className="text-sm font-semibold mb-4 flex items-center gap-2 text-[var(--text-secondary)] tracking-wide">
                <BarChart3 size={18} />
                {t('home.pageDistribution')}
              </h2>
              <TypeBarChart stats={stats} />
            </div>
            <div className="apple-card p-6">
              <h2 className="text-sm font-semibold mb-4 flex items-center gap-2 text-[var(--text-secondary)] tracking-wide">
                <Activity size={18} />
                {t('home.wikiHealth')}
              </h2>
              <RadarChart values={healthScores} />
              <div className="mt-4 text-center text-xs text-[var(--text-secondary)]">
                {t('home.healthOverall')}: <span className={`font-semibold ${scoreColor}`}>{overallScore}</span> / 100
              </div>
            </div>
          </motion.div>
        )}

        {/* Growth Trend */}
        {nodes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="apple-card p-6 mb-8"
          >
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2 text-[var(--text-secondary)] tracking-wide">
              <TrendingUp size={18} />
              {t('home.growthTrend')}
            </h2>
            <GrowthTrendChart currentPages={stats.pages} />
          </motion.div>
        )}

        {/* Link Density */}
        {nodes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="apple-card p-6 mb-8"
          >
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2 text-[var(--text-secondary)] tracking-wide">
              <Link2 size={18} />
              {t('home.linkDensity')}
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
              <span className="text-sm font-medium">{stats.edges} / {stats.pages} {t('home.pages')}</span>
            </div>
            <p className="text-xs text-[var(--text-tertiary)] mt-2">
              {t('home.linkDensityHint')}
            </p>
          </motion.div>
        )}

        {/* Favorites */}
        {nodes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="mb-10"
          >
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Heart size={16} className="text-apple-pink" />
              {t('home.favorites.title')}
            </h2>
            {favorites.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {favorites
                  .map((id) => nodes.find((n) => n.id === id))
                  .filter(Boolean)
                  .slice(0, 6)
                  .map((node) => (
                    <PageCard key={node!.id} node={node!} />
                  ))}
              </div>
            ) : (
              <div className="apple-card p-8 text-center">
                <Heart size={32} className="mx-auto mb-3 text-[var(--border-strong)]" />
                <p className="text-sm text-[var(--text-secondary)] mb-3">{t('home.favorites.empty')}</p>
                <Link
                  to="/browse"
                  className="inline-flex items-center gap-1.5 text-sm text-apple-blue hover:underline"
                >
                  {t('home.favorites.browseCta')}
                  <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </motion.div>
        )}

        {/* Continue Reading */}
        {nodes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="mb-10"
          >
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Clock size={16} className="text-apple-purple" />
              {t('home.sections.continueReading')}
            </h2>
            {recentNodes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {recentNodes.map((node) => (
                  <PageCard key={node!.id} node={node!} />
                ))}
              </div>
            ) : (
              <div className="apple-card p-8 text-center">
                <Clock size={32} className="mx-auto mb-3 text-[var(--border-strong)]" />
                <p className="text-sm text-[var(--text-secondary)] mb-4">{t('home.continueReading.empty')}</p>
                <button
                  onClick={handleRandomPick}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-apple-purple/10 text-apple-purple text-sm font-medium rounded-xl hover:bg-apple-purple/20 transition-colors"
                >
                  <Shuffle size={14} />
                  {t('home.continueReading.randomPick')}
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* Bottom Bento: Recent Activity + Knowledge Graph */}
        {nodes.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <RecentActivity />

            {graphData ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.55 }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold">{t('home.sections.knowledgeGraph')}</h2>
                  <Link to="/graph" className="text-sm text-apple-blue hover:underline flex items-center gap-1">
                    {t('action.explore')} <ArrowRight size={14} />
                  </Link>
                </div>
                <div className="apple-card p-6">
                  <div className="flex items-center justify-center gap-8 text-sm text-[var(--text-secondary)]">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-[var(--text-primary)] tabular-nums">{nodes.length}</div>
                      <div className="text-xs font-medium">{t('stat.nodes')}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-[var(--text-primary)] tabular-nums">{graphData.edges.length}</div>
                      <div className="text-xs font-medium">{t('stat.edges')}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-[var(--text-primary)] tabular-nums">{new Set(nodes.map((n) => n.group)).size}</div>
                      <div className="text-xs font-medium">{t('stat.communities')}</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.55 }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold">{t('home.sections.knowledgeGraph')}</h2>
                </div>
                <div className="apple-card p-6 text-center">
                  <p className="text-sm text-[var(--text-secondary)] mb-4">{t('home.graph.error')}</p>
                  <button
                    onClick={() => initialize()}
                    className="apple-button-ghost text-sm"
                  >
                    <RefreshCw size={14} />
                    {t('home.graph.retry')}
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* Random Discovery (only when no graphData — otherwise space is used by graph) */}
        {!graphData && randomNode && nodes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="mb-8"
          >
            <h2 className="text-lg font-bold mb-4">{t('home.sections.randomDiscovery')}</h2>
            <div className="warm-card p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <TypeBadge type={randomNode.type} />
                    <span className="text-xs text-[var(--text-secondary)]">{randomNode.id}</span>
                  </div>
                  <h3 className="text-base font-bold mb-2">{randomNode.label}</h3>
                  <p className="text-sm text-[var(--text-secondary)] line-clamp-2">{randomNode.preview}</p>
                </div>
              </div>
              <div className="mt-4">
                <PageLink node={randomNode} className="apple-button text-sm">
                  {t('action.explore')} <ArrowRight size={14} />
                </PageLink>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const { t } = useTranslation();
  const colorMap: Record<string, string> = {
    source: 'text-apple-blue bg-apple-blue/10 border-apple-blue/20',
    entity: 'text-apple-green bg-apple-green/10 border-apple-green/20',
    concept: 'text-apple-purple bg-apple-purple/10 border-apple-purple/20',
    synthesis: 'text-apple-orange bg-apple-orange/10 border-apple-orange/20',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 border rounded-lg ${colorMap[type] || 'text-[var(--text-secondary)] bg-[var(--bg-secondary)] border-[var(--border-default)]'}`}>
      {t(typeLabelKey(type) as string)}
    </span>
  );
}

function PageCard({ node }: { node: { id: string; label: string; type: string; preview: string } }) {
  return (
    <Link
      to={getPagePath(node)}
      className="apple-card p-4 block"
    >
      <TypeBadge type={node.type} />
      <h3 className="font-bold mt-2 mb-1">{node.label}</h3>
      <p className="text-sm text-[var(--text-secondary)] line-clamp-2">{stripMarkdown(node.preview)}</p>
    </Link>
  );
}

function PageLink({ node, children, className }: { node: { id: string; type: string }; children: React.ReactNode; className?: string }) {
  return (
    <Link to={getPagePath(node)} className={className}>
      {children}
    </Link>
  );
}
