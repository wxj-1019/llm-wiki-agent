import React, { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import { codeToHtml } from 'shiki';
import { WikiLink } from './WikiLink';
import { parseFrontmatter } from '@/lib/frontmatter';

interface Props {
  content: string;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CodeBlock({ className, children, ...props }: any) {
  const match = /language-(\w+)/.exec(className ?? '');
  const lang = match ? match[1] : '';
  const theme = useThemeName();
  const [html, setHtml] = useState('');

  useEffect(() => {
    if (!lang) return;
    const code = String(children).replace(/\n$/, '');
    codeToHtml(code, { lang, theme }).then(setHtml);
  }, [children, lang, theme]);

  if (!lang) {
    return (
      <code className="bg-[var(--bg-secondary)] text-apple-purple px-1.5 py-0.5 rounded-md font-mono text-sm" {...props}>
        {children}
      </code>
    );
  }

  if (!html) {
    return (
      <pre className="bg-[var(--bg-secondary)] rounded-xl p-4 my-4 overflow-x-auto text-sm font-mono">
        <code className={className} {...props}>{children}</code>
      </pre>
    );
  }

  return (
    <div className="my-4 rounded-xl overflow-x-auto text-sm">
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

function processWikiLinks(children: React.ReactNode): React.ReactNode {
  if (typeof children === 'string') {
    const parts = children.split(/(\[\[[^\]]+\]\])/g);
    if (parts.length === 1) return children;
    return parts.map((part, i) => {
      const match = part.match(/^\[\[([^\]]+)\]\]$/);
      if (match) {
        const rawTarget = match[1];
        // Handle piped links: [[Target|Display text]] �?target=Target, display=Display text
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
  return children;
}

export function MarkdownRenderer({ content }: Props) {
  const { body } = useMemo(() => parseFrontmatter(content), [content]);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, rehypeSlug, [rehypeAutolinkHeadings, { behavior: 'wrap' }]]}
      components={{
        h1: ({ children }) => <h1 className="text-3xl font-semibold tracking-tight mt-8 mb-4">{children}</h1>,
        h2: ({ children }) => <h2 className="text-2xl font-semibold tracking-tight mt-8 mb-3">{children}</h2>,
        h3: ({ children }) => <h3 className="text-xl font-semibold tracking-tight mt-6 mb-2">{children}</h3>,
        p: ({ children }) => <p className="text-base leading-relaxed my-4 text-[var(--text-primary)]">{processWikiLinks(children)}</p>,
        ul: ({ children }) => <ul className="list-disc pl-6 my-4 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-6 my-4 space-y-1">{children}</ol>,
        li: ({ children }) => <li className="text-[var(--text-primary)]">{processWikiLinks(children)}</li>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-[3px] border-apple-blue pl-5 my-6 py-3 bg-apple-blue/[0.04] rounded-r-xl">
            {processWikiLinks(children)}
          </blockquote>
        ),
        code: CodeBlock,
        table: ({ children }) => (
          <div className="overflow-x-auto my-6">
            <table className="w-full text-sm border-collapse">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="text-left font-semibold px-4 py-2 border-b border-[var(--border-strong)] bg-[var(--bg-secondary)]">{children}</th>
        ),
        td: ({ children }) => (
          <td className="px-4 py-2 border-b border-[var(--border-default)]">{children}</td>
        ),
        a: ({ href, children }) => (
          <a href={href} className="text-apple-blue hover:underline" target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
        strong: ({ children }) => <strong>{processWikiLinks(children)}</strong>,
        em: ({ children }) => <em>{processWikiLinks(children)}</em>,
        hr: () => <hr className="my-8 border-[var(--border-default)]" />,
      }}
    >
      {body}
    </ReactMarkdown>
  );
}

