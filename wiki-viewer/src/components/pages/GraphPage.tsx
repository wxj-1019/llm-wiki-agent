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
const EDGE_COLOR_EXTRACTED = 'rgba(10, 132, 255, 0.18)';
const EDGE_COLOR_INFERRED = 'rgba(140, 140, 150, 0.12)';
const EDGE_COLOR_AMBIGUOUS = 'rgba(140, 140, 150, 0.06)';
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

import { Network as NetworkIcon, Loader2, RefreshCw, BookOpen, Heart, ArrowRight, BarChart3, ChevronDown, ChevronUp, X, Frown, MousePointer2, ZoomIn, Move, Save, Wrench, Download, Trash2, Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWikiStore } from '@/stores/wikiStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { motion, AnimatePresence } from 'framer-motion';
import { typeLabelKey } from '@/i18n';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { safeGet, safeSet } from '@/lib/safeStorage';
import { getPagePath } from '@/lib/wikilink';

export function GraphPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const networkRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodesDataSetRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const edgesDataSetRef = useRef<any>(null);
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
  const [rebuilding, setRebuilding] = useState(false);
  const [loadPhase, setLoadPhase] = useState('');
  const [loadProgress, setLoadProgress] = useState(0);
  const initRef = useRef(false);
  const addNotification = useNotificationStore((s) => s.addNotification);

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

  // Build vis-formatted data from raw graph data
  const buildVisData = useCallback(() => {
    const fontColor = getComputedColor('--text-primary');
    const themeColors = getThemeColors();
    const visNodes = nodes.map((n) => {
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
    return { visNodes, visEdges };
  }, [nodes, edges]);

  // Main network initialization / update effect
  useEffect(() => {
    if (!containerRef.current || !graphData || nodes.length === 0) return;

    const { visNodes, visEdges } = buildVisData();

    // If network already exists, just update datasets instead of destroy+recreate
    if (networkRef.current && nodesDataSetRef.current && edgesDataSetRef.current) {
      nodesDataSetRef.current.clear();
      edgesDataSetRef.current.clear();
      nodesDataSetRef.current.add(visNodes);
      edgesDataSetRef.current.add(visEdges);
      return;
    }

    // First-time initialization
    setLoadPhase('Building knowledge graph...');
    setLoadProgress(10);

    const nodesDataSet = new DataSet(visNodes);
    const edgesDataSet = new DataSet(visEdges);
    nodesDataSetRef.current = nodesDataSet;
    edgesDataSetRef.current = edgesDataSet;

    setLoadProgress(30);
    setLoadPhase('Computing layout...');

    const gravConst = nodes.length > 150 ? -12000 : nodes.length > 80 ? -8000 : -3000;
    const springLen = nodes.length > 150 ? 200 : nodes.length > 80 ? 160 : 120;

    const network = new VisNetwork(
      containerRef.current,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { nodes: nodesDataSet as any, edges: edgesDataSet as any },
      {
        physics: {
          stabilization: { iterations: 150, updateInterval: 25, fit: true },
          barnesHut: {
            gravitationalConstant: gravConst,
            springLength: springLen,
            springConstant: 0.04,
            damping: 0.15,
          },
          minVelocity: 0.75,
        },
        interaction: { hover: true, tooltipDelay: 150, hideEdgesOnDrag: true, hideEdgesOnZoom: true },
        nodes: {
          shape: 'dot',
          scaling: { min: 8, max: 30 },
        },
      }
    );

    networkRef.current = network;
    initRef.current = true;

    // Throttle progress updates to avoid React re-rendering 40×/sec
    let lastProgress = -1;
    let rafId: number | null = null;
    network.on('stabilizationProgress', (params: any) => {
      const pct = Math.min(100, Math.round((params.iterations / params.total) * 100));
      const nextProgress = 30 + Math.round(pct * 0.65);
      if (nextProgress !== lastProgress) {
        lastProgress = nextProgress;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => setLoadProgress(nextProgress));
      }
    });

    network.once('stabilizationIterationsDone', () => {
      if (rafId) cancelAnimationFrame(rafId);
      setLoadProgress(100);
      // Let overlay fade out before fitting viewport so the transition feels seamless
      setTimeout(() => {
        setLoadPhase('');
        network.fit({ animation: { duration: 400, easingFunction: 'easeInOutQuad' } });
      }, 200);
    });

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
        initRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphData, isEditing]);

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (allNodes as any[]).map((n: any) => {
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

  const showLoader = loading || loadPhase !== '';

  if (error || !graphData) {
    return (
      <div className="h-full flex items-center justify-center">
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
      <div className="h-full flex items-center justify-center">
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
    <div className="h-full relative">
      {/* Graph Canvas */}
      <div ref={containerRef} className="w-full h-full bg-[var(--bg-primary)]" />

      {/* Loading Overlay — rendered on top so canvas initializes behind it */}
      <AnimatePresence>
        {showLoader && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-[var(--bg-primary)]"
          >
            <div className="text-center">
              {/* Neural Constellation Loader */}
              <div className="relative w-[140px] h-[140px] mx-auto mb-5">
                {/* Core */}
                <div
                  className="absolute top-1/2 left-1/2 w-4 h-4 -ml-2 -mt-2 rounded-full z-10"
                  style={{
                    background: 'radial-gradient(circle, #ffab91 0%, #ff5722 70%)',
                    boxShadow: '0 0 20px rgba(255,87,34,0.5), 0 0 40px rgba(255,87,34,0.25), 0 0 80px rgba(255,87,34,0.1)',
                    animation: 'kb-core-pulse 2.4s ease-in-out infinite',
                  }}
                />
                {/* Orbit 1 */}
                <div
                  className="absolute top-1/2 left-1/2 rounded-full border border-dashed border-white/[0.07]"
                  style={{ width: 44, height: 44, animation: 'kb-spin 6s linear infinite', transformOrigin: 'center' }}
                >
                  <div
                    className="absolute top-1/2 left-1/2 w-1.5 h-1.5 -ml-[3px] -mt-[3px] rounded-full"
                    style={{
                      background: '#4fc3f7',
                      '--kb-color': '#4fc3f7',
                      '--kb-angle': '0deg',
                      '--kb-orbit-r': '22px',
                      transform: 'rotate(0deg) translateY(-22px)',
                      animation: 'kb-node-glow 2.2s ease-in-out infinite',
                    } as React.CSSProperties}
                  />
                  <div
                    className="absolute top-1/2 left-1/2 w-[3px] h-[3px] -ml-[1.5px] -mt-[1.5px] rounded-full bg-white"
                    style={{
                      '--kb-p-angle': '180deg',
                      '--kb-orbit-r': '22px',
                      transform: 'rotate(180deg) translateY(-22px)',
                      animation: 'kb-particle-travel 3s ease-out infinite',
                      animationDelay: '0.5s',
                      opacity: 0,
                    } as React.CSSProperties}
                  />
                </div>
                {/* Orbit 2 */}
                <div
                  className="absolute top-1/2 left-1/2 rounded-full border border-dashed border-white/[0.07]"
                  style={{ width: 76, height: 76, animation: 'kb-spin 10s linear infinite reverse', transformOrigin: 'center' }}
                >
                  <div
                    className="absolute top-1/2 left-1/2 w-1.5 h-1.5 -ml-[3px] -mt-[3px] rounded-full"
                    style={{
                      background: '#81c784',
                      '--kb-color': '#81c784',
                      '--kb-angle': '60deg',
                      '--kb-orbit-r': '38px',
                      transform: 'rotate(60deg) translateY(-38px)',
                      animation: 'kb-node-glow 2.8s ease-in-out infinite',
                      animationDelay: '0.4s',
                    } as React.CSSProperties}
                  />
                  <div
                    className="absolute top-1/2 left-1/2 w-1.5 h-1.5 -ml-[3px] -mt-[3px] rounded-full"
                    style={{
                      background: '#ffb74d',
                      '--kb-color': '#ffb74d',
                      '--kb-angle': '240deg',
                      '--kb-orbit-r': '38px',
                      transform: 'rotate(240deg) translateY(-38px)',
                      animation: 'kb-node-glow 2.8s ease-in-out infinite',
                      animationDelay: '0.8s',
                    } as React.CSSProperties}
                  />
                  <div
                    className="absolute top-1/2 left-1/2 w-[3px] h-[3px] -ml-[1.5px] -mt-[1.5px] rounded-full bg-white"
                    style={{
                      '--kb-p-angle': '300deg',
                      '--kb-orbit-r': '38px',
                      transform: 'rotate(300deg) translateY(-38px)',
                      animation: 'kb-particle-travel 3s ease-out infinite',
                      animationDelay: '1.2s',
                      opacity: 0,
                    } as React.CSSProperties}
                  />
                </div>
                {/* Orbit 3 */}
                <div
                  className="absolute top-1/2 left-1/2 rounded-full border border-dashed border-white/[0.07]"
                  style={{ width: 108, height: 108, animation: 'kb-spin 14s linear infinite', transformOrigin: 'center' }}
                >
                  <div
                    className="absolute top-1/2 left-1/2 w-1.5 h-1.5 -ml-[3px] -mt-[3px] rounded-full"
                    style={{
                      background: '#ba68c8',
                      '--kb-color': '#ba68c8',
                      '--kb-angle': '120deg',
                      '--kb-orbit-r': '54px',
                      transform: 'rotate(120deg) translateY(-54px)',
                      animation: 'kb-node-glow 3.4s ease-in-out infinite',
                      animationDelay: '0.2s',
                    } as React.CSSProperties}
                  />
                  <div
                    className="absolute top-1/2 left-1/2 w-1.5 h-1.5 -ml-[3px] -mt-[3px] rounded-full"
                    style={{
                      background: '#e57373',
                      '--kb-color': '#e57373',
                      '--kb-angle': '240deg',
                      '--kb-orbit-r': '54px',
                      transform: 'rotate(240deg) translateY(-54px)',
                      animation: 'kb-node-glow 3.4s ease-in-out infinite',
                      animationDelay: '1.0s',
                    } as React.CSSProperties}
                  />
                  <div
                    className="absolute top-1/2 left-1/2 w-1.5 h-1.5 -ml-[3px] -mt-[3px] rounded-full"
                    style={{
                      background: '#4dd0e1',
                      '--kb-color': '#4dd0e1',
                      '--kb-angle': '0deg',
                      '--kb-orbit-r': '54px',
                      transform: 'rotate(0deg) translateY(-54px)',
                      animation: 'kb-node-glow 3.4s ease-in-out infinite',
                      animationDelay: '1.4s',
                    } as React.CSSProperties}
                  />
                  <div
                    className="absolute top-1/2 left-1/2 w-[3px] h-[3px] -ml-[1.5px] -mt-[1.5px] rounded-full bg-white"
                    style={{
                      '--kb-p-angle': '90deg',
                      '--kb-orbit-r': '54px',
                      transform: 'rotate(90deg) translateY(-54px)',
                      animation: 'kb-particle-travel 3s ease-out infinite',
                      animationDelay: '2.0s',
                      opacity: 0,
                    } as React.CSSProperties}
                  />
                </div>
              </div>

              <p className="text-[15px] font-medium text-[var(--text-primary)] tracking-wide">
                {loadPhase || t('graph.loading')}
              </p>
              {loadProgress > 0 && (
                <>
                  <div className="w-60 h-[3px] bg-white/[0.06] rounded-full overflow-hidden mt-3.5 mx-auto">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${loadProgress}%`,
                        background: 'linear-gradient(90deg, #ff5722, #ff8a65)',
                        boxShadow: '0 0 8px rgba(255,87,34,0.3)',
                      }}
                    />
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-2">{loadProgress}%</p>
                </>
              )}
              {!loadPhase && nodes.length > 0 && (
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  {nodes.length} nodes · {edges.length} edges
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Overlay */}
      <GraphStats nodes={nodes} edges={edges} />

      {/* Controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 glass rounded-2xl px-2 sm:px-4 py-2 flex items-center gap-1 sm:gap-3 max-w-[calc(100vw-2rem)] overflow-x-auto">
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
                if (!window.confirm(t('graph.confirmDelete', { count: selected.length }))) return;
                const ds = nodesDataSetRef.current;
                if (ds) {
                  selected.forEach((id: string) => ds.remove(id));
                }
              }}
              className="flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs font-medium transition-all rounded-xl text-red-500 bg-red-500/10"
              title={t('graph.tooltip.deleteSelected')}
              aria-label={t('graph.tooltip.deleteSelected')}
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
          onClick={async () => {
            setRebuilding(true);
            try {
              const res = await fetch('/api/tools/build-graph', { method: 'POST' });
              if (res.ok) {
                addNotification(t('graph.rebuildSuccess'), 'success');
                initialize();
              } else {
                addNotification(t('graph.rebuildFailed'), 'error');
              }
            } catch {
              addNotification(t('graph.rebuildFailed'), 'error');
            } finally {
              setRebuilding(false);
            }
          }}
          disabled={rebuilding}
          className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs font-medium transition-all rounded-xl ${
            rebuilding
              ? 'bg-apple-green/10 text-apple-green'
              : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
          }`}
          title={t('graph.tooltip.rebuild')}
          aria-label={t('graph.tooltip.rebuild')}
        >
          <RefreshCw size={14} className={rebuilding ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Rebuild</span>
        </button>
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
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-md"
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
