import { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, FileText, Users, Lightbulb, Layers, X, BookOpen, Heart, Link2, ArrowUpDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWikiStore } from '@/stores/wikiStore';
import { motion } from 'framer-motion';
import { typeLabelKey } from '@/i18n';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

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
  const [sortBy, setSortBy] = useState<'default' | 'name' | 'connected'>('default');

  useEffect(() => {
    const t = searchParams.get('t') || 'all';
    setFilterType(t);
  }, [searchParams]);
  const [sortOpen, setSortOpen] = useState(false);
  const graphData = useWikiStore((s) => s.graphData);
  const nodes = graphData?.nodes || [];
  const getBacklinks = useWikiStore((s) => s.getBacklinks);

  const filtered = useMemo(() => {
    let result = nodes;
    if (filterType !== 'all') {
      result = result.filter((n) => n.type === filterType);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
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
  }, [nodes, filterType, query, sortBy, getBacklinks]);

  const tabs = [
    { key: 'all', labelKey: 'browse.filterAll' },
    { key: 'source', labelKey: 'type.source' },
    { key: 'entity', labelKey: 'type.entity' },
    { key: 'concept', labelKey: 'type.concept' },
    { key: 'synthesis', labelKey: 'type.synthesis' },
  ];

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
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                filterType === tab.key
                  ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>

        <div className="relative">
          <button
            onClick={() => setSortOpen(!sortOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ArrowUpDown size={14} />
            <span className="hidden sm:inline">{t('browse.sort.label')}: {t(`browse.sort.${sortBy}`)}</span>
          </button>
          {sortOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setSortOpen(false)} />
              <div className="absolute right-0 top-full mt-2 py-1 glass rounded-xl shadow-apple-lg min-w-[160px] z-50">
            {(['default', 'name', 'connected'] as const).map((key) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-[var(--bg-secondary)] transition-colors ${
                  sortBy === key ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-secondary)]'
                }`}
              >
                {t(`browse.sort.${key}`)}
              </button>
            ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((node, i) => (
          <motion.div
            key={node.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.03 }}
          >
            <PageCard node={node} />
          </motion.div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="empty-state-warm mt-12">
          {nodes.length === 0 ? (
            <>
              <div className="text-5xl mb-4">📖</div>
              <h3 className="font-rounded text-xl font-semibold mb-2">{t('browse.empty.noData.title')}</h3>
              <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-sm">{t('browse.empty.noData.description')}</p>
              <Link to="/" className="apple-button-warm">
                <BookOpen size={16} />
                {t('browse.empty.noData.cta')}
              </Link>
            </>
          ) : (
            <>
              <div className="text-4xl mb-3">🔍</div>
              <h3 className="font-rounded text-lg font-semibold mb-1">{t('browse.empty.title')}</h3>
              <p className="text-sm text-[var(--text-secondary)] mb-4">{t('browse.empty.description')}</p>
              {(query.trim() || filterType !== 'all') && (
                <button
                  onClick={() => { setQuery(''); setFilterType('all'); }}
                  className="apple-button-warm text-sm"
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

function PageCard({ node }: { node: { id: string; label: string; type: string; preview: string } }) {
  const { t } = useTranslation();
  const Icon = typeIcons[node.type] || FileText;
  const colorClass = typeColors[node.type] || 'text-gray-600 bg-gray-100';
  const prefixMap: Record<string, string> = { source: 's', entity: 'e', concept: 'c', synthesis: 'y' };
  const prefix = prefixMap[node.type] || 's';
  const slug = node.id.split('/').pop() || node.id;
  const isFav = useWikiStore((s) => s.isFavorite(node.id));
  const backlinks = useWikiStore((s) => s.getBacklinks(node.id));

  return (
    <Link
      to={`/${prefix}/${slug}`}
      className="apple-card p-5 block group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${colorClass}`}>
          <Icon size={16} />
        </div>
        <span className="text-xs text-[var(--text-tertiary)] capitalize">{t(typeLabelKey(node.type))}</span>
      </div>
      <h3 className="font-semibold text-lg mb-2 group-hover:text-apple-blue transition-colors">
        {node.label}
      </h3>
      <p className="text-sm text-[var(--text-secondary)] line-clamp-3 leading-relaxed mb-3">
        {node.preview}
      </p>
      <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)]">
        <div className="flex items-center gap-2 ml-auto">
          {isFav && <Heart size={12} className="text-red-500" fill="currentColor" />}
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
}
