import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { MarkdownRenderer } from '@/components/content/MarkdownRenderer';

interface JarvisReplyBubbleProps {
  content: string;
  speedMs?: number;  // default 12
  onComplete?: () => void;
}

export function JarvisReplyBubble({
  content,
  speedMs = 12,
  onComplete,
}: JarvisReplyBubbleProps) {
  const [displayed, setDisplayed] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const indexRef = useRef<number>(0);
  const contentRef = useRef<string>(content);

  useEffect(() => {
    // Reset state when content changes
    contentRef.current = content;
    setDisplayed('');
    setIsTyping(true);
    indexRef.current = 0;
    lastTimeRef.current = 0;

    if (!content) {
      setIsTyping(false);
      onComplete?.();
      return;
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setDisplayed(content);
      setIsTyping(false);
      onComplete?.();
      return;
    }

    const tick = (timestamp: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
      }

      const elapsed = timestamp - lastTimeRef.current;
      const charsToAdd = Math.max(1, Math.floor(elapsed / speedMs));
      const nextIndex = Math.min(contentRef.current.length, indexRef.current + charsToAdd);

      if (nextIndex > indexRef.current) {
        setDisplayed(contentRef.current.slice(0, nextIndex));
        indexRef.current = nextIndex;
        lastTimeRef.current = timestamp;
      }

      if (indexRef.current >= contentRef.current.length) {
        setIsTyping(false);
        onComplete?.();
        rafRef.current = null;
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [content, speedMs, onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="apple-card px-3 py-2 border-cyan-500/20 bg-cyan-500/5"
    >
      <div className="prose prose-sm max-w-none text-[var(--text-primary)]">
        {content ? (
          <>
            <MarkdownRenderer content={displayed} />
            {isTyping && (
              <span
                className="inline-block w-[2px] h-[1em] ml-0.5 align-text-bottom animate-pulse"
                style={{ backgroundColor: 'var(--apple-teal)' }}
              />
            )}
          </>
        ) : null}
      </div>
    </motion.div>
  );
}
