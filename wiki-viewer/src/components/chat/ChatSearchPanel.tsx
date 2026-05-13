import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Globe, BookOpen, Loader2, MessageCircle, ArrowRight } from 'lucide-react';
import { searchWeb, searchWiki, type WikiSearchResult, type WebSearchResult } from '@/services/chatService';

interface ChatSearchPanelProps {
  onQuote: (text: string) => void;
}

interface SearchHistory { wiki: string[]; web: string[]; }

const SEARCH_HISTORY_KEY = 'wiki-chat-search-history';
const SEARCH_HISTORY_LIMIT = 10;

function loadSearchHistory(): SearchHistory {
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { wiki: [], web: [] };
}

function saveSearchHistory(h: SearchHistory) {
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(h));
}

export function ChatSearchPanel({ onQuote }: ChatSearchPanelProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'wiki' | 'web'>('wiki');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<WikiSearchResult | WebSearchResult>>([]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<SearchHistory>(loadSearchHistory);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      if (mode === 'web') {
        const data = await searchWeb(q);
        setResults(data.results);
      } else {
        const data = await searchWiki(q);
        setResults(data.results);
      }
      // Add to history
      setHistory((prev) => {
        const list = prev[mode].filter((x) => x !== q);
        list.unshift(q);
        const updated = { ...prev, [mode]: list.slice(0, SEARCH_HISTORY_LIMIT) };
        saveSearchHistory(updated);
        return updated;
      });
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [mode]);

  // Debounced search
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(query), 400);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, mode, doSearch]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const wikiResults = mode === 'wiki' ? (results as WikiSearchResult[]) : [];
  const webResults = mode === 'web' ? (results as WebSearchResult[]) : [];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search bar */}
      <div className="p-2 border-b border-[var(--border-default)] space-y-2">
        <div className="flex items-center gap-1">
          {['wiki', 'web'].map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m as 'wiki' | 'web'); setResults([]); }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                mode === m ? 'bg-blue-500 text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
              }`}
            >
              {m === 'wiki' ? <BookOpen className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
              {m === 'wiki' ? 'Wiki' : 'Web'}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-tertiary)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={mode === 'wiki' ? t('chat.searchWikiPlaceholder', 'Search wiki...') : t('chat.searchWebPlaceholder', 'Search web...')}
            className="w-full pl-7 pr-2 py-1.5 text-xs rounded-md bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"
          />
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--text-tertiary)]" />
          </div>
        )}

        {!loading && query && wikiResults.length === 0 && webResults.length === 0 && (
          <p className="text-xs text-[var(--text-tertiary)] text-center py-6">
            {t('chat.searchNoResults', 'No results found')}
          </p>
        )}

        {!query && history[mode].length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider px-1 mb-2">
              {t('chat.searchHistory', 'Recent')}
            </div>
            {history[mode].map((q) => (
              <button
                key={q}
                onClick={() => setQuery(q)}
                className="w-full text-left px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded truncate"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Wiki results */}
        {wikiResults.map((r, i) => (
          <div key={i} className="p-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors group">
            <div className="text-xs font-medium text-[var(--text-primary)] truncate">{r.title || r.path}</div>
            <div className="text-[10px] text-[var(--text-tertiary)] line-clamp-2 mt-0.5">{r.excerpt}</div>
            <button
              onClick={() => onQuote(r.excerpt || '')}
              className="mt-1 text-[10px] text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
            >
              <ArrowRight className="w-2.5 h-2.5" /> {t('chat.right.quoteToChat', 'Quote')}
            </button>
          </div>
        ))}

        {/* Web results */}
        {webResults.map((r, i) => (
          <div key={i} className="p-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors group">
            <div className="text-xs font-medium text-[var(--text-primary)] truncate">{r.title}</div>
            <div className="text-[10px] text-[var(--text-tertiary)] line-clamp-2 mt-0.5">{r.body}</div>
            <button
              onClick={() => onQuote(r.body || '')}
              className="mt-1 text-[10px] text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
            >
              <ArrowRight className="w-2.5 h-2.5" /> {t('chat.right.quoteToChat', 'Quote')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
