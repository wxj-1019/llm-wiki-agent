import { Link } from 'react-router-dom';
import { Search, FileText, Loader2, Zap, Plug } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import type { FuseResult } from 'fuse.js';
import type { GraphNode } from '@/types/graph';
import { typeLabelKey } from '@/i18n';
import { getPagePath } from '@/lib/wikilink';
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
      {query && (
        <div className="mb-4 text-sm text-[var(--text-secondary)] flex items-center gap-2">
          {searching && <Loader2 size={14} className="animate-spin" />}
          {t('search.resultCount', { count: results.length, query })}
        </div>
      )}

      <div className="space-y-3">
        {results.map((result, i) => {
          const node = result.item;
          const Icon = typeIcons[node.type] || FileText;
          const labelMatches = result.matches?.find(m => m.key === 'label');
          const previewMatches = result.matches?.find(m => m.key === 'preview');
          return (
            <motion.div key={node.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: i * 0.03 }}>
              <Link to={getPagePath(node)} className="apple-card p-4 flex items-start gap-4 block group">
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

      {query && results.length === 0 && !searching && (
        <div className="empty-state-warm mt-12">
          <div className="flex justify-center mb-3"><Search size={40} className="text-apple-blue" /></div>
          <h3 className="text-lg font-semibold mb-1">{t('search.empty.title')}</h3>
          <p className="text-sm text-[var(--text-secondary)]">{t('search.empty.description')}</p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <button onClick={() => onGenerate()} className="group px-3 py-1.5 bg-[var(--bg-secondary)] text-xs text-[var(--text-secondary)] hover:text-apple-purple hover:border-apple-purple/30 hover:bg-apple-purple/5 transition-all border border-[var(--border-default)] rounded-full flex items-center gap-1.5">
              <Zap size={11} className="group-hover:text-apple-purple" />{t('chat.quick.genSkill', 'Generate Skill')}
            </button>
            <button onClick={() => onGenerate()} className="group px-3 py-1.5 bg-[var(--bg-secondary)] text-xs text-[var(--text-secondary)] hover:text-apple-green hover:border-apple-green/30 hover:bg-apple-green/5 transition-all border border-[var(--border-default)] rounded-full flex items-center gap-1.5">
              <Plug size={11} className="group-hover:text-apple-green" />{t('chat.quick.genMcp', 'Generate MCP Server')}
            </button>
          </div>
        </div>
      )}

      {!query && (
        <div className="empty-state-warm mt-12">
          <div className="flex justify-center mb-3"><Search size={40} className="text-apple-blue" /></div>
          <h3 className="text-lg font-semibold mb-1">{t('search.empty.hint', 'Enter keywords to search')}</h3>
          <div className="flex items-center justify-center gap-2 mt-4">
            <button onClick={() => onGenerate()} className="group px-3 py-1.5 bg-[var(--bg-secondary)] text-xs text-[var(--text-secondary)] hover:text-apple-purple hover:border-apple-purple/30 transition-all border border-[var(--border-default)] rounded-full flex items-center gap-1.5">
              <Zap size={11} />{t('chat.quick.genSkill', 'Generate Skill')}
            </button>
            <button onClick={() => onGenerate()} className="group px-3 py-1.5 bg-[var(--bg-secondary)] text-xs text-[var(--text-secondary)] hover:text-apple-green hover:border-apple-green/30 transition-all border border-[var(--border-default)] rounded-full flex items-center gap-1.5">
              <Plug size={11} />{t('chat.quick.genMcp', 'Generate MCP Server')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
