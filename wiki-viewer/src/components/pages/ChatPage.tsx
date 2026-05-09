import { Fragment, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Send, Square, MessageCircle, Trash2, Sparkles,
  ChevronDown, Plus, X, Search, FileText, Zap, Plug,
  Globe, BookOpen, Quote, Wand2, Loader2, Pencil,
  MoreHorizontal, Download, ArrowUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { ChatMessage } from '@/components/chat/ChatMessage';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  chatWithWikiStream, chatWithLLMStream, searchWeb, searchWiki,
  generateFromKnowledge, type WikiChatMessage, type WikiChatSource,
  type WebSearchResult, type WikiSearchResult, type GenerateResult,
} from '@/services/chatService';
import { useNotificationStore } from '@/stores/notificationStore';
import { safeGet, safeSet, isObject, isArray } from '@/lib/safeStorage';
import { StreamDeduplicator, mergeStreamChunk } from '@/lib/streamUtils';
import { extractWikiLinks } from '@/lib/wikilink';
import { useFocusTrap } from '@/hooks/useFocusTrap';

const SESSIONS_KEY = 'wiki-chat-sessions';
const SEARCH_HISTORY_KEY = 'wiki-chat-search-history';
const DRAFTS_KEY = 'wiki-chat-drafts';
const SEARCH_HISTORY_LIMIT = 10;

interface SearchHistory {
  wiki: string[];
  web: string[];
}

function loadSearchHistory(): SearchHistory {
  const data = safeGet(SEARCH_HISTORY_KEY, (v): v is SearchHistory => {
    if (!isObject(v)) return false;
    const obj = v as Record<string, unknown>;
    return isArray(obj.wiki) && isArray(obj.web);
  }, null);
  return data || { wiki: [], web: [] };
}

function saveSearchHistory(history: SearchHistory) {
  safeSet(SEARCH_HISTORY_KEY, history);
}

function addSearchQuery(history: SearchHistory, type: 'wiki' | 'web', query: string): SearchHistory {
  const list = history[type].filter((q) => q !== query);
  list.unshift(query);
  return { ...history, [type]: list.slice(0, SEARCH_HISTORY_LIMIT) };
}

interface ChatEntry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: WikiChatSource[];
  timestamp?: number;
  meta?: { type: 'summary'; style: string };
  truncated?: boolean;
  bookmarked?: boolean;
}

