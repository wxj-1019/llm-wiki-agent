import { useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Heart, Link2, Calendar, Tag } from 'lucide-react';
import { useWikiStore } from '@/stores/wikiStore';
import { MarkdownRenderer } from '@/components/content/MarkdownRenderer';
import { parseFrontmatter } from '@/lib/frontmatter';
import { motion } from 'framer-motion';

interface Props {
  type: 'source' | 'entity' | 'concept' | 'synthesis';
}

const typeNames: Record<string, string> = {
  source: 'Source',
  entity: 'Entity',
  concept: 'Concept',
  synthesis: 'Synthesis',
};

const typeColors: Record<string, string> = {
  source: 'text-apple-blue bg-apple-blue/10',
  entity: 'text-apple-green bg-apple-green/10',
  concept: 'text-apple-purple bg-apple-purple/10',
  synthesis: 'text-apple-orange bg-apple-orange/10',
};

export function PageDetailPage({ type }: Props) {
  const { slug, name } = useParams();
  const param = slug || name || '';
  const graphData = useWikiStore((s) => s.graphData);
  const addRecentPage = useWikiStore((s) => s.addRecentPage);
  const toggleFavorite = useWikiStore((s) => s.toggleFavorite);
  const isFavorite = useWikiStore((s) => s.isFavorite);
  const getBacklinks = useWikiStore((s) => s.getBacklinks);

  const node = useMemo(() => {
    if (!graphData) return null;
    return graphData.nodes.find(
      (n) => n.type === type && n.id.endsWith(`/${param}`)
    );
  }, [graphData, type, param]);

  const { meta } = node ? parseFrontmatter(node.markdown) : { meta: null };
  const backlinks = node ? getBacklinks(node.id) : [];

  useEffect(() => {
    if (node) {
      addRecentPage(node.id);
    }
  }, [node, addRecentPage]);

  if (!node) {
    return (
      <div className="empty-state-warm mt-20">
        <div className="text-4xl mb-3">📄</div>
        <h3 className="font-rounded text-lg font-semibold">Page not found</h3>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm text-[var(--text-secondary)]">
        <Link to="/browse" className="hover:text-[var(--text-primary)] flex items-center gap-1">
          <ArrowLeft size={14} /> Browse
        </Link>
        <span>/</span>
        <span className="capitalize">{type}</span>
        <span>/</span>
        <span className="text-[var(--text-primary)] font-medium">{node.label}</span>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide ${typeColors[type] || ''}`}>
            {typeNames[type]}
          </span>
          <button
            onClick={() => toggleFavorite(node.id)}
            className={`p-1.5 rounded-full transition-colors ${isFavorite(node.id) ? 'text-red-500 bg-red-500/10' : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-secondary)]'}`}
          >
            <Heart size={16} fill={isFavorite(node.id) ? 'currentColor' : 'none'} />
          </button>
        </div>
        <h1 className="text-4xl font-semibold tracking-tight mb-4">{node.label}</h1>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--text-secondary)]">
          {meta?.date && (
            <div className="flex items-center gap-1">
              <Calendar size={14} />
              {meta.date}
            </div>
          )}
          {meta?.last_updated && (
            <div className="flex items-center gap-1">
              <Calendar size={14} />
              Updated {meta.last_updated}
            </div>
          )}
          {meta?.tags && meta.tags.length > 0 && (
            <div className="flex items-center gap-1">
              <Tag size={14} />
              {meta.tags.map((tag: string) => (
                <span key={tag} className="bg-[var(--bg-secondary)] px-2 py-0.5 rounded-md text-xs">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <article className="prose prose-lg max-w-none">
        <MarkdownRenderer content={node.markdown} />
      </article>

      {/* Backlinks */}
      {backlinks.length > 0 && (
        <div className="mt-12 pt-8 border-t border-[var(--border-default)]">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Link2 size={18} />
            Linked from ({backlinks.length} pages)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {backlinks.map((link) => {
              const prefixMap: Record<string, string> = { source: 's', entity: 'e', concept: 'c', synthesis: 'y' };
              const prefix = prefixMap[link.type] || 's';
              const slug = link.id.split('/').pop() || link.id;
              return (
                <Link
                  key={link.id}
                  to={`/${prefix}/${slug}`}
                  className="apple-card p-3 flex items-center gap-3"
                >
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeColors[link.type] || ''}`}>
                    {link.type}
                  </span>
                  <span className="font-medium text-sm">{link.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}
