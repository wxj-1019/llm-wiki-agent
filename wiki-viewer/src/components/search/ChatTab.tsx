import { useRef, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Loader2, Send, X, Trash2, Copy, Check, Bot } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MarkdownRenderer } from '@/components/content/MarkdownRenderer';
import type { ChatEntry } from './types';

function formatTime(ts?: number): string {
  if (!ts) return '';
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

function TypingIndicator() {
  return (
    <div className="flex gap-1 items-center h-5 px-1">
      <span className="w-1.5 h-1.5 bg-[var(--text-tertiary)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-1.5 h-1.5 bg-[var(--text-tertiary)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-1.5 h-1.5 bg-[var(--text-tertiary)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  );
}

interface ChatTabProps {
  chatEntries: ChatEntry[];
  chatInput: string;
  chatStreaming: boolean;
  chatLoading: boolean;
  query: string;
  onInputChange: (val: string) => void;
  onSend: () => void;
  onStop: () => void;
  onClear: () => void;
}

export function ChatTab({
  chatEntries,
  chatInput,
  chatStreaming,
  chatLoading,
  query,
  onInputChange,
  onSend,
  onStop,
  onClear,
}: ChatTabProps) {
  const { t } = useTranslation();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [chatEntries]);

  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-[var(--text-tertiary)]">
          {t('search.chat.hint', 'Ask questions about your wiki knowledge base. The AI will search relevant pages and generate answers.')}
        </p>
        {chatEntries.length > 0 && (
          <button
            onClick={onClear}
            disabled={chatStreaming}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-50"
          >
            <Trash2 size={12} />
            {t('search.chat.clear', 'Clear')}
          </button>
        )}
      </div>

      <div ref={scrollContainerRef} className="space-y-5 mb-4 max-h-[70vh] overflow-y-auto pr-2">
        {chatEntries.length === 0 && (
          <div className="text-center py-16 text-[var(--text-tertiary)]">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-apple-blue/10 flex items-center justify-center">
              <Bot size={28} className="text-apple-blue" />
            </div>
            <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">{t('search.chat.emptyTitle', 'AI Chat')}</h3>
            <p className="text-sm max-w-md mx-auto">{t('search.chat.empty', 'Start a conversation about your wiki')}</p>
            <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
              {(query
                ? [query]
                : [
                    t('search.chat.example1', 'What are the key concepts?'),
                    t('search.chat.example2', 'Summarize the main topics'),
                  ]
              ).map((ex) => (
                <button
                  key={ex}
                  onClick={() => onInputChange(ex)}
                  className="px-4 py-2 text-xs bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-full text-[var(--text-secondary)] hover:text-apple-blue hover:border-apple-blue/30 transition-all min-h-[36px]"
                >
                  {ex.length > 36 ? ex.slice(0, 36) + '...' : ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {chatEntries.map((entry) => (
          <div key={entry.id} className={`flex gap-3 ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {entry.role === 'assistant' && (
              <div className="w-8 h-8 rounded-xl bg-apple-blue/10 flex items-center justify-center shrink-0 mt-1">
                <Bot size={16} className="text-apple-blue" />
              </div>
            )}
            <div className="max-w-[75%] min-w-0">
              <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                entry.role === 'user'
                  ? 'bg-apple-blue text-white rounded-br-md'
                  : entry.error
                    ? 'bg-red-500/10 text-red-600 dark:text-red-400 rounded-bl-md border border-red-500/20'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-bl-md border border-[var(--border-default)]'
              }`}>
                {entry.role === 'assistant' ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <MarkdownRenderer content={entry.content} />
                  </div>
                ) : (
                  <p>{entry.content}</p>
                )}
                {entry.sources && entry.sources.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-[var(--border-default)]/60 flex flex-wrap gap-1.5">
                    {entry.sources.map((s) => (
                      <Link
                        key={s.path}
                        to={`/${s.path.replace(/\.md$/, '')}`}
                        className="text-xs px-2 py-0.5 bg-apple-blue/10 text-apple-blue rounded-md hover:bg-apple-blue/20 transition-colors"
                      >
                        {s.path.split('/').pop()?.replace('.md', '')}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              <div className={`flex items-center gap-2 mt-1 ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <span className="text-[10px] text-[var(--text-tertiary)]">{formatTime(entry.timestamp)}</span>
                {entry.role === 'assistant' && entry.content && !entry.error && (
                  <CopyButton text={entry.content} />
                )}
              </div>
            </div>
            {entry.role === 'user' && (
              <div className="w-8 h-8 rounded-xl bg-apple-purple/10 flex items-center justify-center shrink-0 mt-1">
                <span className="text-xs font-bold text-apple-purple">You</span>
              </div>
            )}
          </div>
        ))}

        {chatLoading && chatStreaming && (
          <div className="flex gap-3 items-start">
            <div className="w-8 h-8 rounded-xl bg-apple-blue/10 flex items-center justify-center shrink-0">
              <Bot size={16} className="text-apple-blue" />
            </div>
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-2xl rounded-bl-md px-4 py-3">
              <TypingIndicator />
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="flex items-center gap-2">
        <div className={`flex-1 flex items-center gap-2 px-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl focus-within:border-apple-blue transition-colors ${chatStreaming ? 'opacity-60' : ''}`}>
          <input
            value={chatInput}
            onChange={e => onInputChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }
              if (e.key === 'Escape') onInputChange('');
            }}
            placeholder={t('search.chat.placeholder', 'Ask about your wiki...')}
            className="flex-1 bg-transparent outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
            disabled={chatStreaming}
          />
        </div>
        <button
          onClick={chatStreaming ? onStop : onSend}
          disabled={!chatStreaming && !chatInput.trim()}
          aria-label={chatStreaming ? t('search.chat.stop', 'Stop') : t('search.chat.send', 'Send message')}
          className={`p-2.5 rounded-xl transition-all disabled:opacity-40 active:scale-95 ${
            chatStreaming ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'bg-apple-blue text-white hover:bg-apple-blue/90'
          }`}
        >
          {chatStreaming ? <X size={16} /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] hover:text-apple-blue transition-colors"
      aria-label="Copy message"
    >
      {copied ? <Check size={10} /> : <Copy size={10} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
