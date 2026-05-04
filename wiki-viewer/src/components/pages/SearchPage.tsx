import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, FileText, Users, Lightbulb, Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { searchNodes } from '@/lib/search';
import { motion } from 'framer-motion';
import { typeLabelKey } from '@/i18n';
import { getPagePath } from '@/lib/wikilink';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useDebounce } from '@/hooks/useDebounce';

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
  const results = useMemo(() => {
    if (!debouncedQuery.trim()) return [];
    return searchNodes(debouncedQuery).slice(0, 50);
  }, [debouncedQuery]);

  useDocumentTitle(t('search.title'));

  useEffect(() => {
    if (!userEditedRef.current) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  return (
    <div>
      <h1 className="text-3xl font-semibold mb-6">{t('search.title')}</h1>

      <div className="relative mb-8">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
        <input
          autoFocus
          value={query}
          onChange={(e) => { setQuery(e.target.value); userEditedRef.current = true; }}
          placeholder={t('search.placeholder')}
          className="apple-input pl-9 text-lg"
        />
      </div>

      {query && (
        <div className="mb-4 text-sm text-[var(--text-secondary)]">
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
    </div>
  );
}
