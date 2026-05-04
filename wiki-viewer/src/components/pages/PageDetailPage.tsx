import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Undo2, Heart, Link2, Calendar, Tag, List, MessageCircle, FileQuestion } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';
import i18n from '@/i18n';
import { useWikiStore } from '@/stores/wikiStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { MarkdownRenderer } from '@/components/content/MarkdownRenderer';
import { parseFrontmatter } from '@/lib/frontmatter';
import { motion } from 'framer-motion';
import { typeLabelKey } from '@/i18n';
import { getPagePath } from '@/lib/wikilink';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { DetailSkeleton } from '@/components/ui/Skeleton';

interface Props {
  type: 'source' | 'entity' | 'concept' | 'synthesis';
}

function formatDate(dateStr: string): string {
  try {
    const locale = i18n.language === 'zh-CN' ? zhCN : enUS;
    return format(parseISO(dateStr), 'PPP', { locale });
  } catch {
    return dateStr;
  }
}

const typeColors: Record<string, string> = {
  source: 'text-apple-blue bg-apple-blue/10',
  entity: 'text-apple-green bg-apple-green/10',
  concept: 'text-apple-purple bg-apple-purple/10',
  synthesis: 'text-apple-orange bg-apple-orange/10',
};

export function PageDetailPage({ type }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
  const [favBounce, setFavBounce] = useState(0);
  const addNotification = useNotificationStore((s) => s.addNotification);

  const node = useMemo(() => {
    if (!graphData) return null;
    return graphData.nodes.find(
      (n) => n.type === type && n.id.endsWith(`/${param}`)
    );
  }, [graphData, type, param]);

  const { meta, body } = useMemo(() => node ? parseFrontmatter(node.markdown) : { meta: null, body: '' }, [node]);
  const backlinks = useMemo(() => node ? getBacklinks(node.id) : [], [node, getBacklinks]);

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

  // Track scroll progress (debounced write to store)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!node) return;
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;
      const progress = Math.min(1, Math.max(0, scrollTop / docHeight));
      if (Math.abs(progress - progressRef.current) > 0.01) {
        progressRef.current = progress;
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
          setReadingProgress(node.id, progress);
        }, 500);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [node, setReadingProgress]);

  useDocumentTitle(node?.label);

  const loading = useWikiStore((s) => s.loading);

  if (!node) {
    if (loading) {
      return <DetailSkeleton />;
    }
    return (
      <div className="empty-state-warm mt-20">
        <FileQuestion size={48} className="text-[var(--text-tertiary)] mb-3" />
        <h3 className="text-lg font-semibold">{t('detail.notFound')}</h3>
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
        <button
          onClick={() => navigate(-1)}
          className="apple-button-ghost flex items-center gap-1"
          title={t('detail.back')}
        >
          <Undo2 size={14} />
        </button>
        <Link to="/browse" className="hover:text-[var(--text-primary)] flex items-center gap-1">
          <ArrowLeft size={14} /> {t('detail.breadcrumb.browse')}
        </Link>
        <span>/</span>
        <span className="capitalize">{t(typeLabelKey(type) as string)}</span>
        <span>/</span>
        <span className="text-[var(--text-primary)] font-medium">{node.label}</span>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <span className={`text-xs font-semibold px-2.5 py-1 border border-[var(--border-default)] rounded-full ${typeColors[type] || ''}`}>
            {t(typeLabelKey(type) as string)}
          </span>
          <Link
            to={`/chat?context=${encodeURIComponent(node.id)}`}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors text-[var(--text-tertiary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-default)] rounded-full"
            title={t('detail.askAbout')}
          >
            <MessageCircle size={14} />
            <span className="hidden sm:inline">{t('detail.askAbout')}</span>
          </Link>
          <FavoriteButton
            nodeId={node.id}
            favBounce={favBounce}
            setFavBounce={setFavBounce}
            toggleFavorite={toggleFavorite}
            isFavorite={isFavorite}
            addNotification={addNotification}
            t={t}
          />
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
          {Array.isArray(meta?.tags) && meta.tags.length > 0 && (
            <div className="flex items-center gap-1">
              <Tag size={14} />
              {meta.tags.map((tag: string) => (
                <span key={tag} className="bg-[var(--bg-secondary)] px-2 py-0.5 rounded-full text-xs">
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
        <TableOfContents content={body} />
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
                  <span className={`text-xs font-medium px-2 py-0.5 border border-[var(--border-default)] rounded-full ${typeColors[link.type] || ''}`}>
                    {t(typeLabelKey(link.type) as string)}
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

function FavoriteButton({
  nodeId,
  favBounce,
  setFavBounce,
  toggleFavorite,
  isFavorite,
  addNotification,
  t,
}: {
  nodeId: string;
  favBounce: number;
  setFavBounce: React.Dispatch<React.SetStateAction<number>>;
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
  addNotification: (msg: string, type: 'success' | 'error') => void;
  t: (key: string) => string;
}) {
  const willBeFavorite = !isFavorite(nodeId);
  const fav = isFavorite(nodeId);

  const handleClick = () => {
    toggleFavorite(nodeId);
    setFavBounce((k) => k + 1);
    addNotification(
      willBeFavorite ? t('detail.favorite.added') : t('detail.favorite.removed'),
      'success'
    );
  };

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors border border-[var(--border-default)] rounded-full ${
        fav
          ? 'text-red-500 bg-red-500/10 border-red-500/30'
          : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
      }`}
      title={fav ? t('detail.favorite.remove') : t('detail.favorite.add')}
    >
      <motion.span
        key={favBounce}
        initial={{ scale: 0.6 }}
        animate={{ scale: [0.6, 1.3, 1] }}
        transition={{ duration: 0.35 }}
      >
        <Heart size={14} fill={fav ? 'currentColor' : 'none'} />
      </motion.span>
      <span className="hidden sm:inline">
        {fav ? t('detail.favorite.remove') : t('detail.favorite.add')}
      </span>
    </button>
  );
}

interface HeadingItem {
  id: string;
  text: string;
  level: number;
}

function TableOfContents({ content }: { content: string }) {
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
  }, [content]);

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
        <h4 className="text-xs font-semibold text-[var(--text-tertiary)] mb-3 flex items-center gap-1.5">
          <List size={14} />
          {t('detail.toc.title')}
        </h4>
        <nav className="space-y-1">
          {headings.map((h) => (
            <button
              key={h.id}
              onClick={() => handleClick(h.id)}
              className={`block w-full text-left pl-3 pr-1 py-1 text-xs transition-colors rounded-lg ${
                activeId === h.id
                  ? 'text-apple-blue bg-apple-blue/10'
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
