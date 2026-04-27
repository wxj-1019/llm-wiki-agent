import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, FileText, Users, Lightbulb, Layers } from 'lucide-react';
import { useWikiStore } from '@/stores/wikiStore';
import { searchNodes } from '@/lib/search';
import { motion } from 'framer-motion';

const typeIcons: Record<string, React.ElementType> = {
  source: FileText,
  entity: Users,
  concept: Lightbulb,
  synthesis: Layers,
};

export function SearchPage() {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  useWikiStore((s) => s.graphData);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return searchNodes(query);
  }, [query]);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  return (
    <div>
      <h1 className="text-3xl font-semibold mb-6">Search</h1>

      <div className="relative mb-8">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search across all wiki pages..."
          className="apple-input pl-9 text-lg"
        />
      </div>

      {query && (
        <div className="mb-4 text-sm text-[var(--text-secondary)]">
          {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
        </div>
      )}

      <div className="space-y-3">
        {results.map((result, i) => {
          const node = result.item;
          const Icon = typeIcons[node.type] || FileText;
          const prefixMap: Record<string, string> = { source: 's', entity: 'e', concept: 'c', synthesis: 'y' };
          const prefix = prefixMap[node.type] || 's';
          const slug = node.id.split('/').pop() || node.id;

          return (
            <motion.div
              key={node.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.03 }}
            >
              <Link
                to={`/${prefix}/${slug}`}
                className="apple-card p-4 flex items-start gap-4 block"
              >
                <div className="p-2 rounded-lg bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{node.label}</span>
                    <span className="text-xs text-[var(--text-tertiary)] capitalize">{node.type}</span>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] line-clamp-2">{node.preview}</p>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {query && results.length === 0 && (
        <div className="empty-state-warm mt-12">
          <div className="text-4xl mb-3">🔍</div>
          <h3 className="font-rounded text-lg font-semibold mb-1">No results found</h3>
          <p className="text-sm text-[var(--text-secondary)]">Try different keywords</p>
        </div>
      )}
    </div>
  );
}
