import React from 'react';

interface HighlightTextProps {
  text: string;
  matches?: ReadonlyArray<[number, number]>;
}

export function HighlightText({ text, matches }: HighlightTextProps) {
  if (!matches || matches.length === 0) return <>{text}</>;
  const els: React.ReactNode[] = [];
  let last = 0;
  matches.forEach(([s, e], i) => {
    if (s > last) els.push(<span key={`t-${i}`}>{text.slice(last, s)}</span>);
    els.push(
      <mark key={`h-${i}`} className="bg-apple-blue/10 text-[var(--text-primary)] px-0.5 rounded">
        {text.slice(s, e + 1)}
      </mark>,
    );
    last = e + 1;
  });
  if (last < text.length) els.push(<span key="tail">{text.slice(last)}</span>);
  return <>{els}</>;
}
