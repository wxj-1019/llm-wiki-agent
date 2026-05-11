import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lightbulb, ChevronDown, ChevronRight, ArrowRight,
  AlertTriangle, RefreshCw, Plus, Sparkles, Zap,
  FileText, Link2, Wrench, Target,
} from 'lucide-react';

interface HealthData {
  empty_stubs: string[];
  missing_index: string[];
  unindexed_files: string[];
  missing_log: string[];
  extra_index: string[];
}

interface LearningData {
  total_lessons: number;
  categories: Record<string, number>;
  top_patterns: { pattern: string; count: number }[];
  confidence_distribution: Record<string, number>;
}

interface Suggestion {
  id: string;
  type: 'fix' | 'improve' | 'learn' | 'optimize';
  priority: 'high' | 'medium' | 'low';
  icon: React.ElementType;
  title: string;
  description: string;
  action?: string;
  actionLabel?: string;
}

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  fix: { bg: 'rgba(255,69,58,0.06)', border: 'rgba(255,69,58,0.15)', text: 'var(--apple-red)' },
  improve: { bg: 'rgba(255,159,10,0.06)', border: 'rgba(255,159,10,0.15)', text: 'var(--apple-orange)' },
  learn: { bg: 'rgba(100,210,255,0.06)', border: 'rgba(100,210,255,0.15)', text: 'var(--apple-teal)' },
  optimize: { bg: 'rgba(48,209,88,0.06)', border: 'rgba(48,209,88,0.15)', text: 'var(--apple-green)' },
};

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

