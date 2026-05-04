import React, { useEffect, useMemo, useState, memo, useRef } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import { codeToHtml } from 'shiki';
import DOMPurify from 'dompurify';
import { WikiLink } from './WikiLink';
import { parseFrontmatter } from '@/lib/frontmatter';
import { useTranslation } from 'react-i18next';

interface Props {
  content: string;
  enableSourceCitations?: boolean;
  onSourceClick?: (path: string) => void;
}

function useThemeName() {
  const [theme, setTheme] = useState<'github-light' | 'github-dark'>(() => {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'github-dark' : 'github-light';
  });
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      setTheme(isDark ? 'github-dark' : 'github-light');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  return theme;
}

const CodeBlock = memo(function CodeBlock(props: { className?: string; children?: React.ReactNode; inline?: boolean }) {
  const { className, children, inline } = props;
  const { t } = useTranslation();
  const match = /language-(\w+)/.exec(className ?? '');
  const lang = match ? match[1] : '';
  const theme = useThemeName();
  const [html, setHtml] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!lang) return;
    const code = String(children).replace(/\n$/, '');
    codeToHtml(code, { lang, theme }).then(setHtml);
  }, [children, lang, theme]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  if (inline || !lang) {
    return (
      <code className="bg-[var(--bg-secondary)] text-apple-blue px-1.5 py-0.5 rounded font-mono text-sm">
        {children}
      </code>
    );
  }

  const CopyButton = (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5  text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors text-xs"
      title={t('common.copy')}
    >
      {copied ? t('common.copied') : t('common.copy')}
    </button>
  );

  if (!html) {
    return (
      <div className="relative my-4">
        {CopyButton}
        <pre className="bg-[var(--bg-secondary)] rounded-xl p-4 overflow-x-auto text-sm font-mono">
          <code className={className}>{children}</code>
        </pre>
      </div>
    );
  }

  return (
    <div className="relative my-4 rounded-xl overflow-x-auto text-sm">
      {CopyButton}
      <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />
    </div>
  );
});

function processWikiLinks(children: React.ReactNode): React.ReactNode {
  if (typeof children === 'string') {
    const parts = children.split(/(\[\[[^\]]+\]\])/g);
    if (parts.length === 1) return children;
    return parts.map((part, i) => {
      const match = part.match(/^\[\[([^\]]+)\]\]$/);
      if (match) {
        const rawTarget = match[1];
        const pipeIdx = rawTarget.indexOf('|');
        const target = pipeIdx >= 0 ? rawTarget.substring(0, pipeIdx) : rawTarget;
        const display = pipeIdx >= 0 ? rawTarget.substring(pipeIdx + 1) : rawTarget;
        return (
          <WikiLink key={i} target={target}>
            {display}
          </WikiLink>
        );
      }
      return part;
    });
  }
  if (Array.isArray(children)) {
    return children.map((child, i) => (
      <React.Fragment key={i}>{processWikiLinks(child)}</React.Fragment>
    ));
  }
  if (React.isValidElement(children) && children.props.children) {
    return React.cloneElement(children, {
      children: processWikiLinks(children.props.children as React.ReactNode),
    });
  }
  return children;
}

const H1 = memo(function H1({ children }: { children?: React.ReactNode }) {
  return <h1 className="text-3xl font-semibold tracking-tight mt-8 mb-4">{children}</h1>;
});

const H2 = memo(function H2({ children }: { children?: React.ReactNode }) {
  return <h2 className="text-2xl font-semibold tracking-tight mt-8 mb-3">{children}</h2>;
});

const H3 = memo(function H3({ children }: { children?: React.ReactNode }) {
  return <h3 className="text-xl font-semibold tracking-tight mt-6 mb-2">{children}</h3>;
});

const P = memo(function P({ children }: { children?: React.ReactNode }) {
  return <p className="text-base leading-relaxed my-4 text-[var(--text-primary)]">{processWikiLinks(children)}</p>;
});

const UL = memo(function UL({ children }: { children?: React.ReactNode }) {
  return <ul className="list-disc pl-6 my-4 space-y-1">{children}</ul>;
});

const OL = memo(function OL({ children }: { children?: React.ReactNode }) {
  return <ol className="list-decimal pl-6 my-4 space-y-1">{children}</ol>;
});

const LI = memo(function LI({ children }: { children?: React.ReactNode }) {
  return <li className="text-[var(--text-primary)]">{processWikiLinks(children)}</li>;
});

const Blockquote = memo(function Blockquote({ children }: { children?: React.ReactNode }) {
  return (
    <blockquote className="border-l-[3px] border-apple-blue pl-5 my-6 py-3 bg-apple-blue/5 rounded-xl">
      {processWikiLinks(children)}
    </blockquote>
  );
});

const Table = memo(function Table({ children }: { children?: React.ReactNode }) {
  return (
    <div className="overflow-x-auto my-6 rounded-xl border border-[var(--border-default)]">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  );
});

const TH = memo(function TH({ children }: { children?: React.ReactNode }) {
  return <th className="text-left font-semibold px-4 py-2 border-b border-[var(--border-strong)] bg-[var(--bg-secondary)]">{children}</th>;
});

const TD = memo(function TD({ children }: { children?: React.ReactNode }) {
  return <td className="px-4 py-2 border-b border-[var(--border-default)]">{children}</td>;
});

const Strong = memo(function Strong({ children }: { children?: React.ReactNode }) {
  return <strong>{processWikiLinks(children)}</strong>;
});

const Em = memo(function Em({ children }: { children?: React.ReactNode }) {
  return <em>{processWikiLinks(children)}</em>;
});

const HR = memo(function HR() {
  return <hr className="my-8 border-[var(--border-default)]" />;
});

const A = memo(function A({ href, children, onSourceClick }: { href?: string; children?: React.ReactNode; onSourceClick?: (path: string) => void }) {
  if (typeof href === 'string' && href.startsWith('wiki://')) {
    const path = href.slice(7);
    return (
      <button
        onClick={() => onSourceClick?.(path)}
        className="inline-flex items-center gap-0.5 text-xs text-apple-blue hover:underline bg-apple-blue/5 px-1.5 py-0.5 rounded align-middle"
      >
        {children}
      </button>
    );
  }
  return (
    <a href={href} className="text-apple-blue hover:underline" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
});

export function MarkdownRenderer({ content, enableSourceCitations, onSourceClick }: Props) {
  const body = useMemo(() => {
    const { body: rawBody } = parseFrontmatter(content);
    if (enableSourceCitations) {
      return rawBody.replace(/\[source:\s*([^\]]+)\]/g, (_, path) => `[📄 ${path}](wiki://${path})`);
    }
    return rawBody;
  }, [content, enableSourceCitations]);

  const onSourceClickRef = useRef(onSourceClick);
  onSourceClickRef.current = onSourceClick;

  const aComponent = useMemo(() => {
    return memo(function AWrapper({ href, children }: { href?: string; children?: React.ReactNode }) {
      return <A href={href} onSourceClick={onSourceClickRef.current}>{children}</A>;
    });
  }, []);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSlug, [rehypeAutolinkHeadings, { behavior: 'wrap' }]]}
      components={{
        h1: H1,
        h2: H2,
        h3: H3,
        p: P,
        ul: UL,
        ol: OL,
        li: LI,
        blockquote: Blockquote,
        code: CodeBlock,
        table: Table,
        th: TH,
        td: TD,
        a: aComponent as Components['a'],
        strong: Strong,
        em: Em,
        hr: HR,
      } as Components}
    >
      {body}
    </ReactMarkdown>
  );
}
