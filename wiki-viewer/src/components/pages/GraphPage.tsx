import { useEffect, useRef, useState, useCallback, useMemo } from 'react';

// Dark-mode-optimized palette: reads from CSS variables at runtime
function getAppleNodePalette(): string[] {
  const root = getComputedStyle(document.documentElement);
  return [
    root.getPropertyValue('--apple-blue').trim() || '#0A84FF',
    root.getPropertyValue('--apple-green').trim() || '#30B350',
    root.getPropertyValue('--apple-purple').trim() || '#A855F7',
    root.getPropertyValue('--apple-orange').trim() || '#D97706',
    root.getPropertyValue('--apple-red').trim() || '#E11D48',
    root.getPropertyValue('--apple-teal').trim() || '#38BDF8',
  ];
}
function getAppleNodeColor(group: number): string {
  const palette = getAppleNodePalette();
  return palette[group % palette.length];
}
function getThemeColors(): Record<string, string> {
  const root = getComputedStyle(document.documentElement);
  return {
    source: root.getPropertyValue('--apple-blue').trim() || '#0A84FF',
    entity: root.getPropertyValue('--apple-green').trim() || '#30B350',
    concept: root.getPropertyValue('--apple-purple').trim() || '#A855F7',
    synthesis: root.getPropertyValue('--apple-orange').trim() || '#D97706',
  };
}
const EDGE_COLOR_EXTRACTED = 'rgba(0, 122, 255, 0.25)';
const EDGE_COLOR_INFERRED = 'rgba(120, 120, 128, 0.15)';
const EDGE_COLOR_AMBIGUOUS = 'rgba(120, 120, 128, 0.08)';
function getAppleEdgeColor(edgeType: string): string {
  if (edgeType === 'EXTRACTED') return EDGE_COLOR_EXTRACTED;
  if (edgeType === 'AMBIGUOUS') return EDGE_COLOR_AMBIGUOUS;
  return EDGE_COLOR_INFERRED;
}

function getComputedColor(varName: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || '#1d1d1f';
}

const GRAPH_ONBOARDED_KEY = 'wiki-graph-onboarded';

import { Link, useNavigate } from 'react-router-dom';
import { Network as VisNetwork, DataSet } from 'vis-network/standalone';
import type { Network } from 'vis-network';
import { Network as NetworkIcon, Loader2, RefreshCw, BookOpen, Heart, ArrowRight, BarChart3, ChevronDown, ChevronUp, X, Frown, MousePointer2, ZoomIn, Move, Save, Wrench, Download, Trash2, Plus, Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWikiStore } from '@/stores/wikiStore';
import { motion, AnimatePresence } from 'framer-motion';
import { typeLabelKey } from '@/i18n';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { safeGet, safeSet } from '@/lib/safeStorage';
import { getPagePath } from '@/lib/wikilink';

