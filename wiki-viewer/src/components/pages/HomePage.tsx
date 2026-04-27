import { Link } from 'react-router-dom';
import { Search, BookOpen, Network, Sparkles, ArrowRight, Clock } from 'lucide-react';
import { useWikiStore } from '@/stores/wikiStore';
import { motion } from 'framer-motion';

export function HomePage() {
  const graphData = useWikiStore((s) => s.graphData);
  const recentPages = useWikiStore((s) => s.recentPages);
  const nodes = graphData?.nodes || [];

  const sources = nodes.filter((n) => n.type === 'source');
  const entities = nodes.filter((n) => n.type === 'entity');
  const concepts = nodes.filter((n) => n.type === 'concept');
  const syntheses = nodes.filter((n) => n.type === 'synthesis');

  const recentNodes = recentPages
    .map((id) => nodes.find((n) => n.id === id))
    .filter(Boolean)
    .slice(0, 3);

  const randomNode = nodes.length > 0 ? nodes[Math.floor(Math.random() * nodes.length)] : null;

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning~';
    if (hour < 18) return 'Good afternoon~';
    return 'Good evening~';
  };

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
            {greeting()}
          </h1>
          <p className="text-[var(--text-secondary)] text-lg">
            What do you want to explore today?
          </p>
        </motion.div>

        {/* Search bar */}
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
            <span className="text-[var(--text-tertiary)]">Search your knowledge base...</span>
            <kbd className="ml-auto px-2 py-0.5 text-xs bg-[var(--bg-primary)] rounded border border-[var(--border-default)]">Ctrl K</kbd>
          </Link>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12"
        >
          {[
            { label: 'Sources', count: sources.length, icon: BookOpen, color: 'text-apple-blue', bg: 'bg-apple-blue/10' },
            { label: 'Entities', count: entities.length, icon: Sparkles, color: 'text-apple-green', bg: 'bg-apple-green/10' },
            { label: 'Concepts', count: concepts.length, icon: Network, color: 'text-apple-purple', bg: 'bg-apple-purple/10' },
            { label: 'Syntheses', count: syntheses.length, icon: BookOpen, color: 'text-apple-orange', bg: 'bg-apple-orange/10' },
          ].map((stat) => (
            <div key={stat.label} className="apple-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-lg ${stat.bg} ${stat.color}`}>
                  <stat.icon size={14} />
                </div>
                <span className="text-sm text-[var(--text-secondary)]">{stat.label}</span>
              </div>
              <div className="text-2xl font-semibold">{stat.count}</div>
            </div>
          ))}
        </motion.div>

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
              Continue Reading
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
            <h2 className="text-xl font-semibold mb-4">Random Discovery</h2>
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
                  Explore <ArrowRight size={14} />
                </PageLink>
              </div>
            </div>
          </motion.div>
        )}

        {/* Knowledge Graph Mini */}
        {graphData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Knowledge Graph</h2>
              <Link to="/graph" className="text-sm text-apple-blue hover:underline flex items-center gap-1">
                Explore <ArrowRight size={14} />
              </Link>
            </div>
            <div className="apple-card p-6">
              <div className="flex items-center justify-center gap-8 text-sm text-[var(--text-secondary)]">
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[var(--text-primary)]">{nodes.length}</div>
                  <div>Nodes</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[var(--text-primary)]">{graphData.edges.length}</div>
                  <div>Edges</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[var(--text-primary)]">{new Set(nodes.map((n) => n.group)).size}</div>
                  <div>Communities</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    source: 'bg-apple-blue/10 text-apple-blue',
    entity: 'bg-apple-green/10 text-apple-green',
    concept: 'bg-apple-purple/10 text-apple-purple',
    synthesis: 'bg-apple-orange/10 text-apple-orange',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[type] || 'bg-gray-100 text-gray-600'}`}>
      {type}
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

function getPagePath(node: { id: string; type: string }) {
  const prefixMap: Record<string, string> = { source: 's', entity: 'e', concept: 'c', synthesis: 'y' };
  const prefix = prefixMap[node.type] || 's';
  const slug = node.id.split('/').pop() || node.id;
  return `/${prefix}/${slug}`;
}
