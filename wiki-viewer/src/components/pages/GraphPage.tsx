import { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Network as VisNetwork } from 'vis-network/standalone';
import type { Network } from 'vis-network';
import { Network as NetworkIcon, Loader2, AlertTriangle, RefreshCw, BookOpen, Heart, ArrowRight, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWikiStore } from '@/stores/wikiStore';
import { motion } from 'framer-motion';
import { typeLabelKey } from '@/i18n';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getPagePath } from '@/lib/wikilink';

export function GraphPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);
  const graphData = useWikiStore((s) => s.graphData);
  const loading = useWikiStore((s) => s.loading);
  const error = useWikiStore((s) => s.error);
  const initialize = useWikiStore((s) => s.initialize);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  useDocumentTitle(t('nav.graph'));

  const [filterTypes, setFilterTypes] = useState<Set<string>>(new Set(['source', 'entity', 'concept', 'synthesis']));

  // Memoize nodes/edges derived from graphData to avoid reference churn
  const nodes = graphData?.nodes || [];
  const edges = graphData?.edges || [];

  // Get rid of stale state when graphData changes (nodes may have been added/removed)
  useEffect(() => {
    setSelectedNode(null);
  }, [graphData]);

  const getConnectedEdges = useCallback((nodeId: string) => {
    return edges.filter((e) => e.from === nodeId || e.to === nodeId);
  }, [edges]);

  useEffect(() => {
    if (!containerRef.current || !graphData || nodes.length === 0) return;

    // Destroy previous network if it exists
    if (networkRef.current) {
      networkRef.current.destroy();
      networkRef.current = null;
    }

    const visNodes = nodes
      .filter((n) => filterTypes.has(n.type))
      .map((n) => ({
        id: n.id,
        label: n.label,
        color: {
          background: n.color,
          border: n.color,
          highlight: { background: n.color, border: '#fff' },
        },
        value: n.value,
        title: n.preview,
        font: { color: 'var(--text-primary)', size: 12, face: '-apple-system' },
      }));

    const nodeIds = new Set(visNodes.map((n) => n.id));
    const visEdges = edges
      .filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to))
      .map((e) => ({
        id: e.id,
        from: e.from,
        to: e.to,
        color: { color: e.color, highlight: '#fff' },
        width: e.type === 'EXTRACTED' ? 1.5 : 0.8,
        dashes: e.type === 'AMBIGUOUS',
        arrows: 'to' as const,
      }));

    const network = new VisNetwork(
      containerRef.current,
      { nodes: visNodes, edges: visEdges },
      {
        physics: {
          barnesHut: {
            gravitationalConstant: -3000,
            springLength: 120,
            springConstant: 0.04,
          },
        },
        interaction: { hover: true, tooltipDelay: 150 },
        nodes: {
          shape: 'dot',
          scaling: { min: 8, max: 30 },
        },
      }
    );

    networkRef.current = network;

    network.on('click', (params) => {
      if (params.nodes.length > 0) {
        setSelectedNode(params.nodes[0]);
      } else {
        setSelectedNode(null);
      }
    });

    network.on('doubleClick', (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const node = nodes.find((n) => n.id === nodeId);
        if (!node) return;
        navigate(getPagePath(node));
      }
    });

    return () => {
      if (networkRef.current) {
        networkRef.current.destroy();
        networkRef.current = null;
      }
    };
  }, [graphData]); // Only re-run when graphData actually changes, not on filterTypes

  // Handle filter changes by updating node/edge visibility without rebuilding network
  useEffect(() => {
    if (!networkRef.current || !graphData) return;

    const nodeIds = new Set(
      nodes.filter((n) => filterTypes.has(n.type)).map((n) => n.id)
    );

    // Update nodes: hide filtered-out types
    const nodeUpdates = nodes.map((n) => ({
      id: n.id,
      hidden: !nodeIds.has(n.id),
    }));
    (networkRef.current as any).body.data.nodes.update(nodeUpdates);

    // Update edges: hide edges with filtered-out endpoints
    const edgeUpdates = edges.map((e) => ({
      id: e.id,
      hidden: !nodeIds.has(e.from) || !nodeIds.has(e.to),
    }));
    (networkRef.current as any).body.data.edges.update(edgeUpdates);
  }, [filterTypes, graphData, nodes, edges]);

  const selectedNodeData = selectedNode ? nodes.find((n) => n.id === selectedNode) : null;

  const typeFilters = [
    { key: 'source', labelKey: 'type.source', color: 'bg-apple-blue' },
    { key: 'entity', labelKey: 'type.entity', color: 'bg-apple-green' },
    { key: 'concept', labelKey: 'type.concept', color: 'bg-apple-purple' },
    { key: 'synthesis', labelKey: 'type.synthesis', color: 'bg-apple-orange' },
  ];

  if (loading) {
    return (
      <div className="h-[calc(100vh-7rem)] -mx-6 -my-8 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={32} className="text-apple-blue animate-spin mx-auto mb-4" />
          <p className="text-sm text-[var(--text-secondary)]">{t('graph.loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !graphData) {
    return (
      <div className="h-[calc(100vh-7rem)] -mx-6 -my-8 flex items-center justify-center">
        <div className="empty-state-warm">
          <div className="text-5xl mb-4">⚠️</div>
          <h3 className="font-rounded text-xl font-semibold mb-2">{t('graph.error.title')}</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-sm">{t('graph.error.description')}</p>
          <button
            onClick={() => initialize()}
            className="apple-button-warm"
          >
            <RefreshCw size={16} />
            {t('graph.error.retry')}
          </button>
        </div>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="h-[calc(100vh-7rem)] -mx-6 -my-8 flex items-center justify-center">
        <div className="empty-state-warm">
          <div className="text-5xl mb-4">🕸️</div>
          <h3 className="font-rounded text-xl font-semibold mb-2">{t('graph.empty.title')}</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-sm">{t('graph.empty.description')}</p>
          <Link to="/browse" className="apple-button-warm">
            <BookOpen size={16} />
            {t('graph.empty.browse')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-7rem)] -mx-6 -my-8 relative">
      {/* Graph Canvas */}
      <div ref={containerRef} className="w-full h-full bg-[var(--bg-primary)]" />

      {/* Stats Overlay */}
      <GraphStats nodes={nodes} edges={edges} />

      {/* Controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 glass rounded-2xl px-3 sm:px-4 py-2 flex items-center gap-2 sm:gap-3 shadow-apple-lg">
        {typeFilters.map((tf) => (
          <button
            key={tf.key}
            onClick={() => {
              setFilterTypes((prev) => {
                const next = new Set(prev);
                if (next.has(tf.key)) next.delete(tf.key);
                else next.add(tf.key);
                return next;
              });
            }}
            className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterTypes.has(tf.key)
                ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]'
                : 'text-[var(--text-tertiary)]'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${tf.color}`} />
            <span className="hidden sm:inline">{t(tf.labelKey as any)}</span>
          </button>
        ))}
      </div>

      {/* Node Detail Panel */}
      {selectedNodeData && (
        <NodePanel
          node={selectedNodeData}
          connections={getConnectedEdges(selectedNodeData.id).length}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
}

function NodePanel({
  node,
  connections,
  onClose,
}: {
  node: { id: string; label: string; type: string; preview: string };
  connections: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const isFav = useWikiStore((s) => s.isFavorite(node.id));
  const toggleFavorite = useWikiStore((s) => s.toggleFavorite);

  const pagePath = getPagePath(node);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="absolute top-4 right-4 w-72 max-w-[80vw] glass rounded-2xl p-4 shadow-apple-lg"
    >
      <div className="flex items-start justify-between mb-1">
        <h3 className="font-semibold text-lg">{node.label}</h3>
        <button
          onClick={onClose}
          className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors p-1"
        >
          ✕
        </button>
      </div>
      <span className="text-xs text-[var(--text-secondary)] capitalize">{t(typeLabelKey(node.type) as any)}</span>
      <p className="text-sm text-[var(--text-secondary)] mt-3 line-clamp-4">{node.preview}</p>
      <div className="mt-4 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
        <NetworkIcon size={12} />
        {t('graph.connections', { count: connections })}
      </div>
      <div className="mt-4 flex items-center gap-2">
        <Link
          to={pagePath}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-apple-blue text-white text-sm font-medium hover:bg-apple-blue/90 transition-colors"
        >
          {t('graph.panel.openPage')}
          <ArrowRight size={14} />
        </Link>
        <button
          onClick={() => toggleFavorite(node.id)}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors border ${
            isFav
              ? 'bg-red-500/10 border-red-500/20 text-red-500'
              : 'bg-[var(--bg-secondary)] border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Heart size={14} fill={isFav ? 'currentColor' : 'none'} />
          {isFav ? t('graph.panel.unstar') : t('graph.panel.star')}
        </button>
      </div>
    </motion.div>
  );
}

function GraphStats({
  nodes,
  edges,
}: {
  nodes: { id: string; group: number }[];
  edges: { id: string }[];
}) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const nodeCount = nodes.length;
  const edgeCount = edges.length;
  const communityCount = new Set(nodes.map((n) => n.group)).size;
  const density = nodeCount > 1 ? (edgeCount / (nodeCount * (nodeCount - 1))).toFixed(3) : '0.000';

  return (
    <div className="absolute top-4 left-4 glass rounded-2xl p-3 shadow-apple-lg z-10 w-44">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-between w-full text-xs font-semibold text-[var(--text-primary)] mb-2"
      >
        <span className="flex items-center gap-1.5">
          <BarChart3 size={12} />
          {t('graph.stats.title')}
        </span>
        {collapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
      </button>
      {!collapsed && (
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between text-[var(--text-secondary)]">
            <span>{t('graph.stats.nodes')}</span>
            <span className="font-medium text-[var(--text-primary)]">{nodeCount}</span>
          </div>
          <div className="flex justify-between text-[var(--text-secondary)]">
            <span>{t('graph.stats.edges')}</span>
            <span className="font-medium text-[var(--text-primary)]">{edgeCount}</span>
          </div>
          <div className="flex justify-between text-[var(--text-secondary)]">
            <span>{t('graph.stats.communities')}</span>
            <span className="font-medium text-[var(--text-primary)]">{communityCount}</span>
          </div>
          <div className="flex justify-between text-[var(--text-secondary)]">
            <span>{t('graph.stats.density')}</span>
            <span className="font-medium text-[var(--text-primary)]">{density}</span>
          </div>
        </div>
      )}
    </div>
  );
}
