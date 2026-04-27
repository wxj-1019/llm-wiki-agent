import { useEffect, useRef, useState, useCallback } from 'react';
import { Network as VisNetwork } from 'vis-network/standalone';
import type { Network } from 'vis-network';
import { Network as NetworkIcon } from 'lucide-react';
import { useWikiStore } from '@/stores/wikiStore';
import { motion } from 'framer-motion';

export function GraphPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);
  const graphData = useWikiStore((s) => s.graphData);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [filterTypes, setFilterTypes] = useState<Set<string>>(new Set(['source', 'entity', 'concept', 'synthesis']));

  const nodes = graphData?.nodes || [];
  const edges = graphData?.edges || [];

  const getConnectedEdges = useCallback((nodeId: string) => {
    return edges.filter((e) => e.from === nodeId || e.to === nodeId);
  }, [edges]);

  useEffect(() => {
    if (!containerRef.current || !graphData) return;

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

    return () => network.destroy();
  }, [graphData, filterTypes, nodes, edges]);

  const selectedNodeData = selectedNode ? nodes.find((n) => n.id === selectedNode) : null;

  const typeFilters = [
    { key: 'source', label: 'Source', color: 'bg-apple-blue' },
    { key: 'entity', label: 'Entity', color: 'bg-apple-green' },
    { key: 'concept', label: 'Concept', color: 'bg-apple-purple' },
    { key: 'synthesis', label: 'Synthesis', color: 'bg-apple-orange' },
  ];

  return (
    <div className="h-[calc(100vh-7rem)] -mx-6 -my-8 relative">
      {/* Graph Canvas */}
      <div ref={containerRef} className="w-full h-full bg-[var(--bg-primary)]" />

      {/* Controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 glass rounded-2xl px-4 py-2 flex items-center gap-3 shadow-apple-lg">
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
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterTypes.has(tf.key)
                ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]'
                : 'text-[var(--text-tertiary)]'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${tf.color}`} />
            {tf.label}
          </button>
        ))}
      </div>

      {/* Node Detail Panel */}
      {selectedNodeData && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="absolute top-4 right-4 w-72 glass rounded-2xl p-4 shadow-apple-lg"
        >
          <h3 className="font-semibold text-lg mb-1">{selectedNodeData.label}</h3>
          <span className="text-xs text-[var(--text-secondary)] capitalize">{selectedNodeData.type}</span>
          <p className="text-sm text-[var(--text-secondary)] mt-3 line-clamp-4">{selectedNodeData.preview}</p>
          <div className="mt-4 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <NetworkIcon size={12} />
            {getConnectedEdges(selectedNodeData.id).length} connections
          </div>
        </motion.div>
      )}
    </div>
  );
}
