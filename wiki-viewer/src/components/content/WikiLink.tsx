import { Link } from 'react-router-dom';
import { useWikiStore } from '@/stores/wikiStore';
import { resolveWikiLink } from '@/lib/wikilink';

interface WikiLinkProps {
  target: string;
  children: React.ReactNode;
}

export function WikiLink({ target, children }: WikiLinkProps) {
  const nodes = useWikiStore((s) => s.graphData?.nodes ?? []);

  // Parse piped link: [[Target|Display]] → target=Target, display=Display
  const pipeIdx = target.indexOf('|');
  const actualTarget = pipeIdx >= 0 ? target.substring(0, pipeIdx) : target;
  const display = children;

  const path = resolveWikiLink(actualTarget, nodes);
  const exists = nodes.some(
    (n) => n.label.toLowerCase() === actualTarget.toLowerCase() || n.id.endsWith(`/${actualTarget}`)
  );

  if (exists) {
    return (
      <Link
        to={path}
        className="text-apple-blue font-medium hover:underline underline-offset-2 bg-apple-blue/5 px-1 rounded transition-colors duration-200"
      >
        {display}
      </Link>
    );
  }

  // Broken link: show in a distinct style, link to search
  return (
    <Link
      to={path}
      className="text-apple-red/70 font-medium border-b border-dashed border-apple-red/40 hover:text-apple-red hover:border-apple-red transition-colors duration-200 cursor-pointer inline"
      title={`Page "[${actualTarget}]" does not exist yet`}
    >
      {display}
    </Link>
  );
}
