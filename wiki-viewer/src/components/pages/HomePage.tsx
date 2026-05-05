import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, BookOpen, Network, Sparkles, ArrowRight, Clock, Copy, Check, RefreshCw, Heart, Inbox, Layers, Shuffle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWikiStore } from '@/stores/wikiStore';
import { motion, AnimatePresence } from 'framer-motion';
import { typeLabelKey } from '@/i18n';
import { getPagePath } from '@/lib/wikilink';
import { searchNodes } from '@/lib/search';
import { stripMarkdown } from '@/lib/textUtils';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useDebounce } from '@/hooks/useDebounce';
import { PageSkeleton } from '@/components/ui/Skeleton';

export function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const graphData = useWikiStore((s) => s.graphData);
  const loading = useWikiStore((s) => s.loading);
  const initialize = useWikiStore((s) => s.initialize);
  const recentPages = useWikiStore((s) => s.recentPages);
  const favorites = useWikiStore((s) => s.favorites);
  const nodes = graphData?.nodes || [];

  const [homeQuery, setHomeQuery] = useState('');
  const debouncedHomeQuery = useDebounce(homeQuery, 200);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  const homeResults = useMemo(
    () => (debouncedHomeQuery ? searchNodes(debouncedHomeQuery).slice(0, 5) : []),
    [debouncedHomeQuery]
  );

  useEffect(() => {
    setSelectedIdx(-1);
  }, [debouncedHomeQuery]);

  useEffect(() => {
    if (homeQuery.length === 0) return;
    const handler = (e: MouseEvent) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setHomeQuery('');
        setSelectedIdx(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [homeQuery]);

  const sources = useMemo(() => nodes.filter((n) => n.type === 'source'), [nodes]);
  const entities = useMemo(() => nodes.filter((n) => n.type === 'entity'), [nodes]);
  const concepts = useMemo(() => nodes.filter((n) => n.type === 'concept'), [nodes]);
  const syntheses = useMemo(() => nodes.filter((n) => n.type === 'synthesis'), [nodes]);

  const recentNodes = useMemo(
    () => recentPages.map((id) => nodes.find((n) => n.id === id)).filter(Boolean).slice(0, 3),
    [recentPages, nodes]
  );

  const randomNode = useMemo(() => {
    if (nodes.length === 0) return null;
    return nodes[Math.floor(Math.random() * nodes.length)];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length]);

  const handleRandomPick = useCallback(() => {
    if (nodes.length === 0) return;
    const node = nodes[Math.floor(Math.random() * nodes.length)];
    navigate(getPagePath(node));
  }, [nodes, navigate]);

  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
  }, []);
  useEffect(() => {
    return () => { if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current); };
  }, []);

  useDocumentTitle();

  const hour = new Date().getHours();
  const greetingKey = hour < 12 ? 'greeting.morning' : hour < 18 ? 'greeting.afternoon' : 'greeting.evening';

  return (
    <div className="relative">
      <div className="absolute -top-20 -left-20 w-80 h-80 bg-marshmallow-peach rounded-full ambient-blob" />
      <div className="absolute top-40 -right-20 w-96 h-96 bg-marshmallow-lavender rounded-full ambient-blob" style={{ animationDelay: '3s' }} />
      <div className="relative z-10">
        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)] mb-2 font-rounded">
            {t(greetingKey)}
          </h1>
          <p className="text-[var(--text-secondary)]">
            {t('home.subtitle')}
          </p>
        </motion.div>

        {/* Empty state: wiki has no pages yet */}
        {nodes.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-12"
          >
            <div className="apple-card p-8 max-w-3xl">
              <div className="text-center mb-8">
                <div className="flex justify-center mb-4">
                  <Inbox size={48} className="text-apple-blue" />
                </div>
                <h2 className="text-lg font-bold mb-2">{t('empty.title')}</h2>
                <p className="text-sm text-[var(--text-secondary)]">{t('empty.description')}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                {[
                  { icon: '01', title: t('home.empty.step1.title'), desc: t('home.empty.step1.desc') },
                  { icon: '02', title: t('home.empty.step2.title'), desc: t('home.empty.step2.desc') },
                  { icon: '03', title: t('home.empty.step3.title'), desc: t('home.empty.step3.desc') },
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-3 sm:block text-left sm:text-center">
                    <div className="text-sm text-apple-blue font-bold mb-0 sm:mb-1">{step.icon}</div>
                    <div>
                      <div className="font-medium text-sm">{step.title}</div>
                      <div className="text-xs text-[var(--text-secondary)]">{step.desc}</div>
                    </div>
                    {i < 2 && (
                      <div className="hidden sm:block text-[var(--text-tertiary)] my-1">
                        <ArrowRight size={14} className="mx-auto rotate-90 sm:rotate-0" />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="bg-[var(--bg-tertiary)] p-4 text-center rounded-xl border border-[var(--border-default)]">
                <p className="text-xs text-[var(--text-tertiary)] mb-2">{t('empty.ingestHint')}</p>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <code className="text-sm font-mono text-apple-blue bg-[var(--bg-primary)] px-3 py-1.5 border border-[var(--border-default)] rounded-lg">
                    {t('empty.ingestCommand')}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(t('empty.ingestCommand'));
                      setCopied(true);
                      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
                      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-[var(--bg-primary)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors border border-[var(--border-default)] hover:border-[var(--border-strong)] rounded-xl"
                  >
                    {copied ? <Check size={12} className="text-apple-blue" /> : <Copy size={12} />}
                    {copied ? t('home.empty.copied') : t('home.empty.copyCommand')}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Search bar */}
        {nodes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-12"
          >
            <div className="relative max-w-xl" ref={searchWrapperRef} role="search">
              <div className="flex items-center gap-3 w-full px-5 py-3 bg-[var(--bg-secondary)] border border-[var(--border-default)] hover:border-apple-blue focus-within:border-apple-blue focus-within:shadow-[0_0_0_3px_rgba(10,132,255,0.15)] transition-all duration-200 rounded-2xl">
                <Search size={18} className="text-[var(--text-tertiary)] shrink-0" />
                <input
                  value={homeQuery}
                  onChange={(e) => { setHomeQuery(e.target.value); setSelectedIdx(-1); }}
                  placeholder={t('home.searchPlaceholder')}
                  className="flex-1 bg-transparent outline-none text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                  aria-label={t('home.searchPlaceholder')}
                  aria-autocomplete="list"
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setHomeQuery('');
                      setSelectedIdx(-1);
                    } else if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setSelectedIdx((prev) => Math.min(prev + 1, homeResults.length - 1));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setSelectedIdx((prev) => Math.max(prev - 1, -1));
                    } else if (e.key === 'Enter' && selectedIdx >= 0 && homeResults[selectedIdx]) {
                      e.preventDefault();
                      const node = homeResults[selectedIdx].item;
                      navigate(getPagePath(node));
                      setHomeQuery('');
                      setSelectedIdx(-1);
                    }
                  }}
                />
                <kbd className="ml-auto px-2 py-0.5 text-xs bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg">{t('shortcut.ctrlK')}</kbd>
              </div>
              <AnimatePresence>
                {homeResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 right-0 top-full mt-2 p-2 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-2xl shadow-lg z-50"
                  >
                    {homeResults.map((r, idx) => (
                      <button
                        key={r.item.id}
                        onClick={() => {
                          navigate(getPagePath(r.item));
                          setHomeQuery('');
                          setSelectedIdx(-1);
                        }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors ${
                          idx === selectedIdx
                            ? 'bg-apple-blue/10 text-apple-blue'
                            : 'hover:bg-[var(--bg-secondary)]'
                        }`}
                      >
                        <div className="font-medium text-sm">{r.item.label}</div>
                        <div className="text-xs text-[var(--text-tertiary)] truncate">{stripMarkdown(r.item.preview)}</div>
                      </button>
                    ))}
                    <Link
                      to={`/search?q=${encodeURIComponent(debouncedHomeQuery)}`}
                      className="block text-center text-sm text-apple-blue hover:underline py-2 mt-1"
                    >
                      {t('home.searchSeeAll', { query: debouncedHomeQuery })} →
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-12"
        >
          {(() => {
            const total = nodes.length || 1;
            const stats = [
              { labelKey: 'stat.sources', count: sources.length, icon: BookOpen, color: 'text-apple-blue', bg: 'bg-apple-blue/10', bar: 'bg-apple-blue' },
              { labelKey: 'stat.entities', count: entities.length, icon: Sparkles, color: 'text-apple-green', bg: 'bg-apple-green/10', bar: 'bg-apple-green' },
              { labelKey: 'stat.concepts', count: concepts.length, icon: Network, color: 'text-apple-purple', bg: 'bg-apple-purple/10', bar: 'bg-apple-purple' },
              { labelKey: 'stat.syntheses', count: syntheses.length, icon: Layers, color: 'text-apple-orange', bg: 'bg-apple-orange/10', bar: 'bg-apple-orange' },
            ];
            return stats.map((stat) => {
              const pct = Math.round((stat.count / total) * 100);
              return (
                <Link
                  key={stat.labelKey}
                  to={`/browse?t=${stat.labelKey.replace('stat.', '')}`}
                  className="apple-card p-4 block group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`${stat.color} ${stat.bg} p-1.5 rounded-lg`}>
                      <stat.icon size={14} />
                    </div>
                    <span className="text-xs text-[var(--text-secondary)] font-medium">{t(stat.labelKey as string)}</span>
                  </div>
                  <div className="text-3xl font-bold tabular-nums mb-2">{stat.count}</div>
                  <div className="w-full h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                    <div className={`h-full ${stat.bar} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-[10px] text-[var(--text-tertiary)] mt-1">{pct}% of total</div>
                </Link>
              );
            });
          })()}
        </motion.div>

        {/* Favorites */}
        {nodes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="mb-12"
          >
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Heart size={16} className="text-apple-pink" />
              {t('home.favorites.title')}
            </h2>
            {favorites.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {favorites
                  .map((id) => nodes.find((n) => n.id === id))
                  .filter(Boolean)
                  .slice(0, 6)
                  .map((node) => (
                    <PageCard key={node!.id} node={node!} />
                  ))}
              </div>
            ) : (
              <div className="apple-card p-8 text-center">
                <Heart size={32} className="mx-auto mb-3 text-[var(--border-strong)]" />
                <p className="text-sm text-[var(--text-secondary)] mb-3">{t('home.favorites.empty')}</p>
                <Link
                  to="/browse"
                  className="inline-flex items-center gap-1.5 text-sm text-apple-blue hover:underline"
                >
                  {t('home.favorites.browseCta')}
                  <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </motion.div>
        )}

        {/* Continue Reading */}
        {nodes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mb-12"
          >
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Clock size={16} className="text-apple-purple" />
              {t('home.sections.continueReading')}
            </h2>
            {recentNodes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {recentNodes.map((node) => (
                  <PageCard key={node!.id} node={node!} />
                ))}
              </div>
            ) : (
              <div className="apple-card p-8 text-center">
                <Clock size={32} className="mx-auto mb-3 text-[var(--border-strong)]" />
                <p className="text-sm text-[var(--text-secondary)] mb-4">{t('home.continueReading.empty')}</p>
                <button
                  onClick={handleRandomPick}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-apple-purple/10 text-apple-purple text-sm font-medium rounded-xl hover:bg-apple-purple/20 transition-colors"
                >
                  <Shuffle size={14} />
                  {t('home.continueReading.randomPick')}
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* Random Discovery */}
        {randomNode && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mb-12"
          >
            <h2 className="text-lg font-bold mb-4">{t('home.sections.randomDiscovery')}</h2>
            <div className="warm-card p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <TypeBadge type={randomNode.type} />
                    <span className="text-xs text-[var(--text-secondary)]">{randomNode.id}</span>
                  </div>
                  <h3 className="text-base font-bold mb-2">{randomNode.label}</h3>
                  <p className="text-sm text-[var(--text-secondary)] line-clamp-2">{randomNode.preview}</p>
                </div>
              </div>
              <div className="mt-4">
                <PageLink node={randomNode} className="apple-button text-sm">
                  {t('action.explore')} <ArrowRight size={14} />
                </PageLink>
              </div>
            </div>
          </motion.div>
        )}

        {/* Knowledge Graph Mini */}
        {graphData ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{t('home.sections.knowledgeGraph')}</h2>
              <Link to="/graph" className="text-sm text-apple-blue hover:underline flex items-center gap-1">
                {t('action.explore')} <ArrowRight size={14} />
              </Link>
            </div>
            <div className="apple-card p-6">
              <div className="flex items-center justify-center gap-8 text-sm text-[var(--text-secondary)]">
                <div className="text-center">
                  <div className="text-3xl font-bold text-[var(--text-primary)] tabular-nums">{nodes.length}</div>
                  <div className="text-xs font-medium">{t('stat.nodes')}</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-[var(--text-primary)] tabular-nums">{graphData.edges.length}</div>
                  <div className="text-xs font-medium">{t('stat.edges')}</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-[var(--text-primary)] tabular-nums">{new Set(nodes.map((n) => n.group)).size}</div>
                  <div className="text-xs font-medium">{t('stat.communities')}</div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : nodes.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <h2 className="text-lg font-bold mb-4">{t('home.sections.knowledgeGraph')}</h2>
            <div className="apple-card p-6 text-center">
              <p className="text-sm text-[var(--text-secondary)] mb-4">{t('home.graph.error')}</p>
              <button
                onClick={() => initialize()}
                className="apple-button-ghost text-sm"
              >
                <RefreshCw size={14} />
                {t('home.graph.retry')}
              </button>
            </div>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const { t } = useTranslation();
  return (
    <span className="text-xs font-medium px-2 py-0.5 border border-[var(--border-default)] text-[var(--text-secondary)] rounded-lg">
      {t(typeLabelKey(type) as string)}
    </span>
  );
}

function PageCard({ node }: { node: { id: string; label: string; type: string; preview: string } }) {
  return (
    <Link
      to={getPagePath(node)}
      className="apple-card p-4 block"
    >
      <TypeBadge type={node.type} />
      <h3 className="font-bold mt-2 mb-1">{node.label}</h3>
      <p className="text-sm text-[var(--text-secondary)] line-clamp-2">{stripMarkdown(node.preview)}</p>
    </Link>
  );
}

function PageLink({ node, children, className }: { node: { id: string; type: string }; children: React.ReactNode; className?: string }) {
  return (
    <Link to={getPagePath(node)} className={className}>
      {children}
    </Link>
  );
}
