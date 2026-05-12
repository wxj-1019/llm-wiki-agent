import { Link } from 'react-router-dom';
import { Search, FileText, Zap, Plug } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import type { FuseResult } from 'fuse.js';
import type { GraphNode } from '@/types/graph';
import { typeLabelKey } from '@/i18n';
import { getPagePath } from '@/lib/wikilink';
import { Skeleton } from '@/components/ui/Skeleton';
import { HighlightText } from './HighlightText';
import { typeIcons, typeColors, typeTagColors } from './types';

interface SearchResultsTabProps {
  query: string;
  results: FuseResult<GraphNode>[];
  searching: boolean;
  onGenerate: () => void;
}

export function SearchResultsTab({ query, results, searching, onGenerate }: SearchResultsTabProps) {
  const { t } = useTranslation();

  return (
    <>
      {query && !searching && (
        <div className="mb-4 text-sm text-[var(--text-secondary)] flex items-center gap-2">
          {t('search.resultCount', { count: results.length, query })}
        </div>
      )}

      {searching && (
        <div className="space-y-3 mb-4" role="status" aria-busy="true" aria-label={t('search.searching', 'Searching')}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="apple-card p-4 flex items-start gap-4">
              <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="w-32 h-5 rounded-lg" />
                  <Skeleton className="w-16 h-4 rounded-lg" />
                </div>
                <Skeleton className="w-full h-4 rounded-lg" />
                <Skeleton className="w-5/6 h-4 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!searching && <div className="space-y-3">
        {results.map((result, i) => {
          const node = result.item;
          const Icon = typeIcons[node.type] || FileText;
          const labelMatches = result.matches?.find(m => m.key === 'label');
          const previewMatches = result.matches?.find(m => m.key === 'preview');
          return (
            <motion.div key={node.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: Math.min(i * 0.05, 0.4) }}>
              <Link to={getPagePath(node)} className="apple-card p-4 flex items-start gap-4 block group hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
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
      </div>}

      {(query && results.length === 0 && !searching) || (!query) ? (
        <div className="empty-state-warm mt-12">
          <div className="flex justify-center mb-3"><Search size={40} className="text-apple-blue" /></div>
          <h3 className="text-lg font-semibold mb-1">{query ? t('search.empty.title') : t('search.empty.hint', 'Enter keywords to search')}</h3>
          {query && <p className="text-sm text-[var(--text-secondary)]">{t('search.empty.description')}</p>}
          <div className="flex items-center justify-center gap-2 mt-4">
            <button onClick={() => onGenerate()} className="group px-4 py-2 bg-[var(--bg-secondary)] text-xs text-[var(--text-secondary)] hover:text-apple-purple hover:border-apple-purple/30 hover:bg-apple-purple/5 transition-all border border-[var(--border-default)] rounded-full flex items-center gap-1.5 min-h-[36px]">
              <Zap size={12} className="group-hover:text-apple-purple" />{t('chat.quick.genSkill', 'Generate Skill')}
            </button>
            <button onClick={() => onGenerate()} className="group px-4 py-2 bg-[var(--bg-secondary)] text-xs text-[var(--text-secondary)] hover:text-apple-green hover:border-apple-green/30 hover:bg-apple-green/5 transition-all border border-[var(--border-default)] rounded-full flex items-center gap-1.5 min-h-[36px]">
              <Plug size={12} className="group-hover:text-apple-green" />{t('chat.quick.genMcp', 'Generate MCP Server')}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
