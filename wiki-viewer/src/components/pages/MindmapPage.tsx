import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useWikiStore } from '@/stores/wikiStore';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { extractWikiLinks } from '@/lib/wikilink';
import { getPagePath } from '@/lib/wikilink';
import { motion } from 'framer-motion';
import { Network, ChevronRight, Download } from 'lucide-react';
import { useNotificationStore } from '@/stores/notificationStore';
import { MindmapSkeleton } from '@/components/ui/Skeleton';

const MAX_DEPTH = 3;
function getNodeColors(): Record<string, string> {
  const root = getComputedStyle(document.documentElement);
  return {
    source: root.getPropertyValue('--apple-blue').trim() || '#007AFF',
    entity: root.getPropertyValue('--apple-green').trim() || '#34C759',
    concept: root.getPropertyValue('--apple-purple').trim() || '#AF52DE',
    synthesis: root.getPropertyValue('--apple-orange').trim() || '#FF9500',
  };
}

interface MindNode {
  id: string;
  label: string;
  type: string;
  depth: number;
  children: MindNode[];
}

function buildMindTree(
  nodeId: string,
  nodeMap: Map<string, { id: string; label: string; type: string; markdown: string }>,
  labelMap: Map<string, string>,
  depth: number,
  visited: Set<string> = new Set()
): MindNode | null {
  if (depth > MAX_DEPTH || visited.has(nodeId)) return null;
  visited.add(nodeId);

  const node = nodeMap.get(nodeId);
  if (!node) return null;

  const links = extractWikiLinks(node.markdown);
  const children: MindNode[] = [];

  for (const link of links.slice(0, 8)) {
    const targetId = labelMap.get(link.toLowerCase());
    const target = targetId ? nodeMap.get(targetId) : undefined;
    if (target) {
      const child = buildMindTree(target.id, nodeMap, labelMap, depth + 1, new Set(visited));
      if (child) children.push(child);
    }
  }

  return {
    id: node.id,
    label: node.label,
    type: node.type,
    depth,
    children,
  };
}

function MindNodeComponent({ node, nodeMap }: { node: MindNode; nodeMap: Map<string, { id: string; label: string; type: string }> }) {
  const [expanded, setExpanded] = useState(node.depth < 2);
  const targetNode = nodeMap.get(node.id);
  const hasChildren = node.children.length > 0;

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 py-1">
        {hasChildren && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-0.5 rounded hover:bg-[var(--bg-secondary)] transition-colors"
            aria-label={expanded ? 'Collapse' : 'Expand'}
            aria-expanded={expanded}
          >
            <ChevronRight
              size={14}
              className={`text-[var(--text-tertiary)] transition-transform ${expanded ? 'rotate-90' : ''}`}
            />
          </button>
        )}
        {!hasChildren && <span className="w-5 shrink-0" aria-hidden="true" />}
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: getNodeColors()[node.type] || '#999' }}
        />
        {targetNode ? (
          <Link
            to={getPagePath(targetNode)}
            className="text-sm hover:text-apple-blue transition-colors truncate"
          >
            {node.label}
          </Link>
        ) : (
          <span className="text-sm truncate">{node.label}</span>
        )}
      </div>
      {expanded && hasChildren && (
        <div className="ml-5 pl-3 border-l border-[var(--border-default)]">
          {node.children.map((child) => (
            <MindNodeComponent key={child.id} node={child} nodeMap={nodeMap} />
          ))}
        </div>
      )}
    </div>
  );
}

export function MindmapPage() {
  const { slug } = useParams();
  const graphData = useWikiStore((s) => s.graphData);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const nodes = useMemo(() => graphData?.nodes || [], [graphData?.nodes]);
  const loading = useWikiStore((s) => s.loading);
  useDocumentTitle('Mindmap');

  const { rootNode, nodeMap } = useMemo(() => {
    if (!slug || !graphData) return { rootNode: null, nodeMap: new Map() };
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const labelMap = new Map<string, string>();
    for (const n of nodes) {
      labelMap.set(n.label.toLowerCase(), n.id);
    }
    const target = nodes.find(
      (n) => n.id.endsWith(`/${slug}`) || n.label.toLowerCase() === slug.toLowerCase()
    );
    if (!target) return { rootNode: null, nodeMap };
    return { rootNode: buildMindTree(target.id, nodeMap, labelMap, 0), nodeMap };
  }, [slug, nodes, graphData]);

  if (loading || !graphData || nodes.length === 0) {
    return <MindmapSkeleton />;
  }

  if (!rootNode) {
    return (
      <div className="empty-state-warm mt-20">
        <Network size={48} className="text-[var(--text-tertiary)] mb-3" />
        <h3 className="text-lg font-semibold">Page not found</h3>
      </div>
    );
  }

  const handleExport = () => {
    try {
      const svg = document.getElementById('mindmap-svg');
      if (!svg) throw new Error('SVG not found');
      const serializer = new XMLSerializer();
      const source = serializer.serializeToString(svg);
      const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mindmap-${slug}.svg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      addNotification(`Export failed: ${(e as Error).message}`, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Mindmap: {rootNode.label}</h1>
        <button
          onClick={handleExport}
          className="apple-button-ghost flex items-center gap-2"
        >
          <Download size={16} />
          Export SVG
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="apple-card p-6"
      >
        <MindNodeComponent node={rootNode} nodeMap={nodeMap} />
      </motion.div>
    </div>
  );
}
