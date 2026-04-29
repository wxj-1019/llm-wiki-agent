import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, BookOpen, Network, Sparkles, ArrowRight, Clock, Copy, Check, RefreshCw, Heart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWikiStore } from '@/stores/wikiStore';
import { motion } from 'framer-motion';
import { typeLabelKey } from '@/i18n';
import { getPagePath } from '@/lib/wikilink';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export function HomePage() {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const graphData = useWikiStore((s) => s.graphData);
  const initialize = useWikiStore((s) => s.initialize);
  const recentPages = useWikiStore((s) => s.recentPages);
  const favorites = useWikiStore((s) => s.favorites);
  const nodes = graphData?.nodes || [];

  const sources = nodes.filter((n) => n.type === 'source');
  const entities = nodes.filter((n) => n.type === 'entity');
  const concepts = nodes.filter((n) => n.type === 'concept');
  const syntheses = nodes.filter((n) => n.type === 'synthesis');

  const recentNodes = recentPages
    .map((id) => nodes.find((n) => n.id === id))
    .filter(Boolean)
    .slice(0, 3);

  const [randomNode, setRandomNode] = useState<typeof nodes[0] | null>(null);
  useEffect(() => {
    if (nodes.length > 0) {
      setRandomNode(nodes[Math.floor(Math.random() * nodes.length)]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length]);

  useDocumentTitle();

  const hour = new Date().getHours();
  const greetingKey = hour < 12 ? 'greeting.morning' : hour < 18 ? 'greeting.afternoon' : 'greeting.evening';

  return (
    <div className="relative">
      {/* Ambient blobs */}
      <div className="absolute -top-20 -left-20 w-80 h-80 bg-warm-peach rounded-full ambient-blob" />
      <div className="absolute top-40 -right-20 w-96 h-96 bg-warm-lavender rounded-full ambient-blob" style={{ animationDelay: '3s' }} />

      <div className="relative z-10">
        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <h1 className="text-4xl font-rounded font-semibold text-[var(--text-primary)] mb-2">
            {t(greetingKey)}
          </h1>
          <p className="text-[var(--text-secondary)] text-lg">
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
            <div className="warm-card p-8 max-w-3xl">
              <div className="text-center mb-8">
                <div className="text-5xl mb-4">📖</div>
                <h2 className="text-xl font-semibold mb-2">{t('empty.title')}</h2>
                <p className="text-sm text-[var(--text-secondary)]">{t('empty.description')}</p>
              </div>

              {/* 3-step guide */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                {[
                  { icon: '📝', title: t('home.empty.step1.title'), desc: t('home.empty.step1.desc') },
                  { icon: '⚙️', title: t('home.empty.step2.title'), desc: t('home.empty.step2.desc') },
                  { icon: '👁️', title: t('home.empty.step3.title'), desc: t('home.empty.step3.desc') },
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-3 sm:block text-left sm:text-center">
                    <div className="text-3xl mb-0 sm:mb-2">{step.icon}</div>
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

              {/* Command copy */}
              <div className="bg-[var(--bg-secondary)] rounded-xl p-4 text-center">
                <p className="text-xs text-[var(--text-tertiary)] mb-2">{t('empty.ingestHint')}</p>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <code className="text-sm font-mono text-apple-blue bg-[var(--bg-primary)] px-3 py-1.5 rounded-lg">
                    {t('empty.ingestCommand')}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(t('empty.ingestCommand'));
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--bg-primary)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors border border-[var(--border-default)]"
                  >
                    {copied ? <Check size={12} className="text-apple-green" /> : <Copy size={12} />}
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
            <Link
              to="/search"
              className="flex items-center gap-3 w-full max-w-xl px-5 py-3.5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-default)] hover:border-apple-blue/40 hover:shadow-md transition-all duration-200"
            >
              <Search size={18} className="text-[var(--text-tertiary)]" />
              <span className="text-[var(--text-tertiary)]">{t('home.searchPlaceholder')}</span>
              <kbd className="ml-auto px-2 py-0.5 text-xs bg-[var(--bg-primary)] rounded border border-[var(--border-default)]">{t('shortcut.ctrlK')}</kbd>
            </Link>
          </motion.div>
        )}

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12"
        >
          {[
            { labelKey: 'stat.sources', count: sources.length, icon: BookOpen, color: 'text-apple-blue', bg: 'bg-apple-blue/10' },
            { labelKey: 'stat.entities', count: entities.length, icon: Sparkles, color: 'text-apple-green', bg: 'bg-apple-green/10' },
            { labelKey: 'stat.concepts', count: concepts.length, icon: Network, color: 'text-apple-purple', bg: 'bg-apple-purple/10' },
            { labelKey: 'stat.syntheses', count: syntheses.length, icon: BookOpen, color: 'text-apple-orange', bg: 'bg-apple-orange/10' },
          ].map((stat) => (
            <div key={stat.labelKey} className="apple-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-lg ${stat.bg} ${stat.color}`}>
                  <stat.icon size={14} />
                </div>
                <span className="text-sm text-[var(--text-secondary)]">{t(stat.labelKey as string)}</span>
              </div>
              <div className="text-2xl font-semibold">{stat.count}</div>
            </div>
          ))}
        </motion.div>

        {/* Favorites */}
        {nodes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="mb-12"
          >
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Heart size={18} className="text-red-500" />
              {t('home.favorites.title')}
            </h2>
            {favorites.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {favorites
                  .map((id) => nodes.find((n) => n.id === id))
                  .filter(Boolean)
                  .slice(0, 6)
                  .map((node) => (
                    <PageCard key={node!.id} node={node!} />
                  ))}
              </div>
            ) : (
              <div className="apple-card p-6 text-center text-sm text-[var(--text-secondary)]">
                {t('home.favorites.empty')}
              </div>
            )}
          </motion.div>
        )}

        {/* Continue Reading */}
        {recentNodes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mb-12"
          >
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Clock size={18} />
              {t('home.sections.continueReading')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {recentNodes.map((node) => (
                <PageCard key={node!.id} node={node!} />
              ))}
            </div>
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
            <h2 className="text-xl font-semibold mb-4">{t('home.sections.randomDiscovery')}</h2>
            <div className="warm-card p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <TypeBadge type={randomNode.type} />
                    <span className="text-sm text-[var(--text-secondary)]">{randomNode.id}</span>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{randomNode.label}</h3>
                  <p className="text-sm text-[var(--text-secondary)] line-clamp-2">{randomNode.preview}</p>
                </div>
              </div>
              <div className="mt-4">
                <PageLink node={randomNode} className="apple-button-warm text-sm">
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
              <h2 className="text-xl font-semibold">{t('home.sections.knowledgeGraph')}</h2>
              <Link to="/graph" className="text-sm text-apple-blue hover:underline flex items-center gap-1">
                {t('action.explore')} <ArrowRight size={14} />
              </Link>
            </div>
            <div className="apple-card p-6">
              <div className="flex items-center justify-center gap-8 text-sm text-[var(--text-secondary)]">
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[var(--text-primary)]">{nodes.length}</div>
                  <div>{t('stat.nodes')}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[var(--text-primary)]">{graphData.edges.length}</div>
                  <div>{t('stat.edges')}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[var(--text-primary)]">{new Set(nodes.map((n) => n.group)).size}</div>
                  <div>{t('stat.communities')}</div>
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
            <h2 className="text-xl font-semibold mb-4">{t('home.sections.knowledgeGraph')}</h2>
            <div className="apple-card p-6 text-center">
              <p className="text-sm text-[var(--text-secondary)] mb-4">{t('home.graph.error')}</p>
              <button
                onClick={() => initialize()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--bg-secondary)] text-sm font-medium hover:bg-[var(--bg-tertiary)] transition-colors"
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
  const colors: Record<string, string> = {
    source: 'bg-apple-blue/10 text-apple-blue',
    entity: 'bg-apple-green/10 text-apple-green',
    concept: 'bg-apple-purple/10 text-apple-purple',
    synthesis: 'bg-apple-orange/10 text-apple-orange',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[type] || 'bg-gray-100 text-gray-600'}`}>
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
      <h3 className="font-semibold mt-2 mb-1">{node.label}</h3>
      <p className="text-sm text-[var(--text-secondary)] line-clamp-2">{node.preview}</p>
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

