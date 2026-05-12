import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, ChevronDown, ChevronRight,
  Sparkles,
} from 'lucide-react';

interface TopPattern {
  pattern: string;
  count: number;
}

interface LearningData {
  total_lessons: number;
  categories: Record<string, number>;
  top_patterns: TopPattern[];
  confidence_distribution: Record<string, number>;
}

const CATEGORY_COLORS: Record<string, string> = {
  health: 'var(--apple-green)',
  ingest: 'var(--apple-blue)',
  graph: 'var(--apple-teal)',
  lint: 'var(--apple-orange)',
  heal: 'var(--apple-pink)',
  query: 'var(--apple-purple)',
  refresh: 'var(--apple-yellow)',
  tool_call: 'var(--apple-indigo)',
  approval: 'var(--apple-red)',
  evolution: 'var(--glow-cyan)',
  planning: 'var(--marshmallow-lavender)',
  reflection: 'var(--marshmallow-mint)',
};

const CATEGORY_ICONS: Record<string, string> = {
  health: '\u{1F3E5}',
  ingest: '\u{1F4E5}',
  graph: '\u{1F578}',
  lint: '\u{1F50D}',
  heal: '\u{1FA79}',
  query: '\u{2753}',
  refresh: '\u{1F504}',
  tool_call: '\u{1F527}',
  approval: '\u{1F6E1}',
  evolution: '\u{1F331}',
  planning: '\u{1F4CB}',
  reflection: '\u{1F4A1}',
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'var(--apple-green)',
  medium: 'var(--apple-orange)',
  low: 'var(--apple-red)',
};

const CONFIDENCE_LABELS: Record<string, string> = {
  high: '\u{2705} High',
  medium: '\u{26A0} Medium',
  low: '\u{274C} Low',
};

export function LearningInsights() {
  const [data, setData] = useState<LearningData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAllPatterns, setShowAllPatterns] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/jarvis/learning');
      if (!res.ok) return;
      const json = await res.json();
      const raw = json?.data ?? json;
      if (raw && typeof raw === 'object') {
        setData({
          total_lessons: (raw as LearningData).total_lessons ?? 0,
          categories: (raw as LearningData).categories ?? {},
          top_patterns: (raw as LearningData).top_patterns ?? [],
          confidence_distribution: (raw as LearningData).confidence_distribution ?? {},
        });
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="glass p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Brain size={14} className="animate-pulse" style={{ color: 'var(--marshmallow-lavender)' }} />
          <span className="text-xs font-mono-data" style={{ color: 'var(--text-tertiary)' }}>
            LOADING INSIGHTS...
          </span>
        </div>
      </div>
    );
  }

  if (!data || data.total_lessons === 0) {
    return (
      <div className="glass p-4">
        <div className="flex items-center gap-2 mb-2">
          <Brain size={14} style={{ color: 'var(--marshmallow-lavender)' }} />
          <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
            Learning Insights
          </span>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          No lessons learned yet. Execute tasks to build agent intelligence.
        </p>
      </div>
    );
  }

  const sortedCategories = Object.entries(data.categories)
    .sort(([, a], [, b]) => b - a);
  const visibleCategories = showAllCategories ? sortedCategories : sortedCategories.slice(0, 6);
  const maxCategoryCount = Math.max(...sortedCategories.map(([, c]) => c), 1);

  const visiblePatterns = showAllPatterns ? data.top_patterns : data.top_patterns.slice(0, 5);

  const confTotal = Object.values(data.confidence_distribution).reduce((a, b) => a + b, 0);

  return (
    <div className="glass p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain size={14} style={{ color: 'var(--marshmallow-lavender)' }} />
          <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
            Learning Insights
          </span>
        </div>
        <span className="text-[10px] font-mono-data px-2 py-0.5 rounded-full"
          style={{ backgroundColor: 'rgba(100,210,255,0.1)', color: 'var(--apple-teal)' }}>
          {data.total_lessons} lessons
        </span>
      </div>

      {/* Confidence Distribution */}
      {confTotal > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono-data" style={{ color: 'var(--text-tertiary)' }}>
            CONFIDENCE DISTRIBUTION
          </span>
          <div className="flex gap-1 h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            {Object.entries(data.confidence_distribution).map(([key, count]) => (
              <motion.div
                key={key}
                initial={{ width: 0 }}
                animate={{ width: `${(count / confTotal) * 100}%` }}
                transition={{ duration: 0.5 }}
                className="h-full rounded-full"
                style={{ backgroundColor: CONFIDENCE_COLORS[key] || 'var(--text-tertiary)' }}
                title={`${key}: ${count} (${Math.round((count / confTotal) * 100)}%)`}
              />
            ))}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {Object.entries(data.confidence_distribution).map(([key, count]) => (
              <div key={key} className="inline-flex items-center gap-1 text-[9px] font-mono-data"
                style={{ color: CONFIDENCE_COLORS[key] || 'var(--text-tertiary)' }}>
                <span>{CONFIDENCE_LABELS[key] || key}</span>
                <span className="font-bold">{Math.round((count / confTotal) * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Breakdown */}
      <div className="space-y-1.5">
        <span className="text-[10px] font-mono-data" style={{ color: 'var(--text-tertiary)' }}>
          KNOWLEDGE CATEGORIES
        </span>
        <div className="space-y-1">
          <AnimatePresence>
            {visibleCategories.map(([category, count], i) => (
              <motion.div
                key={category}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-2"
              >
                <span className="text-[10px] w-4">{CATEGORY_ICONS[category] || '\u{1F4CC}'}</span>
                <span className="text-[10px] font-mono-data w-20 truncate" style={{ color: 'var(--text-secondary)' }}>
                  {category}
                </span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(count / maxCategoryCount) * 100}%` }}
                    transition={{ duration: 0.4, delay: i * 0.03 }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[category] || 'var(--text-tertiary)' }}
                  />
                </div>
                <span className="text-[10px] font-mono-data font-bold w-6 text-right" style={{ color: 'var(--text-primary)' }}>
                  {count}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        {sortedCategories.length > 6 && (
          <button
            onClick={() => setShowAllCategories(!showAllCategories)}
            className="flex items-center gap-1 text-[10px] font-mono-data hover:underline"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {showAllCategories ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            {showAllCategories ? 'Show less' : `+${sortedCategories.length - 6} more`}
          </button>
        )}
      </div>

      {/* Top Patterns */}
      {data.top_patterns.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono-data" style={{ color: 'var(--text-tertiary)' }}>
            TOP PATTERNS
          </span>
          <div className="space-y-1">
            {visiblePatterns.map((p, i) => (
              <motion.div
                key={p.pattern}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-start gap-2 text-[10px] p-1.5 rounded"
                style={{ backgroundColor: 'var(--bg-tertiary)' }}
              >
                <Sparkles size={10} style={{ color: 'var(--apple-yellow)', flexShrink: 0, marginTop: 1 }} />
                <span className="flex-1" style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {p.pattern}
                </span>
                <span className="font-mono-data font-bold shrink-0 px-1 py-0.5 rounded"
                  style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                  x{p.count}
                </span>
              </motion.div>
            ))}
          </div>
          {data.top_patterns.length > 5 && (
            <button
              onClick={() => setShowAllPatterns(!showAllPatterns)}
              className="flex items-center gap-1 text-[10px] font-mono-data hover:underline"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {showAllPatterns ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              {showAllPatterns ? 'Show less' : `+${data.top_patterns.length - 5} more`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
