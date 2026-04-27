import { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, FileText, Users, Lightbulb, Layers } from 'lucide-react';
import { useWikiStore } from '@/stores/wikiStore';
import { motion } from 'framer-motion';

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
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get('t') || 'all';
  const [filterType, setFilterType] = useState(initialType);
  const [query, setQuery] = useState('');
  const graphData = useWikiStore((s) => s.graphData);
  const nodes = graphData?.nodes || [];

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
    return result;
  }, [nodes, filterType, query]);

  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'source', label: 'Sources' },
    { key: 'entity', label: 'Entities' },
    { key: 'concept', label: 'Concepts' },
    { key: 'synthesis', label: 'Syntheses' },
  ];

  return (
    <div>
      <h1 className="text-3xl font-semibold mb-6">Browse Library</h1>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter pages..."
          className="apple-input pl-9"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-[var(--bg-secondary)] rounded-xl w-fit">
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
            {tab.label}
          </button>
        ))}
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
          <div className="text-4xl mb-3">🔍</div>
          <h3 className="font-rounded text-lg font-semibold mb-1">No pages found</h3>
          <p className="text-sm text-[var(--text-secondary)]">Try a different search term</p>
        </div>
      )}
    </div>
  );
}

function PageCard({ node }: { node: { id: string; label: string; type: string; preview: string; tags?: string[] } }) {
  const Icon = typeIcons[node.type] || FileText;
  const colorClass = typeColors[node.type] || 'text-gray-600 bg-gray-100';
  const prefixMap: Record<string, string> = { source: 's', entity: 'e', concept: 'c', synthesis: 'y' };
  const prefix = prefixMap[node.type] || 's';
  const slug = node.id.split('/').pop() || node.id;

  return (
    <Link
      to={`/${prefix}/${slug}`}
      className="apple-card p-5 block group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${colorClass}`}>
          <Icon size={16} />
        </div>
        <span className="text-xs text-[var(--text-tertiary)] capitalize">{node.type}</span>
      </div>
      <h3 className="font-semibold text-lg mb-2 group-hover:text-apple-blue transition-colors">
        {node.label}
      </h3>
      <p className="text-sm text-[var(--text-secondary)] line-clamp-3 leading-relaxed">
        {node.preview}
      </p>
    </Link>
  );
}
