import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Undo2, Heart, Link2, Calendar, Tag, List, MessageCircle, FileQuestion, Edit3, Save, X, Download, Eye, Columns, Users, Headphones } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';
import i18n from '@/i18n';
import { useWikiStore } from '@/stores/wikiStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { saveWikiPage } from '@/services/dataService';
import { MarkdownRenderer } from '@/components/content/MarkdownRenderer';
import { CollabEditor } from '@/components/editor/CollabEditor';
import { parseFrontmatter } from '@/lib/frontmatter';
import { motion, AnimatePresence } from 'framer-motion';
import { typeLabelKey } from '@/i18n';
import { getPagePath } from '@/lib/wikilink';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { DetailSkeleton } from '@/components/ui/Skeleton';
import { AudioOverview } from '@/components/content/AudioOverview';

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
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editMode, setEditMode] = useState<'edit' | 'preview' | 'split'>('edit');
  const [collaborate, setCollaborate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [showAudio, setShowAudio] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const addNotification = useNotificationStore((s) => s.addNotification);

  const node = useMemo(() => {
    if (!graphData) return null;
    return graphData.nodes.find(
      (n) => n.type === type && n.id.endsWith(`/${param}`)
    );
  }, [graphData, type, param]);

  const draftKey = node ? `wiki-draft-${node.path}` : '';

  // Auto-save draft to localStorage
  useEffect(() => {
    if (!draftKey || !isEditing) return;
    const saved = localStorage.getItem(draftKey);
    setHasDraft(!!saved);
    if (saved && saved !== node?.markdown) {
      setEditContent(saved);
    }
  }, [draftKey, isEditing, node]);

  useEffect(() => {
    if (!draftKey || !isEditing) return;
    const timer = setTimeout(() => {
      localStorage.setItem(draftKey, editContent);
      setHasDraft(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, [draftKey, editContent, isEditing]);

  const { meta, body } = useMemo(() => node ? parseFrontmatter(node.markdown) : { meta: null, body: '' }, [node]);

  useEffect(() => {
    if (node) {
      setEditContent(node.markdown);
      setIsEditing(false);
      setCollaborate(false);
    }
  }, [type, param]);
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
      {node && (readingProgress[node.id] || 0) > 0 && (
        <div
          className="fixed top-14 left-0 right-0 z-40 h-[2px] bg-[var(--bg-secondary)]"
          role="progressbar"
          aria-label="Reading progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round((readingProgress[node.id] || 0) * 100)}
        >
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
          <button
            onClick={() => {
              if (isEditing) {
                setEditContent(node.markdown);
                setIsEditing(false);
                setCollaborate(false);
                if (draftKey) localStorage.removeItem(draftKey);
              } else {
                setEditContent(node.markdown);
                setIsEditing(true);
                setEditMode('edit');
                setCollaborate(false);
              }
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors border border-[var(--border-default)] rounded-full ${
              isEditing
                ? 'text-apple-orange bg-apple-orange/10 border-apple-orange/30'
                : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
            }`}
            title={isEditing ? t('detail.cancel') : t('detail.edit')}
          >
            {isEditing ? <X size={14} /> : <Edit3 size={14} />}
            <span className="hidden sm:inline">{isEditing ? t('detail.cancel') : t('detail.edit')}</span>
          </button>
          <button
            onClick={() => {
              if (!node) return;
              const blob = new Blob([node.markdown], { type: 'text/markdown' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${node.label || 'page'}.md`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors text-[var(--text-tertiary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-default)] rounded-full"
            title={t('detail.downloadMarkdown')}
          >
            <Download size={14} />
            <span className="hidden sm:inline">{t('detail.export')}</span>
          </button>
          <button
            onClick={() => setShowAudio((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors border border-[var(--border-default)] rounded-full ${
              showAudio
                ? 'text-apple-blue bg-apple-blue/10 border-apple-blue/30'
                : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
            }`}
            title={t('audio.listen')}
            aria-pressed={showAudio}
          >
            <Headphones size={14} />
            <span className="hidden sm:inline">{t('audio.listen')}</span>
          </button>
          <button
            onClick={() => setTocOpen(true)}
            className="xl:hidden flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors text-[var(--text-tertiary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-default)] rounded-full"
            title={t('detail.toc.title')}
          >
            <List size={14} />
          </button>
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
          {isEditing ? (
            <div className="space-y-3">
              {/* Edit mode toolbar */}
              <div className="flex items-center gap-2">
                {([
                  { mode: 'edit' as const, icon: Edit3, label: 'Edit' },
                  { mode: 'preview' as const, icon: Eye, label: 'Preview' },
                  { mode: 'split' as const, icon: Columns, label: 'Split' },
                ]).map(({ mode, icon: Icon, label }) => (
                  <button
                    key={mode}
                    onClick={() => setEditMode(mode)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors rounded-lg ${
                      editMode === mode
                        ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]'
                        : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                    }`}
                    aria-pressed={editMode === mode}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                ))}
                <button
                  onClick={() => setCollaborate((c) => !c)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors rounded-lg ${
                    collaborate
                      ? 'bg-apple-blue/10 text-apple-blue'
                      : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                  }`}
                  title={collaborate ? 'Stop collaborating' : 'Collaborate'}
                >
                  <Users size={14} />
                  <span className="hidden sm:inline">{collaborate ? 'Collaborating' : 'Collaborate'}</span>
                </button>
                {draftKey && hasDraft && (
                  <span className="text-xs text-apple-blue ml-2">Draft saved</span>
                )}
              </div>

              {/* Edit / Preview / Split pane */}
              <div className="flex gap-4">
                {(editMode === 'edit' || editMode === 'split') && (
                  collaborate ? (
                    <CollabEditor
                      key={node.path}
                      docId={node.path}
                      initialContent={editContent}
                      onChange={setEditContent}
                      wrapperClassName={editMode === 'split' ? 'w-1/2' : 'w-full'}
                      textareaClassName={`${editMode === 'split' ? 'w-full' : 'w-full'} h-[60vh]`}
                    />
                  ) : (
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className={`p-4 font-mono text-sm bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl resize-y focus:outline-none focus:ring-2 focus:ring-apple-blue/30 ${
                        editMode === 'split' ? 'w-1/2 h-[60vh]' : 'w-full h-[60vh]'
                      }`}
                      spellCheck={false}
                      aria-label={t('detail.editContent')}
                    />
                  )
                )}
                {(editMode === 'preview' || editMode === 'split') && (
                  <div className={`prose prose-lg max-w-none bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl p-4 overflow-auto ${
                    editMode === 'split' ? 'w-1/2 h-[60vh]' : 'w-full h-[60vh]'
                  }`}>
                    <MarkdownRenderer content={editContent} />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={async () => {
                    if (!node) return;
                    setSaving(true);
                    try {
                      await saveWikiPage(node.path, editContent);
                      addNotification('Page saved successfully', 'success');
                      setIsEditing(false);
                      if (draftKey) localStorage.removeItem(draftKey);
                      useWikiStore.getState().refreshGraphData();
                    } catch (e) {
                      addNotification(`Save failed: ${(e as Error).message}`, 'error');
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={saving}
                  aria-busy={saving}
                  className="apple-button-primary flex items-center gap-2"
                >
                  <Save size={14} />
                  {saving ? t('detail.saving') : t('detail.save')}
                </button>
                <button
                  onClick={() => {
                    setEditContent(node.markdown);
                    setIsEditing(false);
                    if (draftKey) localStorage.removeItem(draftKey);
                  }}
                  className="apple-button-ghost"
                >
                  {t('detail.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <MarkdownRenderer content={body} />
          )}
        </article>
        {!isEditing && <TableOfContents content={body} />}
      </div>

      <MobileTocDrawer content={body} isOpen={tocOpen} onClose={() => setTocOpen(false)} />

      {showAudio && <AudioOverview text={body} onClose={() => setShowAudio(false)} />}

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
  addNotification: (msg: string, type: 'success' | 'error' | 'info') => void;
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
      aria-pressed={fav}
      aria-label={fav ? t('detail.favorite.remove') : t('detail.favorite.add')}
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

function useToc(content: string) {
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

  return { headings, activeId, handleClick };
}

function TocNav({ headings, activeId, onClick }: { headings: HeadingItem[]; activeId: string; onClick: (id: string) => void }) {
  return (
    <nav className="space-y-1">
      {headings.map((h) => (
        <button
          key={h.id}
          onClick={() => onClick(h.id)}
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
  );
}

function TableOfContents({ content }: { content: string }) {
  const { t } = useTranslation();
  const { headings, activeId, handleClick } = useToc(content);

  if (headings.length < 3) return null;

  return (
    <aside className="hidden xl:block w-56 shrink-0">
      <div className="sticky top-24">
        <h4 className="text-xs font-semibold text-[var(--text-tertiary)] mb-3 flex items-center gap-1.5">
          <List size={14} />
          {t('detail.toc.title')}
        </h4>
        <TocNav headings={headings} activeId={activeId} onClick={handleClick} />
      </div>
    </aside>
  );
}

function MobileTocDrawer({ content, isOpen, onClose }: { content: string; isOpen: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { headings, activeId, handleClick } = useToc(content);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (headings.length < 3) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 xl:hidden"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-72 bg-[var(--bg-primary)] border-l border-[var(--border-default)] z-50 p-6 pt-20 xl:hidden shadow-xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-[var(--text-tertiary)] flex items-center gap-1.5">
                <List size={14} />
                {t('detail.toc.title')}
              </h4>
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)]"
                aria-label={t('common.close')}
              >
                <X size={16} />
              </button>
            </div>
            <TocNav
              headings={headings}
              activeId={activeId}
              onClick={(id) => {
                handleClick(id);
                onClose();
              }}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
