import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Loader2, BrainCircuit, RefreshCw, MessageSquare, Sparkles, X, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { hybridSearch, getAllNodes } from '@/lib/search';
import type { FuseResult } from 'fuse.js';
import type { GraphNode } from '@/types/graph';
import type { UnifiedSearchResult } from '@/services/dataService';
import { searchUnified } from '@/services/dataService';
import { motion } from 'framer-motion';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useDebounce } from '@/hooks/useDebounce';
import { reindexEmbeddings, searchWeb } from '@/services/dataService';
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
  const [unifiedResults, setUnifiedResults] = useState<UnifiedSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [semantic, setSemantic] = useState(() => {
    try { return localStorage.getItem('wiki-semantic-search') === 'true'; } catch { return false; }
  });
  const [reindexing, setReindexing] = useState(false);

  const [webResults, setWebResults] = useState<{ title: string; href: string; body: string }[]>([]);
  const [webSearching, setWebSearching] = useState(false);

  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const tab = searchParams.get('tab');
    return tab === 'chat' || tab === 'generate' || tab === 'web' ? tab : 'search';
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
    if (tab === 'chat' || tab === 'generate' || tab === 'web') setActiveTab(tab);
    else if (tab === null) setActiveTab('search');
  }, [searchParams]);

  useEffect(() => {
    if (!debouncedQuery.trim()) { setResults([]); setUnifiedResults([]); return; }
    setSearching(true);
    let cancelled = false;

    // Try backend unified search first (includes chat results), fallback to local hybrid search
    searchUnified(debouncedQuery, 50, 5)
      .then(r => {
        if (!cancelled) {
          setUnifiedResults(r.results);
          // Also update fuse results for fallback compatibility
          const nodes = getAllNodes();
          const mapped: FuseResult<GraphNode>[] = r.results
            .filter(res => res.source_type === 'wiki')
            .map((res, idx) => {
              const node = nodes.find(n => n.id === res.id);
              return {
                item: node || { id: res.id, type: 'source', label: res.title, preview: res.preview } as GraphNode,
                matches: [],
                score: res.score || 0,
                refIndex: idx,
              } as unknown as FuseResult<GraphNode>;
            });
          setResults(mapped);
        }
      })
      .catch(() => {
        // Fallback to local hybrid search if backend is unavailable
        if (!cancelled) {
          hybridSearch(debouncedQuery, getAllNodes(), semantic)
            .then(r => { if (!cancelled) setResults(r.slice(0, 50)); })
            .catch(() => { if (!cancelled) setResults([]); });
        }
      })
      .finally(() => { if (!cancelled) setSearching(false); });

    return () => { cancelled = true; };
  }, [debouncedQuery, semantic]);

  useEffect(() => {
    if (activeTab !== 'web' || !debouncedQuery.trim()) { setWebResults([]); return; }
    setWebSearching(true);
    let cancelled = false;
    searchWeb(debouncedQuery, 10)
      .then(r => { if (!cancelled) setWebResults(r.results); })
      .catch(() => { if (!cancelled) setWebResults([]); })
      .finally(() => { if (!cancelled) setWebSearching(false); });
    return () => { cancelled = true; };
  }, [debouncedQuery, activeTab]);

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
      { id: 'web', icon: Globe, label: t('search.tab.web', 'Web') },
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
          unifiedResults={unifiedResults}
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

      {activeTab === 'web' && (
        <div>
          {webSearching && (
            <div className="space-y-3 mb-4" role="status" aria-busy="true">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="apple-card p-4 space-y-2">
                  <div className="w-3/4 h-4 rounded-lg bg-[var(--bg-secondary)] animate-pulse" />
                  <div className="w-full h-3 rounded-lg bg-[var(--bg-secondary)] animate-pulse" />
                  <div className="w-5/6 h-3 rounded-lg bg-[var(--bg-secondary)] animate-pulse" />
                </div>
              ))}
            </div>
          )}
          {!webSearching && debouncedQuery && (
            <div className="mb-4 text-sm text-[var(--text-secondary)]">
              {t('search.webResultCount', { count: webResults.length, query: debouncedQuery })}
            </div>
          )}
          <div className="space-y-3">
            {webResults.map((r, i) => (
              <motion.div
                key={r.href + i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i * 0.05, 0.4) }}
              >
                <a
                  href={r.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="apple-card p-4 block group hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Globe size={14} className="text-apple-blue shrink-0" />
                    <h3 className="font-medium text-[var(--text-primary)] text-sm group-hover:text-apple-blue transition-colors line-clamp-1">
                      {r.title}
                    </h3>
                  </div>
                  <p className="text-xs text-apple-blue mb-1 truncate">{r.href}</p>
                  <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{r.body}</p>
                </a>
              </motion.div>
            ))}
          </div>
          {!webSearching && debouncedQuery && webResults.length === 0 && (
            <div className="empty-state-warm">
              <Globe size={32} className="text-[var(--text-tertiary)]" />
              <p className="text-sm text-[var(--text-secondary)]">{t('search.noWebResults')}</p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
