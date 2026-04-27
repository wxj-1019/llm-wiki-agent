import { useNavigate } from 'react-router-dom';
import { useWikiStore } from '@/stores/wikiStore';

interface WikiLinkProps {
  target: string;
  children: React.ReactNode;
}

export function WikiLink({ target, children }: WikiLinkProps) {
  const navigate = useNavigate();
  const nodes = useWikiStore((s) => s.graphData?.nodes ?? []);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const node = nodes.find(
      (n) =>
        n.label.toLowerCase() === target.toLowerCase() ||
        n.id.endsWith(`/${target}`)
    );
    if (node) {
      const prefixMap: Record<string, string> = { source: 's', entity: 'e', concept: 'c', synthesis: 'y' };
      const prefix = prefixMap[node.type] || 's';
      const slug = node.id.split('/').pop() || target;
      navigate(`/${prefix}/${slug}`);
    } else {
      navigate(`/search?q=${encodeURIComponent(target)}`);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="text-apple-blue font-medium hover:underline underline-offset-2 bg-apple-blue/5 px-1 rounded transition-colors duration-200 cursor-pointer inline"
    >
      {children}
    </button>
  );
}
