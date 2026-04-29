import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Heart, Link2, Calendar, Tag, List } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';
import i18n from '@/i18n';
import { useWikiStore } from '@/stores/wikiStore';
import { MarkdownRenderer } from '@/components/content/MarkdownRenderer';
import { parseFrontmatter } from '@/lib/frontmatter';
import { motion } from 'framer-motion';
import { typeLabelKey } from '@/i18n';
import { getPagePath } from '@/lib/wikilink';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

interface Props {
  type: 'source' | 'entity' | 'concept' | 'synthesis';
}

function formatDate(dateStr: string): string {
  const locale = i18n.language === 'zh-CN' ? zhCN : enUS;
  return format(parseISO(dateStr), 'PPP', { locale });
}

const typeColors: Record<string, string> = {
  source: 'text-apple-blue bg-apple-blue/10',
  entity: 'text-apple-green bg-apple-green/10',
  concept: 'text-apple-purple bg-apple-purple/10',
  synthesis: 'text-apple-orange bg-apple-orange/10',
};

export function PageDetailPage({ type }: Props) {
  const { t } = useTranslation();
  const { slug, name } = useParams();
  const param = slug || name || '';
  const graphData = useWikiStore((s) => s.graphData);
  const addRecentPage = useWikiStore((s) => s.addRecentPage);
  const toggleFavorite = useWikiStore((s) => s.toggleFavorite);
  const isFavorite = useWikiStore((s) => s.isFavorite);
  const getBacklinks = useWikiStore((s) => s.getBacklinks);
  const readingProgress = useWikiStore((s) => s.readingProgress);
  const setReadingProgress = useWikiStore((s) => s.setReadingProgress);
  const progressRef = useRef(0);

  const node = useMemo(() => {
    if (!graphData) return null;
    return graphData.nodes.find(
      (n) => n.type === type && n.id.endsWith(`/${param}`)
    );
  }, [graphData, type, param]);

  const { meta, body } = node ? parseFrontmatter(node.markdown) : { meta: null, body: '' };
  const backlinks = node ? getBacklinks(node.id) : [];

  useEffect(() => {
    if (node) {
      addRecentPage(node.id);
    }
  }, [node, addRecentPage]);

  // Restore scroll position (only on node change, not on every progress update)
  useEffect(() => {
    if (!node) return;
    const saved = readingProgress[node.id];
    if (saved && saved > 0 && saved < 1) {
      window.scrollTo(0, 0); // scroll to top first to ensure correct scrollHeight
      requestAnimationFrame(() => {
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (docHeight > 0) {
          const target = saved * docHeight;
          window.scrollTo({ top: target, behavior: 'instant' as ScrollBehavior });
        }
      });
    }
  }, [node]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track scroll progress
  useEffect(() => {
    if (!node) return;
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;
      const progress = Math.min(1, Math.max(0, scrollTop / docHeight));
      if (Math.abs(progress - progressRef.current) > 0.01) {
        progressRef.current = progress;
        setReadingProgress(node.id, progress);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [node, setReadingProgress]);

  useDocumentTitle(node?.label);

  if (!node) {
    return (
      <div className="empty-state-warm mt-20">
        <div className="text-4xl mb-3">📄</div>
        <h3 className="font-rounded text-lg font-semibold">{t('detail.notFound')}</h3>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Reading Progress */}
      {node && (
        <div className="fixed top-14 left-0 right-0 z-40 h-[2px] bg-[var(--bg-secondary)]">
          <div
            className="h-full bg-apple-blue transition-all duration-150"
            style={{ width: `${(readingProgress[node.id] || 0) * 100}%` }}
          />
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm text-[var(--text-secondary)]">
        <Link to="/browse" className="hover:text-[var(--text-primary)] flex items-center gap-1">
          <ArrowLeft size={14} /> {t('detail.breadcrumb.browse')}
        </Link>
        <span>/</span>
        <span className="capitalize">{t(typeLabelKey(type))}</span>
        <span>/</span>
        <span className="text-[var(--text-primary)] font-medium">{node.label}</span>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide ${typeColors[type] || ''}`}>
            {t(typeLabelKey(type))}
          </span>
          <button
            onClick={() => toggleFavorite(node.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
              isFavorite(node.id)
                ? 'text-red-500 bg-red-500/10'
                : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
            }`}
            title={isFavorite(node.id) ? t('detail.favorite.remove') : t('detail.favorite.add')}
          >
            <Heart size={14} fill={isFavorite(node.id) ? 'currentColor' : 'none'} />
            <span className="hidden sm:inline">
              {isFavorite(node.id) ? t('detail.favorite.remove') : t('detail.favorite.add')}
            </span>
          </button>
        </div>
        <h1 className="text-4xl font-semibold tracking-tight mb-4">{node.label}</h1>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--text-secondary)]">
          {meta?.date && (
            <div className="flex items-center gap-1">
              <Calendar size={14} />
              {formatDate(meta.date)}
            </div>
          )}
          {meta?.last_updated && (
            <div className="flex items-center gap-1">
              <Calendar size={14} />
              {t('detail.updated', { date: formatDate(meta.last_updated) })}
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

      {/* Content with TOC sidebar on desktop */}
      <div className="flex gap-8">
        <article id="article-content" className="prose prose-lg max-w-none flex-1 min-w-0">
          <MarkdownRenderer content={body} />
        </article>
        <TableOfContents />
      </div>

      {/* Backlinks */}
      <div className="mt-12 pt-8 border-t border-[var(--border-default)]">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Link2 size={18} />
          {backlinks.length > 0
            ? t('detail.backlinks', { count: backlinks.length })
            : t('detail.backlinks.zero')}
        </h2>
        {backlinks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {backlinks.map((link) => (
                <Link
                  key={link.id}
                  to={getPagePath(link)}
                  className="apple-card p-3 flex items-center gap-3"
                >
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeColors[link.type] || ''}`}>
                    {t(typeLabelKey(link.type))}
                  </span>
                  <span className="font-medium text-sm">{link.label}</span>
                </Link>
              ))}
          </div>
        ) : (
          <div className="apple-card p-6 text-center">
            <p className="text-sm text-[var(--text-secondary)] mb-1">{t('detail.backlinks.zero')}</p>
            <p className="text-xs text-[var(--text-tertiary)]">{t('detail.backlinks.hint')}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

interface HeadingItem {
  id: string;
  text: string;
  level: number;
}

function TableOfContents() {
  const { t } = useTranslation();
  const [headings, setHeadings] = useState<HeadingItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    const article = document.getElementById('article-content');
    if (!article) return;
    const elements = article.querySelectorAll('h2, h3');
    const items: HeadingItem[] = [];
    elements.forEach((el) => {
      const id = el.id;
      if (id) {
        items.push({ id, text: el.textContent || '', level: el.tagName === 'H2' ? 2 : 3 });
      }
    });
    setHeadings(items);
  }, []);

  useEffect(() => {
    if (headings.length === 0) return;
    const handleScroll = () => {
      const scrollTop = window.scrollY + 120;
      for (let i = headings.length - 1; i >= 0; i--) {
        const el = document.getElementById(headings[i].id);
        if (el && el.offsetTop <= scrollTop) {
          setActiveId(headings[i].id);
          return;
        }
      }
      setActiveId(headings[0].id);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [headings]);

  const handleClick = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  if (headings.length < 3) return null;

  return (
    <aside className="hidden xl:block w-56 shrink-0">
      <div className="sticky top-24">
        <h4 className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <List size={14} />
          {t('detail.toc.title')}
        </h4>
        <nav className="space-y-1 border-l border-[var(--border-default)]">
          {headings.map((h) => (
            <button
              key={h.id}
              onClick={() => handleClick(h.id)}
              className={`block w-full text-left pl-3 pr-1 py-1 text-xs transition-colors rounded-r-md ${
                activeId === h.id
                  ? 'text-apple-blue bg-apple-blue/5 border-l-2 border-apple-blue -ml-[2px]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              } ${h.level === 3 ? 'ml-3' : ''}`}
            >
              {h.text}
            </button>
          ))}
        </nav>
      </div>
    </aside>
  );
}
