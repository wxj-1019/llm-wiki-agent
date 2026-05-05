import { Link } from 'react-router-dom';
import { useWikiStore } from '@/stores/wikiStore';
import { resolveWikiLink } from '@/lib/wikilink';
import { useTranslation } from 'react-i18next';

interface WikiLinkProps {
  target: string;
  children: React.ReactNode;
}

export function WikiLink({ target, children }: WikiLinkProps) {
  const { t } = useTranslation();
  const graphData = useWikiStore((s) => s.graphData);
  const nodes = graphData?.nodes ?? [];

  const display = children;
  const { path, exists } = resolveWikiLink(target, nodes);

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
      className="text-red-500/70 font-medium border-b border-dashed border-apple-red/40 hover:text-red-500 hover:border-apple-red transition-colors duration-200 cursor-pointer inline"
      title={t('wikiLink.brokenTitle', { target })}
    >
      {display}
    </Link>
  );
}