export function GraphPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);
  const nodesDataSetRef = useRef<DataSet<unknown> | null>(null);
  const edgesDataSetRef = useRef<DataSet<unknown> | null>(null);
  const graphData = useWikiStore((s) => s.graphData);
  const loading = useWikiStore((s) => s.loading);
  const error = useWikiStore((s) => s.error);
  const initialize = useWikiStore((s) => s.initialize);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  useDocumentTitle(t('nav.graph'));

  const [filterTypes, setFilterTypes] = useState<Set<string>>(new Set(['source', 'entity', 'concept', 'synthesis']));
  const [filterCommunities, setFilterCommunities] = useState<Set<number> | null>(null); // null = all
  const [showCommunityFilter, setShowCommunityFilter] = useState(false);
  const [showOnboard, setShowOnboard] = useState(() => !safeGet(GRAPH_ONBOARDED_KEY, (v): v is string => typeof v === 'string', ''));
  const [isEditing, setIsEditing] = useState(false);
  const [saveLayoutMsg, setSaveLayoutMsg] = useState('');

  // Close onboarding on Escape
  useEffect(() => {
    if (!showOnboard) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowOnboard(false);
        safeSet(GRAPH_ONBOARDED_KEY, '1');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showOnboard]);

  // Close community filter on outside click
  useEffect(() => {
    if (!showCommunityFilter) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-community-filter]')) {
        setShowCommunityFilter(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showCommunityFilter]);

  const nodes = useMemo(() => graphData?.nodes || [], [graphData]);
  const edges = useMemo(() => graphData?.edges || [], [graphData]);

  const communities = useMemo(() => {
    const map = new Map<number, number>();
    nodes.forEach((n) => {
      const g = n.group ?? 0;
      map.set(g, (map.get(g) || 0) + 1);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id, count]) => ({ id, count }));
  }, [nodes]);

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

    const fontColor = getComputedColor('--text-primary');

    const themeColors = getThemeColors();
    const visNodes = nodes
      .filter((n) => filterTypes.has(n.type) && (!filterCommunities || filterCommunities.has(n.group ?? 0)))
      .map((n) => {
        const ic = themeColors[n.type] || getAppleNodeColor(n.group);
        return {
          id: n.id,
          label: n.label,
          type: n.type,
          color: {
            background: ic,
            border: ic,
            highlight: { background: ic, border: '#fff' },
          },
          value: n.value,
          title: n.preview,
          font: {
            color: fontColor,
            size: 13,
            face: 'system-ui, -apple-system, sans-serif',
            strokeWidth: 3,
            strokeColor: getComputedColor('--bg-primary'),
          },
        };
      });

    const nodeIds = new Set(visNodes.map((n) => n.id));
    const visEdges = edges
      .filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to))
      .map((e) => ({
        id: e.id,
        from: e.from,
        to: e.to,
        color: { color: getAppleEdgeColor(e.type), highlight: '#fff' },
        width: e.type === 'EXTRACTED' ? 1.5 : 0.8,
        dashes: e.type === 'AMBIGUOUS',
        arrows: 'to' as const,
      }));

    const nodesDataSet = new DataSet(visNodes);
    const edgesDataSet = new DataSet(visEdges);
    nodesDataSetRef.current = nodesDataSet;
    edgesDataSetRef.current = edgesDataSet;

    const network = new VisNetwork(
      containerRef.current,
      { nodes: nodesDataSet, edges: edgesDataSet },
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
      if (isEditing) return; // Disable navigation in edit mode
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphData, isEditing, filterTypes, filterCommunities]); // Re-run when filters change

  // Update node colors when theme changes
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      if (!nodesDataSetRef.current) return;
      const fontColor = getComputedColor('--text-primary');
      const strokeColor = getComputedColor('--bg-primary');
      const themeColors = getThemeColors();
      const allNodes = nodesDataSetRef.current.get();
      nodesDataSetRef.current.update(
        (allNodes as any[]).map((n) => {
          const ic = themeColors[n.type] || n.color?.background || '#0A84FF';
          return {
            id: n.id,
            color: { background: ic, border: ic, highlight: { background: ic, border: '#fff' } },
            font: { ...n.font, color: fontColor, strokeColor },
          };
        })
      );
    });
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Handle filter changes by updating node/edge visibility without rebuilding network
  useEffect(() => {
    if (!networkRef.current || !graphData) return;

    const nodeIds = new Set(
      nodes.filter((n) => filterTypes.has(n.type) && (!filterCommunities || filterCommunities.has(n.group ?? 0))).map((n) => n.id)
    );

    // Update nodes: hide filtered-out types
    const nodeUpdates = nodes.map((n) => ({
      id: n.id,
      hidden: !nodeIds.has(n.id),
    }));
    nodesDataSetRef.current?.update(nodeUpdates);

    // Update edges: hide edges with filtered-out endpoints
    const edgeUpdates = edges.map((e) => ({
      id: e.id,
      hidden: !nodeIds.has(e.from) || !nodeIds.has(e.to),
    }));
    edgesDataSetRef.current?.update(edgeUpdates);
  }, [filterTypes, filterCommunities, graphData, nodes, edges]);

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
          <div className="flex justify-center mb-4">
            <Frown size={48} className="text-apple-orange" />
          </div>
          <h3 className="text-xl font-semibold mb-2">{t('graph.error.title')}</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-sm">{t('graph.error.description')}</p>
          <button
            onClick={() => initialize()}
            className="apple-button"
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
          <div className="flex justify-center mb-4">
            <NetworkIcon size={48} className="text-apple-blue" />
          </div>
          <h3 className="text-xl font-semibold mb-2">{t('graph.empty.title')}</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-sm">{t('graph.empty.description')}</p>
          <Link to="/browse" className="apple-button">
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
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 glass rounded-2xl px-2 sm:px-4 py-2 flex items-center gap-1 sm:gap-3">
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
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs font-medium transition-all rounded-xl ${
              filterTypes.has(tf.key)
                ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]'
                : 'text-[var(--text-tertiary)]'
            }`}
            title={t(tf.labelKey as string)}
            aria-pressed={filterTypes.has(tf.key)}
          >
            <span className={`w-2 h-2 rounded-full ${tf.color}`} />
            <span className="hidden sm:inline">{t(tf.labelKey as string)}</span>
            <span className="sm:hidden uppercase text-[10px]">{tf.key[0]}</span>
          </button>
        ))}
        <div className="w-px h-4 bg-[var(--border-default)] mx-1" />
        {communities.length > 1 && (
        <div className="relative" data-community-filter>
          <button
            onClick={() => setShowCommunityFilter((v) => !v)}
            className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs font-medium transition-all rounded-xl ${
              filterCommunities !== null
                ? 'bg-apple-purple/10 text-apple-purple'
                : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
            }`}
            title={t('graph.communityFilter', 'Community Filter')}
          >
            <Layers size={14} />
            <span className="hidden sm:inline">
              {filterCommunities !== null
                ? `${filterCommunities.size} ${t('graph.communities', 'communities')}`
                : t('graph.communityFilter', 'Communities')}
            </span>
          </button>
          {showCommunityFilter && communities.length > 1 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute bottom-full mb-2 left-0 glass rounded-xl p-3 min-w-[200px] max-h-60 overflow-y-auto z-50 space-y-1.5"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-[var(--text-secondary)]">
                  {t('graph.communityFilter', 'Communities')}
                </span>
                <button
                  onClick={() => setFilterCommunities(null)}
                  className="text-[10px] text-apple-blue hover:underline"
                >
                  {t('graph.showAll', 'Show All')}
                </button>
              </div>
              {communities.map((c) => {
                const active = filterCommunities === null || filterCommunities.has(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setFilterCommunities((prev) => {
                        if (prev === null) {
                          return new Set([c.id]);
                        }
                        const next = new Set(prev);
                        if (next.has(c.id)) {
                          next.delete(c.id);
                        } else {
                          next.add(c.id);
                        }
                        return next.size === 0 ? null : next;
                      });
                    }}
                    className={`flex items-center gap-2 w-full px-2 py-1 rounded-lg text-xs transition-colors ${
                      active ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] opacity-50'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: getAppleNodeColor(c.id) }}
                    />
                    <span className="flex-1 text-left">
                      {t('graph.communityLabel', 'Group')} {String.fromCharCode(65 + (c.id % 26))}
                    </span>
                    <span className="text-[10px] text-[var(--text-tertiary)]">{c.count}</span>
                  </button>
                );
              })}
            </motion.div>
          )}
        </div>
        )}
        <div className="w-px h-4 bg-[var(--border-default)] mx-1" />
        <button
          onClick={() => setIsEditing((v) => !v)}
          className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs font-medium transition-all rounded-xl ${
            isEditing
              ? 'bg-apple-orange/10 text-apple-orange'
              : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
          }`}
          title={isEditing ? 'Exit edit mode' : 'Edit graph layout'}
          aria-pressed={isEditing}
          aria-label={isEditing ? 'Exit edit mode' : 'Edit graph layout'}
        >
          <Wrench size={14} />
          <span className="hidden sm:inline">{isEditing ? 'Editing' : 'Edit'}</span>
        </button>
        {isEditing && (
          <>
            <button
              onClick={async () => {
                const net = networkRef.current;
                if (!net) return;
                const positions = net.getPositions();
                try {
                  const res = await fetch('/api/graph/save-layout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ positions }),
                  });
                  if (res.ok) {
                    setSaveLayoutMsg('Layout saved');
                    setTimeout(() => setSaveLayoutMsg(''), 2000);
                  } else {
                    setSaveLayoutMsg('Save failed');
                  }
                } catch {
                  setSaveLayoutMsg('Save failed');
                }
              }}
              className="flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs font-medium transition-all rounded-xl text-apple-green bg-apple-green/10"
            >
              <Save size={14} />
              <span className="hidden sm:inline">Save</span>
            </button>
            <button
              onClick={() => {
                const net = networkRef.current;
                if (!net) return;
                const selected = net.getSelectedNodes();
                if (selected.length === 0) return;
                if (!window.confirm(`Delete ${selected.length} selected node(s)?`)) return;
                const ds = nodesDataSetRef.current;
                if (ds) {
                  selected.forEach((id: string) => ds.remove(id));
                }
              }}
              className="flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs font-medium transition-all rounded-xl text-red-500 bg-red-500/10"
              title="Delete selected nodes"
              aria-label="Delete selected nodes"
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </>
        )}
        {saveLayoutMsg && (
          <span className="text-xs text-[var(--text-secondary)]">{saveLayoutMsg}</span>
        )}
        <div className="w-px h-4 bg-[var(--border-default)] mx-1" />
        <button
          onClick={() => {
            if (!graphData) return;
            const blob = new Blob([JSON.stringify(graphData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `graph-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs font-medium transition-all rounded-xl text-[var(--text-tertiary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
          title="Export graph JSON"
          aria-label="Export graph JSON"
        >
          <Download size={14} />
          <span className="hidden sm:inline">Export</span>
        </button>
      </div>

      {/* Node Detail Panel */}
      {selectedNodeData && (
        <NodePanel
          node={selectedNodeData}
          connections={getConnectedEdges(selectedNodeData.id).length}
          onClose={() => setSelectedNode(null)}
        />
      )}

      {/* First-visit onboarding overlay */}
      <AnimatePresence>
        {showOnboard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              e.stopPropagation();
              setShowOnboard(false);
              safeSet(GRAPH_ONBOARDED_KEY, '1');
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-[var(--bg-primary)] rounded-2xl p-6 max-w-xs mx-4 shadow-xl border border-[var(--border-default)]"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold mb-4 text-center">{t('graph.tour.title')}</h3>
              <div className="space-y-3 mb-5">
                {[
                  { icon: MousePointer2, label: t('graph.tour.click') },
                  { icon: ZoomIn, label: t('graph.tour.zoom') },
                  { icon: Move, label: t('graph.tour.drag') },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
                    <div className="p-2 rounded-xl bg-apple-blue/10 text-apple-blue">
                      <item.icon size={16} />
                    </div>
                    {item.label}
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  setShowOnboard(false);
                  safeSet(GRAPH_ONBOARDED_KEY, '1');
                }}
                className="apple-button w-full justify-center text-sm"
              >
                {t('graph.tour.gotIt')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
      className="absolute top-4 right-4 w-72 max-w-[80vw] glass rounded-2xl p-4"
    >
      <div className="flex items-start justify-between mb-1">
        <h3 className="font-semibold text-lg">{node.label}</h3>
        <button
          onClick={onClose}
          className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors p-1"
          aria-label={t('common.close')}
        >
          <X size={16} />
        </button>
      </div>
      <span className="text-xs text-[var(--text-secondary)] capitalize">{t(typeLabelKey(node.type) as string)}</span>
      <p className="text-sm text-[var(--text-secondary)] mt-3 line-clamp-4">{node.preview}</p>
      <div className="mt-4 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
        <NetworkIcon size={12} />
        {t('graph.connections', { count: connections })}
      </div>
      <div className="mt-4 flex items-center gap-2">
        <Link
          to={pagePath}
          className="apple-button flex-1 justify-center text-sm"
        >
          {t('graph.panel.openPage')}
          <ArrowRight size={14} />
        </Link>
        <button
          onClick={() => toggleFavorite(node.id)}
          className={`apple-button-ghost flex-1 text-sm ${
            isFav
              ? 'bg-red-500/10 border-red-500/20 text-red-500'
              : ''
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
    <div className="absolute top-4 left-4 glass rounded-2xl p-3 z-10 w-44">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-between w-full text-xs font-semibold text-[var(--text-primary)] mb-2"
        aria-expanded={!collapsed}
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
