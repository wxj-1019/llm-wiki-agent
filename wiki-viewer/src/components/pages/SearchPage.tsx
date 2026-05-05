import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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

function HighlightText({ text, matches }: { text: string; matches?: ReadonlyArray<[number, number]> }) {
  if (!matches || matches.length === 0) return <>{text}</>;
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  matches.forEach(([start, end], i) => {
    if (start > lastIndex) {
      elements.push(<span key={`t-${i}`}>{text.slice(lastIndex, start)}</span>);
    }
    elements.push(
      <mark key={`h-${i}`} className="bg-apple-blue/15 text-[var(--text-primary)] px-0.5 rounded">
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

      <div className="relative mb-8">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
        <input
          autoFocus
          value={query}
          onChange={(e) => { setQuery(e.target.value); userEditedRef.current = true; }}
          placeholder={t('search.placeholder')}
          aria-label={t('search.placeholder')}
          className="apple-input pl-9 text-lg"
        />
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 select-none">
          <button
            onClick={handleToggleSemantic}
            className={`relative w-9 h-5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-apple-blue/30 ${semantic ? 'bg-apple-blue' : 'bg-[var(--border-default)]'}`}
            aria-pressed={semantic}
            aria-label={t('search.semantic')}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${semantic ? 'translate-x-4' : ''}`}
            />
          </button>
          <span className="text-sm text-[var(--text-secondary)] flex items-center gap-1.5">
            <BrainCircuit size={14} />
            {t('search.semantic')}
          </span>
        </div>
        <button
          onClick={handleReindex}
          disabled={reindexing}
          className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] hover:text-apple-blue transition-colors disabled:opacity-50"
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
                className="apple-card p-4 flex items-start gap-4 block"
              >
                <div className="p-2 rounded-xl bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">
                      <HighlightText text={node.label} matches={labelMatches?.indices} />
                    </span>
                    <span className="text-xs text-[var(--text-tertiary)] capitalize">{t(typeLabelKey(node.type) as string)}</span>
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