function formatTime(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getDateKey(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatDateDivider(ts?: number, t?: (key: string) => string): string {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (isToday) return t?.('date.today') || 'Today';
  if (isYesterday) return t?.('date.yesterday') || 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatEntry[];
  updatedAt: number;
  isDefaultTitle: boolean;
}

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function isValidSession(s: unknown): s is ChatSession {
  if (!isObject(s)) return false;
  const obj = s as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.title === 'string' &&
    isArray(obj.messages) &&
    typeof obj.updatedAt === 'number' &&
    typeof obj.isDefaultTitle === 'boolean'
  );
}

function isValidSessions(data: unknown): data is { sessions: ChatSession[]; activeId: string } {
  if (!isObject(data)) return false;
  const obj = data as Record<string, unknown>;
  return (
    isArray(obj.sessions) &&
    (obj.sessions as unknown[]).every(isValidSession) &&
    typeof obj.activeId === 'string'
  );
}

function loadSessions(): { sessions: ChatSession[]; activeId: string } {
  const data = safeGet(SESSIONS_KEY, isValidSessions, null);
  if (data && data.sessions.length > 0) {
    return data;
  }
  const s: ChatSession = { id: generateId(), title: '', messages: [], updatedAt: Date.now(), isDefaultTitle: true };
  return { sessions: [s], activeId: s.id };
}

function saveSessions(sessions: ChatSession[], activeId: string) {
  safeSet(SESSIONS_KEY, { sessions, activeId });
}

export function ChatPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultTitle = t('chat.sessionDefault');

  const [sessions, setSessions] = useState<ChatSession[]>(() => loadSessions().sessions);
  const [activeId, setActiveId] = useState<string>(() => loadSessions().activeId);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [showFindPanel, setShowFindPanel] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [findIndex, setFindIndex] = useState(0);
  const findInputRef = useRef<HTMLInputElement>(null);
  const [llmConfig, setLlmConfig] = useState<{ model: string; provider: string } | null>(null);
  const [exportFormat, setExportFormat] = useState<'markdown' | 'json' | 'text'>('markdown');
  const [online, setOnline] = useState(true);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'web' | 'wiki'>('wiki');
  const [searchResults, setSearchResults] = useState<WebSearchResult[] | WikiSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistory>(loadSearchHistory);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showGeneratePanel, setShowGeneratePanel] = useState(false);
  const [generateTarget, setGenerateTarget] = useState<'skill' | 'mcp'>('skill');
  const [generateResult, setGenerateResult] = useState<GenerateResult | null>(null);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [summarizeStyle, setSummarizeStyle] = useState<'brief' | 'detailed' | 'bullet' | 'action'>('brief');
  const [showSummarizeMenu, setShowSummarizeMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const summarizeMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const [showMention, setShowMention] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionResults, setMentionResults] = useState<WikiSearchResult[]>([]);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const mentionStartRef = useRef(-1);
  const mentionAbortRef = useRef<AbortController | null>(null);

  // Slash commands
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);
  const slashStartRef = useRef(-1);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isAtBottomRef = useRef(true);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const sessionTrapRef = useFocusTrap<HTMLDivElement>(dropdownOpen);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const contextSentRef = useRef(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionTitle, setEditingSessionTitle] = useState('');
  const [sessionSearchQuery, setSessionSearchQuery] = useState('');
  const sessionEditRef = useRef<HTMLInputElement>(null);

  const activeSession = sessions.find((s) => s.id === activeId) || sessions[0];
  const entries = useMemo<ChatEntry[]>(() => activeSession?.messages || [], [activeSession]);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  useDocumentTitle(activeSession?.title || t('chat.title'));

  // Custom setEntries that updates the active session
  const setEntries = useCallback((updater: React.SetStateAction<ChatEntry[]>) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== activeId) return s;
        const newMessages = typeof updater === 'function' ? (updater as (prev: ChatEntry[]) => ChatEntry[])(s.messages) : updater;
        const firstUser = newMessages.find((e) => e.role === 'user');
        const title = !s.isDefaultTitle
          ? s.title
          : firstUser
            ? firstUser.content.slice(0, 30) + (firstUser.content.length > 30 ? '...' : '')
            : defaultTitle;
        return { ...s, messages: newMessages, updatedAt: Date.now(), title, isDefaultTitle: s.isDefaultTitle && !firstUser };
      })
    );
  }, [activeId, defaultTitle]);

  // Track whether user is at bottom for smart scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const threshold = 60;
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
      isAtBottomRef.current = atBottom;
      if (atBottom) setShowScrollToBottom(false);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  // Show scroll-to-bottom hint when new messages arrive and user is not at bottom
  useEffect(() => {
    if (!isAtBottomRef.current && entries.length > 0) {
      setShowScrollToBottom(true);
    }
  }, [entries]);

  // Smart auto-scroll
  useEffect(() => {
    if (scrollRef.current && isAtBottomRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  // Persist sessions
  useEffect(() => {
    saveSessions(sessions, activeId);
  }, [sessions, activeId]);

  // Auto-resize textarea + focus on session switch
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 128) + 'px';
    if (!loading) {
      el.focus();
    }
  }, [input, activeId, loading]);

  // Auto-save draft per session
  useEffect(() => {
    if (!activeId) return;
    const timer = setTimeout(() => {
      const drafts = safeGet(DRAFTS_KEY, (v): v is Record<string, string> => isObject(v) && Object.values(v).every((x) => typeof x === 'string'), {});
      if (input.trim()) {
        drafts[activeId] = input;
      } else {
        delete drafts[activeId];
      }
      safeSet(DRAFTS_KEY, drafts);
    }, 500);
    return () => clearTimeout(timer);
  }, [input, activeId]);

  // Restore draft when switching sessions
  useEffect(() => {
    const drafts = safeGet(DRAFTS_KEY, (v): v is Record<string, string> => isObject(v) && Object.values(v).every((x) => typeof x === 'string'), {});
    setInput(drafts[activeId] || '');
  }, [activeId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // ESC: close search/generate panels first, then abort stream
      if (e.key === 'Escape') {
        if (showSearchPanel || showGeneratePanel) {
          e.preventDefault();
          setShowSearchPanel(false);
          setShowGeneratePanel(false);
          return;
        }
        if (abortRef.current) {
          e.preventDefault();
          abortRef.current.abort();
          abortRef.current = null;
        }
      }
      // Ctrl/Cmd + K: open search
      if (e.key === 'k' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setShowSearchPanel(true);
        setShowGeneratePanel(false);
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }
      // Ctrl/Cmd + F: find in conversation
      if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setShowFindPanel(true);
        setTimeout(() => findInputRef.current?.focus(), 50);
      }
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'TEXTAREA' && target.tagName !== 'INPUT') {
          e.preventDefault();
          textareaRef.current?.focus();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showSearchPanel, showGeneratePanel]);

  // Auto-send from URL context parameter
  useEffect(() => {
    const context = searchParams.get('context');
    if (!context || entries.length > 0 || loading || contextSentRef.current) return;
    contextSentRef.current = true;
    const query = t('chat.askAboutPage', { page: context.replace('.md', '').split('/').pop() || context });
    const userEntry: ChatEntry = { id: generateId(), role: 'user', content: query, timestamp: Date.now() };
    setEntries((prev) => [...prev, userEntry]);
    doSend(query, [context]);
    setSearchParams({}, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch LLM config
  useEffect(() => {
    let cancelled = false;
    fetch('/api/config/llm')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setLlmConfig({ model: data.model || '', provider: data.provider || '' });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Network status polling
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/status', { method: 'GET', signal: AbortSignal.timeout(5000) });
        setOnline(res.ok);
      } catch {
        setOnline(false);
      }
    };
    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, []);

  const doSend = useCallback(async (query: string, contextPages?: string[], retryCount = 0) => {
    const assistantEntry: ChatEntry = { id: generateId(), role: 'assistant', content: '' };
    setEntries((prev) => [...prev, assistantEntry]);
    setLoading(true);
    setStreaming(true);
    isAtBottomRef.current = true;

    abortRef.current = new AbortController();

    try {
      const currentEntries = entriesRef.current;
      const history: WikiChatMessage[] = currentEntries.slice(-10).map((e) => ({
        role: e.role,
        content: e.content,
      }));

      const stream = chatWithWikiStream(query, history, contextPages, abortRef.current.signal);
      let sources: WikiChatSource[] | undefined;
      const deduper = new StreamDeduplicator();

      for await (const chunk of stream) {
        if (chunk.sources) {
          sources = chunk.sources;
          setEntries((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.role === 'assistant') {
              last.sources = sources;
            }
            return next;
          });
        }
        if (chunk.chunk) {
          const result = deduper.process(chunk.chunk);
          if (!result) continue;

          setEntries((prev) => {
            const next = [...prev];
            const last = { ...next[next.length - 1] };
            if (last && last.role === 'assistant') {
              last.content = mergeStreamChunk(last.content, result);
              if (sources && !last.sources) {
                last.sources = sources;
              }
              last.truncated = false;
              next[next.length - 1] = last;
            }
            return next;
          });
        }
        if (chunk.error) {
          setEntries((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.role === 'assistant') {
              last.content = t('chat.error.title') + ': ' + chunk.error;
            }
            return next;
          });
          break;
        }
        if (chunk.done) break;
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // User stopped → mark as truncated for continue
        setEntries((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === 'assistant') {
            last.truncated = true;
          }
          return next;
        });
      } else {
        // Auto-retry with exponential backoff (max 2 retries)
        if (retryCount < 2) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
          addNotification(t('chat.retrying', 'Connection error, retrying...') + ` (${retryCount + 1}/2)`, 'info');
          await new Promise((resolve) => setTimeout(resolve, delay));
          // Remove the failed assistant entry and retry
          setEntries((prev) => prev.slice(0, -1));
          await doSend(query, contextPages, retryCount + 1);
          return;
        }
        setEntries((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === 'assistant') {
            last.content = t('chat.error.title') + ': ' + (err as Error).message;
            last.truncated = true;
          }
          return next;
        });
      }
    } finally {
      setLoading(false);
      setStreaming(false);
      abortRef.current = null;
    }
  }, [t, setEntries, addNotification]);

  const handleSend = useCallback(() => {
    const query = input.trim();
    if (!query || loading) return;
    const userEntry: ChatEntry = { id: generateId(), role: 'user', content: query };
    setEntries((prev) => [...prev, userEntry]);
    setInput('');
    // Clear draft
    const drafts = safeGet(DRAFTS_KEY, (v): v is Record<string, string> => isObject(v) && Object.values(v).every((x) => typeof x === 'string'), {});
    delete drafts[activeId];
    safeSet(DRAFTS_KEY, drafts);
    // Extract [[wikilink]] references as context pages for the API
    const contextPages = extractWikiLinks(query);
    doSend(query, contextPages.length > 0 ? contextPages : undefined);
  }, [input, loading, doSend, setEntries, activeId]);

  const handleRegenerate = useCallback(() => {
    const lastUserIndex = entries.findLastIndex((e) => e.role === 'user');
    if (lastUserIndex === -1) return;
    const query = entries[lastUserIndex].content;
    setEntries((prev) => prev.slice(0, lastUserIndex + 1));
    doSend(query);
  }, [entries, doSend, setEntries]);

  const handleStop = useCallback(() => {
    try {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    } catch {
      // Defensive: abort() can throw if already aborted or controller is invalid
      abortRef.current = null;
    }
  }, []);

  const handleContinue = useCallback(async (index: number) => {
    const entry = entriesRef.current[index];
    if (!entry || entry.role !== 'assistant') return;
    setLoading(true);
    setStreaming(true);
    isAtBottomRef.current = true;
    // Clear truncated flag
    setEntries((prev) => {
      const next = [...prev];
      const item = { ...next[index] };
      item.truncated = false;
      next[index] = item;
      return next;
    });

    abortRef.current = new AbortController();
    try {
      const currentEntries = entriesRef.current;
      const history: WikiChatMessage[] = currentEntries.slice(-10).map((e) => ({
        role: e.role,
        content: e.content,
      }));
      // Find the last user query before this assistant message
      let query = '';
      for (let i = index - 1; i >= 0; i--) {
        if (currentEntries[i].role === 'user') {
          query = currentEntries[i].content;
          break;
        }
      }
      if (!query) {
        setEntries((prev) => {
          const next = [...prev];
          next[index] = { ...next[index], content: next[index].content + '\n\n' + t('chat.error.title') + ': ' + t('chat.continueNoQuery', 'Cannot find the original query') };
          return next;
        });
        return;
      }

      const stream = chatWithWikiStream(query, history, undefined, abortRef.current.signal);
      let sources: WikiChatSource[] | undefined;
      const deduper = new StreamDeduplicator();

      for await (const chunk of stream) {
        if (chunk.sources) {
          sources = chunk.sources;
          setEntries((prev) => {
            const next = [...prev];
            const item = next[index];
            if (item && item.role === 'assistant') {
              item.sources = sources;
            }
            return next;
          });
        }
        if (chunk.chunk) {
          const result = deduper.process(chunk.chunk);
          if (!result) continue;
          setEntries((prev) => {
            const next = [...prev];
            const item = { ...next[index] };
            if (item && item.role === 'assistant') {
              item.content = mergeStreamChunk(item.content, result);
              if (sources && !item.sources) {
                item.sources = sources;
              }
              next[index] = item;
            }
            return next;
          });
        }
        if (chunk.error) {
          setEntries((prev) => {
            const next = [...prev];
            const item = next[index];
            if (item && item.role === 'assistant') {
              item.content += '\n\n' + t('chat.error.title') + ': ' + chunk.error;
            }
            return next;
          });
          break;
        }
        if (chunk.done) break;
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setEntries((prev) => {
          const next = [...prev];
          const item = next[index];
          if (item && item.role === 'assistant') {
            item.truncated = true;
          }
          return next;
        });
      } else {
        setEntries((prev) => {
          const next = [...prev];
          const item = next[index];
          if (item && item.role === 'assistant') {
            item.content += '\n\n' + t('chat.error.title') + ': ' + (err as Error).message;
            item.truncated = true;
          }
          return next;
        });
      }
    } finally {
      setLoading(false);
      setStreaming(false);
      abortRef.current = null;
    }
  }, [t, setEntries]);

  const handleNewSession = useCallback(() => {
    const s: ChatSession = { id: generateId(), title: defaultTitle, messages: [], updatedAt: Date.now(), isDefaultTitle: true };
    setSessions((prev) => [...prev, s]);
    setActiveId(s.id);
    setDropdownOpen(false);
  }, [defaultTitle]);

  const handleSwitchSession = useCallback((id: string) => {
    setActiveId(id);
    setDropdownOpen(false);
  }, []);

  const handleDeleteSession = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (next.length === 0) {
        const s: ChatSession = { id: generateId(), title: defaultTitle, messages: [], updatedAt: Date.now(), isDefaultTitle: true };
        setActiveId(s.id);
        return [s];
      }
      if (activeIdRef.current === id) {
        setActiveId(next[0].id);
      }
      return next;
    });
    addNotification(t('chat.sessionDeleted', '会话已删除'), 'success');
  }, [defaultTitle, addNotification, t]);

  const handleStartRename = useCallback((id: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(id);
    setEditingSessionTitle(currentTitle);
    setTimeout(() => sessionEditRef.current?.focus(), 50);
  }, []);

  const handleSaveRename = useCallback(() => {
    if (!editingSessionId) return;
    const trimmed = editingSessionTitle.trim();
    if (trimmed) {
      setSessions((prev) =>
        prev.map((s) => (s.id === editingSessionId ? { ...s, title: trimmed, isDefaultTitle: false } : s))
      );
    }
    setEditingSessionId(null);
    setEditingSessionTitle('');
  }, [editingSessionId, editingSessionTitle]);

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSaveRename();
    if (e.key === 'Escape') { setEditingSessionId(null); setEditingSessionTitle(''); }
  };

  const handleClear = useCallback(() => {
    setEntries([]);
  }, [setEntries]);

  const handleEditMessage = useCallback((index: number, newContent: string) => {
    // Update the message and regenerate from that point
    setEntries((prev) => {
      const next = prev.slice(0, index);
      next.push({ ...prev[index], content: newContent, timestamp: Date.now() });
      return next;
    });
    // Trigger regeneration: send the edited message as a new query
    const editedEntry = entriesRef.current[index];
    if (editedEntry && editedEntry.role === 'user') {
      // Small timeout to let state settle
      setTimeout(() => {
        doSend(newContent);
      }, 50);
    }
  }, [setEntries, doSend]);

  const handleDeleteMessage = useCallback((index: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  }, [setEntries]);

  const handleReplyMessage = useCallback((index: number) => {
    const entry = entriesRef.current[index];
    if (!entry) return;
    const quoted = entry.content.trim().split('\n').map((line) => `> ${line}`).join('\n');
    const prefix = `**${entry.role === 'user' ? 'User' : 'Assistant'}:**\n${quoted}\n\n`;
    setInput((prev) => (prev ? prev + '\n\n' : '') + prefix);
    textareaRef.current?.focus();
  }, []);

  const handleToggleBookmark = useCallback((index: number) => {
    setEntries((prev) => {
      const next = [...prev];
      const item = { ...next[index] };
      item.bookmarked = !item.bookmarked;
      next[index] = item;
      return next;
    });
  }, [setEntries]);

  const handleCopy = useCallback(async (content: string, index: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      addNotification(t('chat.copySuccess', '已复制'), 'success');
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopiedIndex((prev) => (prev === index ? null : prev)), 2000);
    } catch {
      addNotification(t('chat.copyFailed', '复制失败'), 'error');
    }
  }, [addNotification, t]);

  const handleSaveSummary = useCallback(async (content: string) => {
    try {
      const title = `Summary ${new Date().toLocaleDateString()}`;
      const res = await fetch('/api/wiki/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: `syntheses/${title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.md`,
          content: `---\ntitle: "${title}"\ntype: synthesis\ndate: ${new Date().toISOString().split('T')[0]}\n---\n\n${content}`,
        }),
      });
      if (res.ok) {
        addNotification(t('chat.saveSummarySuccess', 'Summary saved to wiki'), 'success');
      } else {
        const err = await res.text();
        addNotification(err || t('chat.saveSummaryFailed', 'Failed to save summary'), 'error');
      }
    } catch (err) {
      addNotification((err as Error).message, 'error');
    }
  }, [addNotification, t]);

  const handleQuoteSummary = useCallback((content: string) => {
    setInput((prev) => (prev ? prev + '\n\n' : '') + `> **Summary**\n> ${content.replace(/\n/g, '\n> ')}`);
    textareaRef.current?.focus();
  }, []);



  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMention && mentionResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((prev) => (prev + 1) % mentionResults.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((prev) => (prev - 1 + mentionResults.length) % mentionResults.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const result = mentionResults[mentionIndex];
        if (result) handleMentionSelect(result.path.replace('.md', ''));
        return;
      }
      if (e.key === 'Escape') {
        setShowMention(false);
        return;
      }
    }
    if (showSlashMenu && filteredSlashCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex((prev) => (prev + 1) % filteredSlashCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex((prev) => (prev - 1 + filteredSlashCommands.length) % filteredSlashCommands.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const cmd = filteredSlashCommands[slashIndex];
        if (cmd) {
          const el = textareaRef.current;
          if (el && slashStartRef.current >= 0) {
            const before = input.slice(0, slashStartRef.current);
            const after = input.slice(el.selectionStart);
            setInput(before + after);
          }
          cmd.action();
          setShowSlashMenu(false);
          slashStartRef.current = -1;
        }
        return;
      }
      if (e.key === 'Escape') {
        setShowSlashMenu(false);
        slashStartRef.current = -1;
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleMentionSelect = useCallback((pagePath: string) => {
    const el = textareaRef.current;
    if (!el || mentionStartRef.current < 0) return;
    const before = input.slice(0, mentionStartRef.current);
    const after = input.slice(el.selectionStart);
    const wikilink = `[[${pagePath}]]`;
    const newValue = before + wikilink + ' ' + after;
    setInput(newValue);
    setShowMention(false);
    setMentionQuery('');
    mentionStartRef.current = -1;
    setTimeout(() => {
      const pos = before.length + wikilink.length + 1;
      el.setSelectionRange(pos, pos);
      el.focus();
    }, 0);
  }, [input]);

  // Detect @mention trigger
  const handleTextareaKeyUp = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.target as HTMLTextAreaElement;
    const cursor = el.selectionStart;
    const text = el.value.slice(0, cursor);

    // Check for @mention
    const lastAt = text.lastIndexOf('@');
    if (lastAt >= 0) {
      const afterAt = text.slice(lastAt + 1);
      const hasSpaceAfter = afterAt.includes(' ');
      const prevChar = text[lastAt - 1];
      const atWordBoundary = !prevChar || /\s/.test(prevChar);
      if (!hasSpaceAfter && atWordBoundary && afterAt.length <= 30) {
        mentionStartRef.current = lastAt;
        setShowMention(true);
        setMentionQuery(afterAt);
        setMentionIndex(0);
        setShowSlashMenu(false);
        return;
      }
    }
    if (showMention) {
      setShowMention(false);
      mentionStartRef.current = -1;
    }

    // Check for /slash command (only at start of line or after whitespace)
    const lastSlash = text.lastIndexOf('/');
    if (lastSlash >= 0 && !showMention) {
      const afterSlash = text.slice(lastSlash + 1);
      const hasSpaceAfter = afterSlash.includes(' ');
      const prevChar = text[lastSlash - 1];
      const atWordBoundary = !prevChar || /\s/.test(prevChar);
      if (!hasSpaceAfter && atWordBoundary && afterSlash.length <= 20) {
        slashStartRef.current = lastSlash;
        setShowSlashMenu(true);
        setSlashQuery(afterSlash);
        setSlashIndex(0);
        return;
      }
    }
    if (showSlashMenu) {
      setShowSlashMenu(false);
      slashStartRef.current = -1;
    }
  }, [showMention, showSlashMenu]);

  // Debounced mention search
  useEffect(() => {
    if (!showMention) {
      setMentionResults([]);
      return;
    }
    if (mentionAbortRef.current) {
      mentionAbortRef.current.abort();
    }
    mentionAbortRef.current = new AbortController();
    const timer = setTimeout(async () => {
      setMentionLoading(true);
      try {
        const data = await searchWiki(mentionQuery || '*', 10);
        setMentionResults(data.results);
        setMentionIndex(0);
      } catch {
        setMentionResults([]);
      } finally {
        setMentionLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      mentionAbortRef.current?.abort();
    };
  }, [mentionQuery, showMention]);

  const handleExample = (text: string) => {
    setInput(text);
    textareaRef.current?.focus();
  };

  const doSearch = useCallback(async (query: string, type: 'wiki' | 'web') => {
    if (!query.trim()) return;
    setSearchLoading(true);
    try {
      if (type === 'web') {
        const data = await searchWeb(query.trim(), 10);
        setSearchResults(data.results);
      } else {
        const data = await searchWiki(query.trim(), 20);
        setSearchResults(data.results);
      }
      // Save to history
      setSearchHistory((prev) => {
        const next = addSearchQuery(prev, type, query.trim());
        saveSearchHistory(next);
        return next;
      });
    } catch (err) {
      addNotification((err as Error).message, 'error');
    } finally {
      setSearchLoading(false);
    }
  }, [addNotification]);

  const handleSearch = useCallback(() => {
    doSearch(searchQuery, searchType);
  }, [searchQuery, searchType, doSearch]);

  // Debounced auto-search
  useEffect(() => {
    if (!showSearchPanel || !searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      doSearch(searchQuery, searchType);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, searchType, showSearchPanel, doSearch]);

  const getSummarizePrompt = useCallback((style: 'brief' | 'detailed' | 'bullet' | 'action') => {
    const prompts: Record<typeof style, string> = {
      brief: t('chat.summarize.brief', 'Please summarize the following conversation in 2-3 sentences, highlighting the key points and conclusions.'),
      detailed: t('chat.summarize.detailed', 'Please provide a detailed summary of the following conversation, covering all important claims, decisions, and context. Use paragraphs.'),
      bullet: t('chat.summarize.bullet', 'Please summarize the following conversation as a bulleted list of key points. Each bullet should be concise and actionable.'),
      action: t('chat.summarize.action', 'Please extract all action items, decisions, and next steps from the following conversation. Format as a checklist.'),
    };
    return prompts[style];
  }, [t]);

  const handleSummarize = useCallback(async () => {
    if (entries.length === 0) {
      addNotification(t('chat.emptyForSummarize', 'No conversation to summarize'), 'error');
      return;
    }
    const assistantEntry: ChatEntry = { id: generateId(), role: 'assistant', content: '', meta: { type: 'summary', style: summarizeStyle } };
    setEntries((prev) => [...prev, assistantEntry]);
    setLoading(true);
    setStreaming(true);
    isAtBottomRef.current = true;

    abortRef.current = new AbortController();
    try {
      const history: WikiChatMessage[] = entries.slice(-20).map((e) => ({
        role: e.role,
        content: e.content,
      }));
      const systemPrompt = getSummarizePrompt(summarizeStyle);
      const stream = chatWithLLMStream(history, systemPrompt, abortRef.current.signal);
      const deduper = new StreamDeduplicator();

      for await (const chunk of stream) {
        if (chunk.chunk) {
          const result = deduper.process(chunk.chunk);
          if (!result) continue;
          setEntries((prev) => {
            const next = [...prev];
            const last = { ...next[next.length - 1] };
            if (last && last.role === 'assistant') {
              last.content = mergeStreamChunk(last.content, result);
              next[next.length - 1] = last;
            }
            return next;
          });
        }
        if (chunk.error) {
          setEntries((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.role === 'assistant') {
              last.content = t('chat.error.title') + ': ' + chunk.error;
            }
            return next;
          });
          break;
        }
        if (chunk.done) break;
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setEntries((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === 'assistant') {
            last.content = t('chat.error.title') + ': ' + (err as Error).message;
          }
          return next;
        });
      }
    } finally {
      setLoading(false);
      setStreaming(false);
      abortRef.current = null;
    }
  }, [entries, t, setEntries, addNotification, summarizeStyle, getSummarizePrompt]);

  const slashCommands = useMemo(() => [
    { id: 'clear', label: t('chat.cmd.clear', 'Clear conversation'), icon: 'trash', action: () => { handleClear(); setInput(''); } },
    { id: 'summarize', label: t('chat.cmd.summarize', 'Summarize conversation'), icon: 'file', action: () => { handleSummarize(); setInput(''); } },
    { id: 'search', label: t('chat.cmd.search', 'Search wiki'), icon: 'search', action: () => { setShowSearchPanel(true); setSearchType('wiki'); setInput(''); } },
    { id: 'web', label: t('chat.cmd.web', 'Web search'), icon: 'globe', action: () => { setShowSearchPanel(true); setSearchType('web'); setInput(''); } },
  ], [t, handleClear, handleSummarize]);

  const filteredSlashCommands = useMemo(() => {
    if (!slashQuery) return slashCommands;
    return slashCommands.filter((c) => c.id.includes(slashQuery.toLowerCase()) || c.label.toLowerCase().includes(slashQuery.toLowerCase()));
  }, [slashQuery, slashCommands]);

  const handleGenerate = useCallback(async (target: 'skill' | 'mcp') => {
    if (entries.length === 0) {
      addNotification(t('chat.emptyForGenerate', 'No conversation to generate from'), 'error');
      return;
    }
    setGenerateTarget(target);
    setGenerateLoading(true);
    setShowGeneratePanel(true);
    try {
      const query = entries.map((e) => `${e.role}: ${e.content}`).join('\n\n');
      const data = await generateFromKnowledge(query, target);
      setGenerateResult(data);
    } catch (err) {
      addNotification((err as Error).message, 'error');
      setShowGeneratePanel(false);
    } finally {
      setGenerateLoading(false);
    }
  }, [entries, addNotification, t]);

  const handleQuoteResult = (text: string) => {
    setInput((prev) => (prev ? prev + '\n\n' : '') + text);
    setShowSearchPanel(false);
    textareaRef.current?.focus();
  };

  const handleInstallGenerated = async () => {
    if (!generateResult) return;
    try {
      const endpoint = generateTarget === 'mcp' ? '/api/mcp/install' : '/api/skills/install';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'generated',
          name: generateTarget === 'mcp' ? 'chat-generated-mcp' : 'chat-generated-skill',
          code: generateResult.code,
        }),
      });
      if (res.ok) {
        addNotification(t('chat.installSuccess', 'Installed successfully'), 'success');
        setShowGeneratePanel(false);
      } else {
        const err = await res.text();
        addNotification(err || t('chat.installFailed', 'Installation failed'), 'error');
      }
    } catch (err) {
      addNotification((err as Error).message, 'error');
    }
  };

  const isEmpty = entries.length === 0;
  const lastAssistantIndex = entries.findLastIndex((e) => e.role === 'assistant');

  const RENDER_WINDOW = 100;
  const [visibleCount, setVisibleCount] = useState(RENDER_WINDOW);
  const visibleEntries = useMemo(() => entries.slice(-visibleCount), [entries, visibleCount]);
  const hasOlderEntries = entries.length > visibleCount;

  // Find in conversation
  const findMatches = useMemo(() => {
    if (!findQuery.trim()) return [];
    const q = findQuery.toLowerCase();
    return entries.map((e, i) => (e.content.toLowerCase().includes(q) ? i : -1)).filter((i) => i >= 0);
  }, [findQuery, entries]);

  useEffect(() => {
    if (findMatches.length > 0) {
      setFindIndex((prev) => Math.min(prev, findMatches.length - 1));
      // Scroll to first match
      const el = scrollRef.current;
      if (el) {
        const targetIndex = findMatches[Math.min(findIndex, findMatches.length - 1)];
        const messageEls = el.querySelectorAll('[data-message-index]');
        const targetEl = messageEls[targetIndex] as HTMLElement | undefined;
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }, [findMatches, findIndex]);

  return (
    <div className="h-[calc(100vh-7rem)] -mx-6 -my-8 flex flex-col">
      {/* Header */}
      <div className="px-4 sm:px-6 py-4 border-b border-[var(--border-default)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <MessageCircle size={20} className="text-apple-blue" />
          <h1 className="text-lg font-semibold">{t('chat.title')}</h1>
          {llmConfig && (
            <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[10px] text-[var(--text-tertiary)] rounded-md" title={llmConfig.model}>
              {llmConfig.provider}/{llmConfig.model.split('/').pop()}
            </span>
          )}
          <span className={`hidden sm:inline-flex w-2 h-2 rounded-full ${online ? 'bg-apple-green' : 'bg-apple-red'} ${online ? '' : 'animate-pulse'}`} title={online ? t('chat.online', 'Online') : t('chat.offline', 'Offline')} />
        </div>
        <div className="flex items-center gap-2">
          {/* Session dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors border border-[var(--border-default)] rounded-xl max-w-[140px] sm:max-w-[200px]"
              aria-expanded={dropdownOpen}
              aria-haspopup="listbox"
            >
              <span className="truncate">{activeSession?.title || defaultTitle}</span>
              <ChevronDown size={12} className={`shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {dropdownOpen && (
              <motion.div
                ref={sessionTrapRef}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute right-0 top-full mt-2 py-1 glass rounded-xl min-w-[240px] z-50"
              >
                {/* Session search */}
                <div className="px-2 pb-1">
                  <input
                    value={sessionSearchQuery}
                    onChange={(e) => setSessionSearchQuery(e.target.value)}
                    placeholder={t('chat.searchSessions', 'Search sessions...')}
                    className="w-full apple-input text-xs py-1.5"
                  />
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {sessions
                    .filter((s) => (s.title || defaultTitle).toLowerCase().includes(sessionSearchQuery.toLowerCase()))
                    .map((s) => (
                      <div
                        key={s.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleSwitchSession(s.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSwitchSession(s.id); }}
                        className={`group flex items-center justify-between px-3 py-2 text-xs cursor-pointer transition-colors ${
                          s.id === activeId
                            ? 'bg-apple-blue/10 text-apple-blue'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                        }`}
                      >
                        {editingSessionId === s.id ? (
                          <input
                            ref={sessionEditRef}
                            value={editingSessionTitle}
                            onChange={(e) => setEditingSessionTitle(e.target.value)}
                            onKeyDown={handleRenameKeyDown}
                            onBlur={handleSaveRename}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 text-xs bg-[var(--bg-primary)] border border-[var(--border-default)] rounded px-1.5 py-0.5 focus:outline-none focus:border-apple-blue/50"
                          />
                        ) : (
                          <span className="truncate flex-1 pr-2">{s.title || defaultTitle}</span>
                        )}
                        {editingSessionId !== s.id && sessions.length > 1 && (
                          <div className="flex items-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => handleStartRename(s.id, s.title || defaultTitle, e)}
                              className="p-1 hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)] transition-colors"
                              title={t('chat.renameSession', 'Rename')}
                            >
                              <Pencil size={10} />
                            </button>
                            <button
                              onClick={(e) => handleDeleteSession(s.id, e)}
                              className="p-1 hover:bg-apple-red/10 hover:text-apple-red transition-colors"
                              aria-label={t('chat.deleteSession', 'Delete session')}
                            >
                              <X size={10} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
                <div className="border-t border-[var(--border-default)] mt-1 pt-1 px-2 pb-1">
                  <button
                    onClick={handleNewSession}
                    className="flex items-center gap-1.5 w-full px-2 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
                  >
                    <Plus size={12} />
                    {t('chat.newSession')}
                  </button>
                </div>
              </motion.div>
            )}
          </div>

          {!isEmpty && (
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-apple-red hover:bg-apple-red/10 transition-colors"
              aria-label={t('chat.clear')}
            >
              <Trash2 size={13} aria-hidden="true" />
              <span className="hidden sm:inline">{t('chat.clear')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Message list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 sm:px-6 pt-4 pb-8 space-y-3 relative"
        role="log"
        aria-live="polite"
        aria-label={t('chat.title')}
      >
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-md"
            >
              <div className="w-16 h-16 mx-auto mb-6 bg-apple-blue/10 rounded-xl flex items-center justify-center">
                <Sparkles size={28} className="text-apple-blue" />
              </div>
              <h2 className="text-xl font-semibold mb-2">{t('chat.empty.title')}</h2>
              <p className="text-sm text-[var(--text-secondary)] mb-6">{t('chat.empty.description')}</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {['chat.empty.example1', 'chat.empty.example2', 'chat.empty.example3'].map((key) => (
                  <button
                    key={key}
                    onClick={() => handleExample(t(key))}
                    className="px-3 py-1.5 bg-[var(--bg-secondary)] text-xs text-[var(--text-secondary)] hover:text-apple-blue hover:border-apple-blue transition-colors border border-[var(--border-default)] rounded-full"
                  >
                    {t(key)}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {hasOlderEntries && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-center py-2"
              >
                <button
                  onClick={() => setVisibleCount((c) => Math.min(c + RENDER_WINDOW, entries.length))}
                  className="px-4 py-1.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] border border-[var(--border-default)] rounded-full hover:bg-[var(--bg-secondary)] transition-colors"
                >
                  {t('chat.loadOlder', 'Load older messages')}
                </button>
              </motion.div>
            )}
            {visibleEntries.map((entry) => {
              const i = entries.indexOf(entry);
              const prevEntry = entries[i - 1];
              const showDivider = !prevEntry || getDateKey(entry.timestamp) !== getDateKey(prevEntry.timestamp);
              return (
                <Fragment key={entry.id}>
                  {showDivider && entry.timestamp && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center justify-center my-4"
                    >
                      <div className="h-px bg-[var(--border-default)] flex-1" />
                      <span className="px-3 text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">
                        {formatDateDivider(entry.timestamp, t)}
                      </span>
                      <div className="h-px bg-[var(--border-default)] flex-1" />
                    </motion.div>
                  )}
                  <motion.div
                    data-message-index={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={findMatches.includes(i) && findQuery ? 'ring-1 ring-apple-blue/30 rounded-2xl' : ''}
                  >
                    <ChatMessage
                      entry={entry}
                      index={i}
                      isLastAssistant={i === lastAssistantIndex}
                      streaming={streaming}
                      copiedIndex={copiedIndex}
                      onCopy={handleCopy}
                      onRegenerate={handleRegenerate}
                      onEdit={entry.role === 'user' ? (content) => handleEditMessage(i, content) : undefined}
                      onDelete={() => handleDeleteMessage(i)}
                      onSaveSummary={entry.meta?.type === 'summary' ? () => handleSaveSummary(entry.content) : undefined}
                      onQuoteSummary={entry.meta?.type === 'summary' ? () => handleQuoteSummary(entry.content) : undefined}
                      onContinue={() => handleContinue(i)}
                      truncated={entry.truncated}
                      onReply={() => handleReplyMessage(i)}
                      bookmarked={entry.bookmarked}
                      onToggleBookmark={() => handleToggleBookmark(i)}
                      onSourceClick={(path) => {
                        const slug = path.replace('.md', '');
                        const parts = slug.split('/');
                        const type = parts[0];
                        const name = parts.slice(1).join('/');
                        if (type === 'sources') navigate(`/s/${name}`);
                        else if (type === 'entities') navigate(`/e/${name}`);
                        else if (type === 'concepts') navigate(`/c/${name}`);
                        else if (type === 'syntheses') navigate(`/y/${name}`);
                      }}
                    />
                  </motion.div>
                </Fragment>
              );
            })}
          </AnimatePresence>
        )}

        {/* Floating scroll-to-bottom */}
        <AnimatePresence>
          {showScrollToBottom && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              onClick={() => {
                scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
                setShowScrollToBottom(false);
              }}
              className="absolute bottom-4 right-6 w-9 h-9 flex items-center justify-center bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-secondary)] rounded-full shadow-lg hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors z-30"
              title={t('chat.scrollToBottom', 'Scroll to bottom')}
            >
              <ChevronDown size={16} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Search Panel */}
      <AnimatePresence>
        {showSearchPanel && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="px-4 sm:px-6 py-3 border-t border-[var(--border-default)] bg-[var(--bg-secondary)]"
          >
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex gap-1 p-0.5 bg-[var(--bg-primary)] rounded-lg">
                  <button
                    onClick={() => setSearchType('wiki')}
                    className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${searchType === 'wiki' ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}
                  >
                    <BookOpen size={11} />
                    {t('chat.search.wiki', 'Wiki')}
                  </button>
                  <button
                    onClick={() => setSearchType('web')}
                    className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${searchType === 'web' ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}
                  >
                    <Globe size={11} />
                    {t('chat.search.web', 'Web')}
                  </button>
                </div>
                <div className="flex-1 relative">
                  <input
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                    placeholder={t('chat.search.placeholder', 'Search...')}
                    className="w-full apple-input text-xs py-1.5 pr-8"
                  />
                  <button
                    onClick={handleSearch}
                    disabled={searchLoading || !searchQuery.trim()}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-[var(--text-tertiary)] hover:text-apple-blue transition-colors disabled:opacity-40"
                  >
                    {searchLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  </button>
                </div>
                <button
                  onClick={() => setShowSearchPanel(false)}
                  className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
              {/* Search History */}
              {searchQuery.trim().length < 2 && searchHistory[searchType].length > 0 && (
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">{t('chat.search.history', 'Recent')}</span>
                    <button
                      onClick={() => { setSearchHistory({ wiki: [], web: [] }); saveSearchHistory({ wiki: [], web: [] }); }}
                      className="text-[10px] text-[var(--text-tertiary)] hover:text-apple-red transition-colors"
                    >
                      {t('chat.search.clearHistory', 'Clear')}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {searchHistory[searchType].map((q) => (
                      <button
                        key={q}
                        onClick={() => { setSearchQuery(q); doSearch(q, searchType); }}
                        className="px-2 py-0.5 text-[11px] text-[var(--text-secondary)] bg-[var(--bg-primary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors rounded-md border border-[var(--border-default)]"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="max-h-48 overflow-y-auto space-y-1.5">
                  {searchResults.map((r, i) => {
                    const isWeb = searchType === 'web';
                    const title = isWeb ? (r as WebSearchResult).title : (r as WikiSearchResult).title;
                    const snippet = isWeb ? (r as WebSearchResult).body : (r as WikiSearchResult).excerpt;
                    const href = isWeb ? (r as WebSearchResult).href : (r as WikiSearchResult).path;
                    return (
                      <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-default)]">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-[var(--text-primary)] truncate">{title}</p>
                          <p className="text-[10px] text-[var(--text-tertiary)] truncate">{href}</p>
                          <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2 mt-0.5">{snippet}</p>
                        </div>
                        <button
                          onClick={() => handleQuoteResult(`${title}: ${snippet}`)}
                          className="shrink-0 p-1 text-[var(--text-tertiary)] hover:text-apple-blue transition-colors"
                          title={t('chat.search.quote', 'Quote')}
                        >
                          <Quote size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Empty state */}
              {!searchLoading && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                <div className="py-4 text-center">
                  <p className="text-xs text-[var(--text-tertiary)]">{t('chat.search.noResults', 'No results found')}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Generate Panel */}
      <AnimatePresence>
        {showGeneratePanel && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="px-4 sm:px-6 py-3 border-t border-[var(--border-default)] bg-[var(--bg-secondary)]"
          >
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Wand2 size={14} className="text-apple-purple" />
                  <span className="text-xs font-medium">
                    {generateLoading
                      ? t('chat.generate.loading', 'Generating...')
                      : t('chat.generate.title', 'Generated {{target}}', { target: generateTarget.toUpperCase() })}
                  </span>
                </div>
                <button
                  onClick={() => setShowGeneratePanel(false)}
                  className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
              {generateLoading && (
                <div className="flex items-center gap-2 py-4">
                  <Loader2 size={16} className="animate-spin text-apple-purple" />
                  <span className="text-xs text-[var(--text-secondary)]">{t('chat.generate.loading', 'Generating...')}</span>
                </div>
              )}
              {generateResult && !generateLoading && (
                <div className="space-y-2">
                  {generateResult.explanation && (
                    <p className="text-xs text-[var(--text-secondary)]">{generateResult.explanation}</p>
                  )}
                  <pre className="text-[11px] bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-3 max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {generateResult.code}
                  </pre>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigator.clipboard.writeText(generateResult.code)}
                      className="apple-button text-xs py-1.5"
                    >
                      {t('chat.copy', 'Copy')}
                    </button>
                    <button
                      onClick={handleInstallGenerated}
                      className="apple-button text-xs py-1.5 bg-apple-green/10 text-apple-green border-apple-green/20"
                    >
                      {t('chat.generate.install', 'Install {{target}}', { target: generateTarget.toUpperCase() })}
                    </button>
                  </div>
                  {generateResult.sources.length > 0 && (
                    <div className="pt-1">
                      <p className="text-[10px] text-[var(--text-tertiary)] mb-1">{t('chat.generate.sources', 'Sources')}:</p>
                      <div className="flex flex-wrap gap-1">
                        {generateResult.sources.map((s) => (
                          <span key={s.path} className="text-[10px] px-1.5 py-0.5 bg-[var(--bg-primary)] rounded text-[var(--text-secondary)]">
                            {s.path}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input area */}
      <div className="px-4 sm:px-6 py-3 border-t border-[var(--border-default)] shrink-0 bg-[var(--bg-primary)]">
        {/* Find in conversation */}
        <AnimatePresence>
          {showFindPanel && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="max-w-3xl mx-auto mb-2 overflow-hidden"
            >
              <div className="flex items-center gap-2 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl px-3 py-1.5">
                <Search size={12} className="text-[var(--text-tertiary)] shrink-0" />
                <input
                  ref={findInputRef}
                  value={findQuery}
                  onChange={(e) => { setFindQuery(e.target.value); setFindIndex(0); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setFindIndex((prev) => (prev + 1) % Math.max(findMatches.length, 1));
                    }
                    if (e.key === 'Escape') { setShowFindPanel(false); setFindQuery(''); }
                  }}
                  placeholder={t('chat.findPlaceholder', 'Find in conversation...')}
                  className="flex-1 bg-transparent text-xs focus:outline-none text-[var(--text-primary)]"
                />
                {findMatches.length > 0 && (
                  <span className="text-[10px] text-[var(--text-tertiary)] shrink-0 tabular-nums">
                    {findIndex + 1}/{findMatches.length}
                  </span>
                )}
                <button
                  onClick={() => { setFindIndex((prev) => (prev - 1 + findMatches.length) % findMatches.length); }}
                  disabled={findMatches.length === 0}
                  className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors"
                >
                  <ChevronDown size={12} className="rotate-180" />
                </button>
                <button
                  onClick={() => { setFindIndex((prev) => (prev + 1) % findMatches.length); }}
                  disabled={findMatches.length === 0}
                  className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors"
                >
                  <ChevronDown size={12} />
                </button>
                <button
                  onClick={() => { setShowFindPanel(false); setFindQuery(''); }}
                  className="p-1 text-[var(--text-tertiary)] hover:text-apple-red transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main input card */}
        <div className="max-w-3xl mx-auto relative">
          {/* Mention dropdown */}
          <AnimatePresence>
            {showMention && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="absolute left-0 right-0 bottom-full mb-1.5 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl shadow-lg z-30 overflow-hidden"
              >
                <div className="max-h-40 overflow-y-auto py-1">
                  {mentionLoading && (
                    <div className="px-3 py-2 text-xs text-[var(--text-tertiary)] flex items-center gap-2">
                      <Loader2 size={12} className="animate-spin" />
                      {t('chat.searching')}
                    </div>
                  )}
                  {!mentionLoading && mentionResults.length === 0 && (
                    <div className="px-3 py-2 text-xs text-[var(--text-tertiary)]">
                      {t('chat.mention.noResults', 'No pages found')}
                    </div>
                  )}
                  {mentionResults.map((r, i) => (
                    <button
                      key={r.path}
                      onClick={() => handleMentionSelect(r.path.replace('.md', ''))}
                      className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                        i === mentionIndex ? 'bg-apple-blue/10 text-apple-blue' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]'
                      }`}
                    >
                      <span className="font-medium">{r.title}</span>
                      <span className="text-[var(--text-tertiary)] ml-1.5">{r.path}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Slash menu */}
          <AnimatePresence>
            {showSlashMenu && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="absolute left-0 right-0 bottom-full mb-1.5 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl shadow-lg z-30 overflow-hidden"
              >
                <div className="max-h-40 overflow-y-auto py-1">
                  {filteredSlashCommands.length === 0 && (
                    <div className="px-3 py-2 text-xs text-[var(--text-tertiary)]">
                      {t('chat.cmd.noResults', 'No commands found')}
                    </div>
                  )}
                  {filteredSlashCommands.map((cmd, i) => (
                    <button
                      key={cmd.id}
                      onClick={() => {
                        const el = textareaRef.current;
                        if (el && slashStartRef.current >= 0) {
                          const before = input.slice(0, slashStartRef.current);
                          const after = input.slice(el.selectionStart);
                          setInput(before + after);
                        }
                        cmd.action();
                        setShowSlashMenu(false);
                        slashStartRef.current = -1;
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center gap-2 ${
                        i === slashIndex ? 'bg-apple-blue/10 text-apple-blue' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]'
                      }`}
                    >
                      <span className="text-[var(--text-tertiary)] font-mono">/{cmd.id}</span>
                      <span>{cmd.label}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input card */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-2xl focus-within:border-apple-blue/30 focus-within:shadow-sm transition-all">
            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onKeyUp={handleTextareaKeyUp}
              onPaste={(e) => {
                const files = Array.from(e.clipboardData.files);
                if (files.length > 0) {
                  e.preventDefault();
                  addNotification(t('chat.pasteFilesNotSupported', 'File upload is not supported yet'), 'info');
                }
              }}
              placeholder={t('chat.inputPlaceholder')}
              aria-label={t('chat.inputPlaceholder')}
              rows={1}
              className="w-full bg-transparent resize-none max-h-32 text-sm px-4 pt-3 pb-1 focus:outline-none text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
              disabled={loading}
            />

            {/* Toolbar row */}
            <div className="px-2 pb-2 flex items-center justify-between">
              {/* Left tools */}
              <div className="flex items-center gap-0.5">
                {/* Search */}
                <button
                  onClick={() => { setShowSearchPanel(true); setShowGeneratePanel(false); }}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors"
                  title={t('chat.tools.search', 'Search')}
                >
                  <Search size={14} />
                </button>

                {/* Summarize with style dropdown */}
                <div className="relative" ref={summarizeMenuRef}>
                  <button
                    onClick={() => {
                      if (entries.length === 0) return;
                      setShowSummarizeMenu((v) => !v);
                    }}
                    disabled={loading || entries.length === 0}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors disabled:opacity-40"
                    title={t('chat.tools.summarize', 'Summarize')}
                  >
                    <FileText size={14} />
                  </button>
                  <AnimatePresence>
                    {showSummarizeMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: 4, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.96 }}
                        transition={{ duration: 0.12 }}
                        className="absolute left-0 bottom-full mb-1.5 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl shadow-lg z-30 py-1 min-w-[120px]"
                      >
                        {([
                          { key: 'brief', label: t('chat.summarize.styleBrief', 'Brief') },
                          { key: 'detailed', label: t('chat.summarize.styleDetailed', 'Detailed') },
                          { key: 'bullet', label: t('chat.summarize.styleBullet', 'Bullet') },
                          { key: 'action', label: t('chat.summarize.styleAction', 'Action') },
                        ] as const).map((opt) => (
                          <button
                            key={opt.key}
                            onClick={() => {
                              setSummarizeStyle(opt.key);
                              setShowSummarizeMenu(false);
                              handleSummarize();
                            }}
                            className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                              summarizeStyle === opt.key
                                ? 'text-apple-blue bg-apple-blue/5'
                                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Skill */}
                <button
                  onClick={() => handleGenerate('skill')}
                  disabled={loading || entries.length === 0}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:text-apple-purple hover:bg-apple-purple/10 transition-colors disabled:opacity-40"
                  title={t('chat.tools.skill', 'Generate Skill')}
                >
                  <Zap size={14} />
                </button>

                {/* MCP */}
                <button
                  onClick={() => handleGenerate('mcp')}
                  disabled={loading || entries.length === 0}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:text-apple-green hover:bg-apple-green/10 transition-colors disabled:opacity-40"
                  title={t('chat.tools.mcp', 'Generate MCP')}
                >
                  <Plug size={14} />
                </button>

                <div className="w-px h-4 bg-[var(--border-default)] mx-1" />

                {/* More menu: Export */}
                <div className="relative" ref={moreMenuRef}>
                  <button
                    onClick={() => setShowMoreMenu((v) => !v)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors"
                    title={t('chat.more', 'More')}
                  >
                    <MoreHorizontal size={14} />
                  </button>
                  <AnimatePresence>
                    {showMoreMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: 4, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.96 }}
                        transition={{ duration: 0.12 }}
                        className="absolute left-0 bottom-full mb-1.5 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl shadow-lg z-30 py-1 min-w-[140px]"
                      >
                        <div className="px-3 py-1 text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">
                          {t('chat.export', 'Export')}
                        </div>
                        {([
                          { key: 'markdown' as const, label: 'Markdown' },
                          { key: 'json' as const, label: 'JSON' },
                          { key: 'text' as const, label: 'Plain Text' },
                        ]).map((fmt) => (
                          <button
                            key={fmt.key}
                            onClick={() => {
                              setExportFormat(fmt.key);
                              setShowMoreMenu(false);
                              if (entries.length === 0) return;
                              const slug = (activeSession?.title || 'chat').replace(/[^a-z0-9]/gi, '_').toLowerCase();
                              let blob: Blob;
                              let ext: string;
                              if (fmt.key === 'markdown') {
                                const md = entries.map((e) => {
                                  const header = e.role === 'user' ? '## User' : '## Assistant';
                                  const time = e.timestamp ? ` (${formatTime(e.timestamp)})` : '';
                                  return `${header}${time}\n\n${e.content}\n`;
                                }).join('\n---\n\n');
                                blob = new Blob([`# ${activeSession?.title || t('chat.title')}\n\n${md}`], { type: 'text/markdown' });
                                ext = 'md';
                              } else if (fmt.key === 'json') {
                                blob = new Blob([JSON.stringify({ title: activeSession?.title || t('chat.title'), messages: entries, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
                                ext = 'json';
                              } else {
                                const txt = entries.map((e) => {
                                  const header = e.role === 'user' ? 'User' : 'Assistant';
                                  const time = e.timestamp ? ` [${formatTime(e.timestamp)}]` : '';
                                  return `${header}${time}:\n${e.content}\n`;
                                }).join('\n---\n\n');
                                blob = new Blob([`${activeSession?.title || t('chat.title')}\n\n${txt}`], { type: 'text/plain' });
                                ext = 'txt';
                              }
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `${slug}.${ext}`;
                              a.click();
                              URL.revokeObjectURL(url);
                              addNotification(t('chat.exportSuccess', '导出成功'), 'success');
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] transition-colors flex items-center gap-2"
                          >
                            <Download size={12} />
                            {fmt.label}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Right: char count + send */}
              <div className="flex items-center gap-1.5">
                {input.length > 0 && (
                  <span className="text-[10px] text-[var(--text-tertiary)] tabular-nums">
                    {input.length}
                  </span>
                )}
                <button
                  onClick={streaming ? handleStop : handleSend}
                  disabled={(!streaming && !input.trim()) || !online}
                  className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all ${
                    streaming
                      ? 'bg-apple-red/10 text-apple-red hover:bg-apple-red/20'
                      : input.trim() && online
                      ? 'bg-apple-blue text-white hover:bg-apple-blue/90 shadow-sm'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'
                  } disabled:opacity-40`}
                  aria-label={streaming ? t('chat.stop') : t('chat.send')}
                  title={!online ? t('chat.offline') : undefined}
                >
                  {streaming ? <Square size={14} fill="currentColor" aria-hidden="true" /> : <ArrowUp size={16} aria-hidden="true" />}
                </button>
              </div>
            </div>
          </div>

          {/* Bottom hint */}
          <div className="mt-1.5 flex items-center justify-between">
            <p className="text-[10px] text-[var(--text-tertiary)]">
              {t('chat.shortcuts', 'Enter 发送 · Shift+Enter 换行 · @ 引用页面 · Ctrl+K 搜索')}
            </p>
            {llmConfig && (
              <span className="text-[10px] text-[var(--text-tertiary)]">
                {llmConfig.provider}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
