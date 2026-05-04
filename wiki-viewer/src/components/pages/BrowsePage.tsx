import { useState, useMemo, useEffect, memo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, FileText, Users, Lightbulb, Layers, X, BookOpen, Heart, Link2, ArrowUpDown, Inbox } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWikiStore } from '@/stores/wikiStore';
import { motion, AnimatePresence } from 'framer-motion';
import { typeLabelKey } from '@/i18n';
import { getPagePath } from '@/lib/wikilink';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useDebounce } from '@/hooks/useDebounce';
import { BrowseSkeleton } from '@/components/ui/Skeleton';

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

export function BrowsePage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get('t') || 'all';
  const [filterType, setFilterType] = useState(initialType);
  useDocumentTitle(t('browse.title'));

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 200);
  const [sortBy, setSortBy] = useState<'default' | 'name' | 'connected'>('default');

  const typeParam = searchParams.get('t');
  useEffect(() => {
    setFilterType(typeParam || 'all');
  }, [typeParam]);
  const [sortOpen, setSortOpen] = useState(false);
  const graphData = useWikiStore((s) => s.graphData);
  const loading = useWikiStore((s) => s.loading);
  const nodes = useMemo(() => graphData?.nodes || [], [graphData]);
  const getBacklinks = useWikiStore((s) => s.getBacklinks);

  const filtered = useMemo(() => {
    let result = nodes;
    if (filterType !== 'all') {
      result = result.filter((n) => n.type === filterType);
    }
    if (debouncedQuery.trim()) {
      const q = debouncedQuery.toLowerCase();
      result = result.filter(
        (n) =>
          n.label.toLowerCase().includes(q) ||
          n.preview.toLowerCase().includes(q)
      );
    }
    if (sortBy === 'name') {
      result = [...result].sort((a, b) => a.label.localeCompare(b.label));
    } else if (sortBy === 'connected') {
      const countMap = new Map<string, number>();
      result.forEach((n) => countMap.set(n.id, getBacklinks(n.id).length));
      result = [...result].sort((a, b) => (countMap.get(b.id) || 0) - (countMap.get(a.id) || 0));
    }
    return result;
  }, [nodes, filterType, debouncedQuery, sortBy, getBacklinks]);

  const tabs = [
    { key: 'all', labelKey: 'browse.filterAll' },
    { key: 'source', labelKey: 'type.source' },
    { key: 'entity', labelKey: 'type.entity' },
    { key: 'concept', labelKey: 'type.concept' },
    { key: 'synthesis', labelKey: 'type.synthesis' },
  ];

  if (loading) {
    return <BrowseSkeleton />;
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold mb-6">{t('browse.title')}</h1>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('browse.filterPlaceholder')}
          className="apple-input pl-9"
        />
      </div>

      {/* Tabs + Sort */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex gap-1 p-1 bg-[var(--bg-secondary)] rounded-xl w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterType(tab.key)}
              className={`px-4 py-1.5 text-sm font-medium transition-all duration-150 rounded-lg ${
                filterType === tab.key
                  ? 'bg-[var(--bg-primary)] text-apple-blue shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {t(tab.labelKey as string)}
            </button>
          ))}
        </div>

        <div className="relative">
          <button
            onClick={() => setSortOpen(!sortOpen)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-default)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors rounded-xl"
          >
            <ArrowUpDown size={14} />
            <span className="hidden sm:inline">{t('browse.sort.label')}: {t(`browse.sort.${sortBy}`)}</span>
          </button>
          <AnimatePresence>
            {sortOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="fixed inset-0 z-40"
                  onClick={() => setSortOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 py-1 bg-[var(--bg-primary)] border border-[var(--border-default)] min-w-[160px] z-50 origin-top-right rounded-xl"
                >
              {(['default', 'name', 'connected'] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => setSortBy(key)}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-[var(--bg-secondary)] transition-colors rounded-lg ${
                    sortBy === key ? 'text-apple-blue font-medium' : 'text-[var(--text-secondary)]'
                  }`}
                >
                  {t(`browse.sort.${key}`)}
                </button>
              ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((node, i) => {
          const useMotion = filtered.length <= 20;
          const card = <PageCard node={node} backlinks={getBacklinks(node.id)} />;
          if (!useMotion) {
            return (
              <div key={node.id}>
                {card}
              </div>
            );
          }
          return (
            <motion.div
              key={node.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.03 }}
            >
              {card}
            </motion.div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="empty-state-warm mt-12">
          {nodes.length === 0 ? (
            <>
              <div className="flex justify-center mb-4">
                <Inbox size={48} className="text-apple-blue" />
              </div>
              <h3 className="text-lg font-bold mb-2">{t('browse.empty.noData.title')}</h3>
              <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-sm">{t('browse.empty.noData.description')}</p>
              <Link to="/" className="apple-button">
                <BookOpen size={16} />
                {t('browse.empty.noData.cta')}
              </Link>
            </>
          ) : (
            <>
              <div className="flex justify-center mb-3">
                <Search size={40} className="text-apple-blue" />
              </div>
              <h3 className="text-base font-bold mb-1">{t('browse.empty.title')}</h3>
              <p className="text-sm text-[var(--text-secondary)] mb-4">{t('browse.empty.description')}</p>
              {(query.trim() || filterType !== 'all') && (
                <button
                  onClick={() => { setQuery(''); setFilterType('all'); }}
                  className="apple-button text-sm"
                >
                  <X size={14} />
                  {t('browse.empty.noResults.clearFilters')}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const PageCard = memo(function PageCard({ node, backlinks }: { node: { id: string; label: string; type: string; preview: string }; backlinks: { id: string; label: string; type: string; preview: string }[] }) {
  const { t } = useTranslation();
  const Icon = typeIcons[node.type] || FileText;

  const isFav = useWikiStore((s) => s.isFavorite(node.id));

  // Signal strength indicator based on backlink count
  const signalStrength = backlinks.length >= 5 ? 3 : backlinks.length >= 2 ? 2 : 1;

  const typeHoverShadow: Record<string, string> = {
    source: 'hover:shadow-blue-100/50',
    entity: 'hover:shadow-green-100/50',
    concept: 'hover:shadow-purple-100/50',
    synthesis: 'hover:shadow-orange-100/50',
  };

  return (
    <Link
      to={getPagePath(node)}
      className={`apple-card p-5 block group ${typeHoverShadow[node.type] || 'hover:shadow-blue-100/50'}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-xl ${typeColors[node.type] || 'text-apple-blue bg-apple-blue/10'}`}>
          <Icon size={16} />
        </div>
        <div className="flex items-center gap-2">
          {/* Signal strength bars */}
          <div className="flex items-end gap-[2px] h-3">
            {[1, 2, 3].map((level) => (
              <div
                key={level}
                className={`w-[3px] rounded-full ${
                  level <= signalStrength
                    ? 'bg-apple-blue'
                    : 'bg-[var(--border-default)]'
                }`}
                style={{ height: `${level * 4}px` }}
              />
            ))}
          </div>
          <span className="text-xs text-[var(--text-tertiary)] font-medium">{t(typeLabelKey(node.type) as string)}</span>
        </div>
      </div>
      <h3 className="font-bold text-base mb-2 group-hover:text-apple-blue transition-colors">
        {node.label}
      </h3>
      <p className="text-sm text-[var(--text-secondary)] line-clamp-3 leading-relaxed mb-3">
        {node.preview}
      </p>
      <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)]">
        <div className="flex items-center gap-2 ml-auto">
          {isFav && <Heart size={12} className="text-apple-pink" fill="currentColor" />}
          {backlinks.length > 0 && (
            <span className="flex items-center gap-0.5">
              <Link2 size={12} />
              {t('browse.card.links', { count: backlinks.length })}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
});
