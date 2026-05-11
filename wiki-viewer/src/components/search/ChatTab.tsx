import { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Loader2, Send, X, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MarkdownRenderer } from '@/components/content/MarkdownRenderer';
import type { ChatEntry } from './types';

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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatEntries]);

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-[var(--text-tertiary)]">
          {t('search.chat.hint', 'Ask questions about your wiki knowledge base. The AI will search relevant pages and generate answers.')}
        </p>
        {chatEntries.length > 0 && (
          <button
            onClick={onClear}
            disabled={chatStreaming}
            className="flex items-center gap-1 px-2 py-1 text-[10px] text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-50"
          >
            <Trash2 size={10} />
            {t('search.chat.clear', 'Clear')}
          </button>
        )}
      </div>

      <div className="space-y-4 mb-4 max-h-[60vh] overflow-y-auto pr-2">
        {chatEntries.length === 0 && (
          <div className="text-center py-12 text-[var(--text-tertiary)]">
            <MessageSquare size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">{t('search.chat.empty', 'Start a conversation about your wiki')}</p>
            <div className="flex items-center justify-center gap-2 mt-3">
              {(query
                ? [query]
                : [
                    t('search.chat.example1', 'What are the key concepts?'),
                    t('search.chat.example2', 'Summarize the main topics'),
                  ]
              ).map((ex, i) => (
                <button
                  key={i}
                  onClick={() => onInputChange(ex)}
                  className="px-3 py-1.5 text-xs bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-full text-[var(--text-secondary)] hover:text-apple-blue hover:border-apple-blue/30 transition-all"
                >
                  {ex.length > 30 ? ex.slice(0, 30) + '...' : ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {chatEntries.map((entry, i) => (
          <div key={i} className={`flex gap-3 ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                entry.role === 'user'
                  ? 'bg-apple-blue text-white rounded-br-md'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-bl-md border border-[var(--border-default)]'
              }`}
            >
              {entry.role === 'assistant' ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <MarkdownRenderer content={entry.content} />
                </div>
              ) : (
                <p>{entry.content}</p>
              )}
              {entry.sources && entry.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-[var(--border-default)] flex flex-wrap gap-1">
                  {entry.sources.map((s, j) => (
                    <Link
                      key={j}
                      to={`/${s.path.replace(/\.md$/, '')}`}
                      className="text-[10px] px-1.5 py-0.5 bg-apple-blue/10 text-apple-blue rounded hover:bg-apple-blue/20 transition-colors"
                    >
                      {s.path.split('/').pop()?.replace('.md', '')}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {chatLoading && chatEntries[chatEntries.length - 1]?.role === 'assistant' && !chatEntries[chatEntries.length - 1].content && (
          <div className="flex gap-2 items-center text-[var(--text-tertiary)] text-xs pl-2">
            <Loader2 size={12} className="animate-spin" />{t('chat.searching', 'Searching...')}
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 px-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl focus-within:border-apple-blue transition-colors">
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
          disabled={!chatStreaming && !chatInput.trim() && !query.trim()}
          className={`p-2.5 rounded-xl transition-all disabled:opacity-40 ${
            chatStreaming ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'bg-apple-blue text-white hover:bg-apple-blue/90'
          }`}
        >
          {chatStreaming ? <X size={16} /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
