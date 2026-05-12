import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Loader2, BrainCircuit, RefreshCw, MessageSquare, Sparkles, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { hybridSearch, getAllNodes } from '@/lib/search';
import type { FuseResult } from 'fuse.js';
import type { GraphNode } from '@/types/graph';
import { motion } from 'framer-motion';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useDebounce } from '@/hooks/useDebounce';
import { reindexEmbeddings } from '@/services/dataService';
import { useNotificationStore } from '@/stores/notificationStore';
import { chatWithWikiStream } from '@/services/chatService';
import { SearchResultsTab } from '@/components/search/SearchResultsTab';
import { ChatTab } from '@/components/search/ChatTab';
import { GenerateTab } from '@/components/search/GenerateTab';
import type { Tab, ChatEntry } from '@/components/search/types';

export function SearchPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const userEditedRef = useRef(false);
  const addNotification = useNotificationStore(s => s.addNotification);

  const debouncedQuery = useDebounce(query, 200);
  const [results, setResults] = useState<FuseResult<GraphNode>[]>([]);
  const [searching, setSearching] = useState(false);
  const [semantic, setSemantic] = useState(() => {
    try { return localStorage.getItem('wiki-semantic-search') === 'true'; } catch { return false; }
  });
  const [reindexing, setReindexing] = useState(false);

  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const tab = searchParams.get('tab');
    return tab === 'chat' || tab === 'generate' ? tab : 'search';
  });

  const [chatEntries, setChatEntries] = useState<ChatEntry[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatStreaming, setChatStreaming] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const chatStreamingRef = useRef(false);
  const resultsRef = useRef<FuseResult<GraphNode>[]>([]);
  const activeTabRef = useRef<Tab>(activeTab);
  const chatEntriesRef = useRef<ChatEntry[]>([]);

  useEffect(() => { chatStreamingRef.current = chatStreaming; }, [chatStreaming]);
  useEffect(() => { resultsRef.current = results; }, [results]);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { chatEntriesRef.current = chatEntries; }, [chatEntries]);

  useEffect(() => {
    if (!userEditedRef.current) setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'chat' || tab === 'generate') setActiveTab(tab);
    else if (tab === null) setActiveTab('search');
  }, [searchParams]);

  useEffect(() => {
    if (!debouncedQuery.trim()) { setResults([]); return; }
    setSearching(true);
    let cancelled = false;
    hybridSearch(debouncedQuery, getAllNodes(), semantic)
      .then(r => { if (!cancelled) setResults(r.slice(0, 50)); })
      .catch(() => { if (!cancelled) setResults([]); })
      .finally(() => { if (!cancelled) setSearching(false); });
    return () => { cancelled = true; };
  }, [debouncedQuery, semantic]);

  const handleTabChange = useCallback((tab: Tab) => {
    if (activeTabRef.current === 'chat' && tab !== 'chat' && chatStreamingRef.current) {
      abortRef.current?.abort();
    }
    setActiveTab(tab);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (tab === 'search') next.delete('tab');
      else next.set('tab', tab);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const handleToggleSemantic = useCallback(() => {
    setSemantic(prev => {
      const next = !prev;
      try { localStorage.setItem('wiki-semantic-search', String(next)); } catch { /* noop */ }
      return next;
    });
  }, []);

  const handleReindex = useCallback(async () => {
    setReindexing(true);
    try {
      const r = await reindexEmbeddings();
      addNotification(r.message || t('search.reindexSuccess'), 'success');
    } catch (e) {
      addNotification(String(e), 'error');
    } finally {
      setReindexing(false);
    }
  }, [addNotification, t]);

  const handleChatSend = useCallback(async () => {
    const msg = chatInput.trim() || query.trim();
    if (!msg || chatStreamingRef.current) return;

    const userId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    const userEntry: ChatEntry = { id: userId, role: 'user', content: msg, timestamp: Date.now() };

    setChatEntries(prev => [...prev, userEntry]);
    setChatInput('');
    setChatLoading(true);
    setChatStreaming(true);
    chatStreamingRef.current = true;

    const abort = new AbortController();
    abortRef.current = abort;

    let content = '';
    let sources: ChatEntry['sources'] = [];
    let error = false;

    try {
      const currentResults = resultsRef.current;
      const contextPages = currentResults.slice(0, 5).map(r => r.item.path);
      const history = [...chatEntriesRef.current, userEntry].map(e => ({ role: e.role, content: e.content }));

      setChatEntries(prev => [...prev, { id: assistantId, role: 'assistant', content: '', sources: [], timestamp: Date.now() }]);

      for await (const chunk of chatWithWikiStream(msg, history, contextPages, abort.signal)) {
        if (chunk.type === 'chunk') {
          content += chunk.content;
        } else if (chunk.type === 'sources') {
          sources = chunk.sources;
        } else if (chunk.type === 'error') {
          content = chunk.error;
          error = true;
          break;
        } else if (chunk.type === 'done') {
          break;
        }
        setChatEntries(prev => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (updated[lastIdx]?.id === assistantId) {
            updated[lastIdx] = { ...updated[lastIdx], content, sources };
          }
          return updated;
        });
      }

      setChatEntries(prev => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (updated[lastIdx]?.id === assistantId) {
          updated[lastIdx] = { ...updated[lastIdx], content, sources, error };
        }
        return updated;
      });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setChatEntries(prev => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (updated[lastIdx]?.id === assistantId) {
            updated[lastIdx] = {
              ...updated[lastIdx],
              content: t('chat.error.title', 'An error occurred. Please try again.'),
              error: true,
            };
          }
          return updated;
        });
      }
    } finally {
      setChatLoading(false);
      setChatStreaming(false);
      chatStreamingRef.current = false;
      abortRef.current = null;
    }
  }, [chatInput, query, t]);

  const handleChatStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleChatClear = useCallback(() => {
    if (chatStreamingRef.current) return;
    setChatEntries([]);
    setChatInput('');
  }, []);

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  useDocumentTitle(t('search.title'));

  const handleOnGenerate = useCallback(() => handleTabChange('generate'), [handleTabChange]);

  const tabs = useMemo<{ id: Tab; icon: React.ElementType; label: string }[]>(
    () => [
      { id: 'search', icon: Search, label: t('search.tab.results', 'Results') },
      { id: 'chat', icon: MessageSquare, label: t('search.tab.chat', 'AI Chat') },
      { id: 'generate', icon: Sparkles, label: t('search.tab.generate', 'Generate') },
    ],
    [t],
  );

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <h1 className="text-heading-1 mb-6">{t('search.title')}</h1>

      <div className="relative mb-4 max-w-2xl">
        <div className="flex items-center gap-3 w-full px-6 py-4 bg-[var(--bg-secondary)] border border-[var(--border-default)] hover:border-apple-blue focus-within:border-apple-blue focus-within:shadow-[0_0_0_4px_rgba(10,132,255,0.08)] transition-all duration-200 rounded-2xl">
          <Search size={20} className="text-[var(--text-tertiary)] shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={e => { setQuery(e.target.value); userEditedRef.current = true; }}
            onKeyDown={e => {
              if (e.key === 'Enter' && activeTab === 'chat') handleChatSend();
              if (e.key === 'Escape' && chatStreaming) handleChatStop();
            }}
            placeholder={t('search.placeholder')}
            className="flex-1 bg-transparent outline-none text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] text-lg"
          />
          {activeTab === 'chat' && chatStreaming && (
            <button onClick={handleChatStop} aria-label={t('search.stopGenerating', 'Stop generating')} className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors">
              <X size={16} />
            </button>
          )}
          {!chatStreaming && query && (
            <button onClick={() => { setQuery(''); userEditedRef.current = true; }} aria-label={t('search.clearSearch', 'Clear search')} className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-1 bg-[var(--bg-secondary)] rounded-xl p-1 border border-[var(--border-default)]">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all min-h-[36px] ${
                activeTab === tab.id
                  ? 'bg-apple-blue text-white shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)]'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleSemantic}
            onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleToggleSemantic(); } }}
            role="switch"
            aria-checked={semantic}
            tabIndex={0}
            className="p-2 -m-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue/50"
            aria-label={t('search.semantic')}
          >
            <div className={`relative w-11 h-6 rounded-full transition-colors ${semantic ? 'bg-apple-blue' : 'bg-[var(--border-default)]'}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-[var(--bg-primary)] rounded-full shadow transition-transform ${semantic ? 'translate-x-5' : ''}`} />
            </div>
          </button>
          <span className="text-xs text-[var(--text-tertiary)] flex items-center gap-1"><BrainCircuit size={13} />{t('search.semantic')}</span>
          <button onClick={handleReindex} disabled={reindexing} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] text-[var(--text-tertiary)] hover:text-apple-blue hover:bg-apple-blue/10 rounded-lg transition-all disabled:opacity-50">
            {reindexing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
            {t('search.reindex')}
          </button>
        </div>
      </div>

      {activeTab === 'search' && (
        <SearchResultsTab
          query={query}
          results={results}
          searching={searching}
          onGenerate={handleOnGenerate}
        />
      )}

      {activeTab === 'chat' && (
        <ChatTab
          chatEntries={chatEntries}
          chatInput={chatInput}
          chatStreaming={chatStreaming}
          chatLoading={chatLoading}
          query={query}
          onInputChange={setChatInput}
          onSend={handleChatSend}
          onStop={handleChatStop}
          onClear={handleChatClear}
        />
      )}

      {activeTab === 'generate' && (
        <GenerateTab
          query={query}
          chatEntries={chatEntries}
          onSwitchToGenerate={() => handleTabChange('generate')}
        />
      )}
    </motion.div>
  );
}
