import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, FileText, Users, Lightbulb, Layers, Loader2, BrainCircuit, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { hybridSearch, getAllNodes } from '@/lib/search';
import type { FuseResult } from 'fuse.js';
import type { GraphNode } from '@/types/graph';
import { motion } from 'framer-motion';
import { typeLabelKey } from '@/i18n';
import { getPagePath } from '@/lib/wikilink';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useDebounce } from '@/hooks/useDebounce';
import { reindexEmbeddings } from '@/services/dataService';
import { useNotificationStore } from '@/stores/notificationStore';

const typeIcons: Record<string, React.ElementType> = {
  source: FileText,
  entity: Users,
  concept: Lightbulb,
  synthesis: Layers,
};

const typeColors: Record<string, string> = {
  source: 'text-apple-blue bg-apple-blue/10',
  entity: 'text-apple-green bg-apple-green/10',
  concept: 'text-apple-purple bg-apple-purple/10',
  synthesis: 'text-apple-orange bg-apple-orange/10',
};

const typeTagColors: Record<string, string> = {
  source: 'text-apple-blue bg-apple-blue/10 border-apple-blue/20',
  entity: 'text-apple-green bg-apple-green/10 border-apple-green/20',
  concept: 'text-apple-purple bg-apple-purple/10 border-apple-purple/20',
  synthesis: 'text-apple-orange bg-apple-orange/10 border-apple-orange/20',
};

function HighlightText({ text, matches }: { text: string; matches?: ReadonlyArray<[number, number]> }) {
  if (!matches || matches.length === 0) return <>{text}</>;
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  matches.forEach(([start, end], i) => {
    if (start > lastIndex) {
      elements.push(<span key={`t-${i}`}>{text.slice(lastIndex, start)}</span>);
    }
    elements.push(
      <mark key={`h-${i}`} className="bg-apple-blue/10 text-[var(--text-primary)] px-0.5 rounded">
        {text.slice(start, end + 1)}
      </mark>
    );
    lastIndex = end + 1;
  });
  if (lastIndex < text.length) {
    elements.push(<span key="tail">{text.slice(lastIndex)}</span>);
  }
  return <>{elements}</>;
}

export function SearchPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const userEditedRef = useRef(false);

  const debouncedQuery = useDebounce(query, 200);
  const [results, setResults] = useState<FuseResult<GraphNode>[]>([]);
  const [searching, setSearching] = useState(false);
  const [semantic, setSemantic] = useState(() => {
    try { return localStorage.getItem('wiki-semantic-search') === 'true'; } catch { return false; }
  });
  const [reindexing, setReindexing] = useState(false);
  const addNotification = useNotificationStore((s) => s.addNotification);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    let cancelled = false;
    hybridSearch(debouncedQuery, getAllNodes(), semantic)
      .then((res) => {
        if (!cancelled) setResults(res.slice(0, 50));
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => { cancelled = true; };
  }, [debouncedQuery, semantic]);

  const handleToggleSemantic = useCallback(() => {
    setSemantic((prev) => {
      const next = !prev;
      try { localStorage.setItem('wiki-semantic-search', String(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const handleReindex = useCallback(async () => {
    setReindexing(true);
    try {
      const result = await reindexEmbeddings();
      addNotification(result.message || t('search.reindexSuccess'), 'success');
    } catch (e) {
      addNotification(String(e), 'error');
    } finally {
      setReindexing(false);
    }
  }, [addNotification, t]);

  useDocumentTitle(t('search.title'));

  useEffect(() => {
    if (!userEditedRef.current) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <h1 className="text-3xl font-semibold mb-6">{t('search.title')}</h1>

      <div className="relative mb-8 max-w-2xl">
        <div className="flex items-center gap-3 w-full px-6 py-4 bg-[var(--bg-secondary)] border border-[var(--border-default)] hover:border-apple-blue focus-within:border-apple-blue focus-within:shadow-[0_0_0_4px_rgba(10,132,255,0.08)] transition-all duration-200 rounded-2xl">
          <Search size={20} className="text-[var(--text-tertiary)] shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => { setQuery(e.target.value); userEditedRef.current = true; }}
            placeholder={t('search.placeholder')}
            aria-label={t('search.placeholder')}
            className="flex-1 bg-transparent outline-none text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] text-lg"
          />
        </div>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3 select-none">
          <button
            onClick={handleToggleSemantic}
            className={`relative w-10 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-apple-blue/30 ${semantic ? 'bg-apple-blue' : 'bg-[var(--border-default)]'}`}
            aria-pressed={semantic}
            aria-label={t('search.semantic')}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-[var(--bg-primary)] rounded-full shadow transition-transform ${semantic ? 'translate-x-4' : ''}`}
            />
          </button>
          <span className="text-sm text-[var(--text-secondary)] flex items-center gap-1.5">
            <BrainCircuit size={16} />
            {t('search.semantic')}
          </span>
        </div>
        <button
          onClick={handleReindex}
          disabled={reindexing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--text-tertiary)] hover:text-apple-blue hover:bg-apple-blue/10 rounded-xl transition-all active:scale-[0.97] disabled:opacity-50"
          title={t('search.reindex')}
        >
          {reindexing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {t('search.reindex')}
        </button>
      </div>

      {query && (
        <div className="mb-4 text-sm text-[var(--text-secondary)] flex items-center gap-2" aria-live="polite">
          {searching && <Loader2 size={14} className="animate-spin" />}
          {t('search.resultCount', { count: results.length, query })}
        </div>
      )}

      <div className="space-y-3">
        {results.map((result, i) => {
          const node = result.item;
          const Icon = typeIcons[node.type] || FileText;

          const labelMatches = result.matches?.find((m) => m.key === 'label');
          const previewMatches = result.matches?.find((m) => m.key === 'preview');

          return (
            <motion.div
              key={node.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.03 }}
            >
              <Link
                to={getPagePath(node)}
                className="apple-card p-4 flex items-start gap-4 block group"
              >
                <div className={`p-2.5 rounded-xl shrink-0 ${typeColors[node.type] || 'text-apple-blue bg-apple-blue/10'}`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold group-hover:text-apple-blue transition-colors">
                      <HighlightText text={node.label} matches={labelMatches?.indices} />
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-lg border ${typeTagColors[node.type] || 'text-[var(--text-secondary)] bg-[var(--bg-secondary)] border-[var(--border-default)]'}`}>
                      {t(typeLabelKey(node.type) as string)}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] line-clamp-2">
                    <HighlightText text={node.preview} matches={previewMatches?.indices} />
                  </p>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {query && results.length === 0 && (
        <div className="empty-state-warm mt-12">
          <div className="flex justify-center mb-3">
            <Search size={40} className="text-apple-blue" />
          </div>
          <h3 className="text-lg font-semibold mb-1">{t('search.empty.title')}</h3>
          <p className="text-sm text-[var(--text-secondary)]">{t('search.empty.description')}</p>
        </div>
      )}
    </motion.div>
  );
}