export function SmartSuggestions() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [learning, setLearning] = useState<LearningData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [executingAction, setExecutingAction] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [healthRes, learningRes] = await Promise.all([
        fetch('/api/health/json').catch(() => null),
        fetch('/api/jarvis/learning').catch(() => null),
      ]);

      if (healthRes?.ok) {
        const hJson = await healthRes.json();
        setHealth(hJson?.data ?? hJson ?? null);
      }
      if (learningRes?.ok) {
        const lJson = await learningRes.json();
        const raw = lJson?.data ?? lJson;
        if (raw && typeof raw === 'object') {
          setLearning(raw as LearningData);
        }
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const suggestions = useMemo<Suggestion[]>(() => {
    const list: Suggestion[] = [];

    if (health) {
      if (health.empty_stubs?.length > 0) {
        list.push({
          id: 'fix-stubs',
          type: 'fix',
          priority: 'high',
          icon: AlertTriangle,
          title: `${health.empty_stubs.length} Empty Page Stubs`,
          description: `Pages with no content: ${health.empty_stubs.slice(0, 3).join(', ')}${health.empty_stubs.length > 3 ? '...' : ''}`,
          action: 'heal',
          actionLabel: 'Run Heal',
        });
      }
      if (health.unindexed_files?.length > 0) {
        list.push({
          id: 'fix-unindexed',
          type: 'fix',
          priority: 'high',
          icon: FileText,
          title: `${health.unindexed_files.length} Unindexed Pages`,
          description: `Pages missing from wiki/index.md. Run sync to fix.`,
          action: 'health',
          actionLabel: 'Run Health',
        });
      }
      if (health.missing_index?.length > 0) {
        list.push({
          id: 'fix-missing-index',
          type: 'fix',
          priority: 'medium',
          icon: Link2,
          title: `${health.missing_index.length} Index Mismatches`,
          description: 'Index references pages that no longer exist on disk.',
          action: 'health',
          actionLabel: 'Sync Index',
        });
      }
      if (health.missing_log?.length > 0) {
        list.push({
          id: 'fix-missing-log',
          type: 'improve',
          priority: 'low',
          icon: FileText,
          title: `${health.missing_log.length} Missing Log Entries`,
          description: 'Source pages without corresponding ingest log entries.',
          action: 'health',
          actionLabel: 'Run Health',
        });
      }
    }

    if (learning) {
      const lowConf = learning.confidence_distribution?.low ?? 0;
      const total = Object.values(learning.confidence_distribution ?? {}).reduce((a, b) => a + b, 0);
      if (total > 0 && lowConf / total > 0.3) {
        list.push({
          id: 'learn-low-confidence',
          type: 'learn',
          priority: 'medium',
          icon: Target,
          title: 'High Low-Confidence Ratio',
          description: `${Math.round((lowConf / total) * 100)}% of recent decisions had low confidence. Consider providing more context.`,
        });
      }

      const topCat = Object.entries(learning.categories ?? {}).sort(([, a], [, b]) => b - a)[0];
      if (topCat && topCat[1] > 10) {
        list.push({
          id: 'learn-domain-expertise',
          type: 'optimize',
          priority: 'low',
          icon: Sparkles,
          title: `Domain Expertise: ${topCat[0]}`,
          description: `${topCat[1]} lessons in ${topCat[0]}. Agent is developing specialization.`,
        });
      }
    }

    if (list.length === 0) {
      list.push({
        id: 'all-good',
        type: 'optimize',
        priority: 'low',
        icon: Sparkles,
        title: 'System Healthy',
        description: 'No immediate issues detected. Agent is operating normally.',
      });
    }

    return list.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  }, [health, learning]);

  const handleAction = useCallback(async (action: string) => {
    setExecutingAction(action);
    try {
      const endpoint = action === 'heal'
        ? '/api/jarvis/tools/heal_wiki'
        : action === 'health'
        ? '/api/health/json'
        : `/api/jarvis/tools/${action}`;
      await fetch(endpoint, { method: action === 'health' ? 'GET' : 'POST' });
      setTimeout(fetchData, 2000);
    } catch {
      // silent
    } finally {
      setExecutingAction(null);
    }
  }, [fetchData]);

  const visibleSuggestions = showAll ? suggestions : suggestions.slice(0, 4);

  if (loading) {
    return (
      <div className="glass p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Lightbulb size={14} className="animate-pulse" style={{ color: 'var(--apple-yellow)' }} />
          <span className="text-xs font-mono-data" style={{ color: 'var(--text-tertiary)' }}>
            ANALYZING...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="glass p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb size={14} style={{ color: 'var(--apple-yellow)' }} />
          <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
            Smart Suggestions
          </span>
        </div>
        <span className="text-[10px] font-mono-data px-2 py-0.5 rounded-full"
          style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}>
          {suggestions.length} items
        </span>
      </div>

      <div className="space-y-1.5">
        <AnimatePresence>
          {visibleSuggestions.map((s, i) => {
            const colors = TYPE_COLORS[s.type];
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-lg p-2.5 transition-colors"
                style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}` }}
              >
                <div className="flex items-start gap-2">
                  <s.icon size={12} style={{ color: colors.text, flexShrink: 0, marginTop: 2 }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono-data font-semibold truncate" style={{ color: colors.text }}>
                        {s.title}
                      </span>
                      {s.priority === 'high' && (
                        <span className="text-[8px] font-mono-data font-bold px-1 py-0.5 rounded"
                          style={{ backgroundColor: 'rgba(255,69,58,0.1)', color: 'var(--apple-red)' }}>
                          HIGH
                        </span>
                      )}
                    </div>
                    <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {s.description}
                    </p>
                    {s.action && (
                      <button
                        onClick={() => handleAction(s.action!)}
                        disabled={executingAction === s.action}
                        className="flex items-center gap-1 mt-1.5 text-[9px] font-mono-data font-medium px-2 py-0.5 rounded transition-colors"
                        style={{ color: colors.text, backgroundColor: 'rgba(255,255,255,0.05)' }}
                      >
                        {executingAction === s.action ? (
                          <RefreshCw size={8} className="animate-spin" />
                        ) : (
                          <Zap size={8} />
                        )}
                        {s.actionLabel ?? 'Execute'}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {suggestions.length > 4 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="flex items-center gap-1 text-[10px] font-mono-data w-full justify-center py-1 hover:underline"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {showAll ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          {showAll ? 'Show less' : `+${suggestions.length - 4} more suggestions`}
        </button>
      )}
    </div>
  );
}
