import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { Square, MessageCircle, Trash2, Sparkles, X, Loader2, ArrowUp, Search, ChevronDown, PanelRight, Wand2, FileText, Zap, Plug, MoreHorizontal, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { ChatHistory } from '@/components/chat/ChatHistory';
import { ChatConversation } from '@/components/chat/ChatConversation';
import { ChatRightPanel } from '@/components/chat/ChatRightPanel';
import { MarkdownRenderer } from '@/components/content/MarkdownRenderer';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  chatWithWikiStream, chatWithLLMStream, searchWiki,
  generateFromKnowledge, type WikiChatMessage, type WikiChatSource,
  type WikiSearchResult, type GenerateResult,
} from '@/services/chatService';
import { useNotificationStore } from '@/stores/notificationStore';
import { safeGet, safeSet, isObject, isArray } from '@/lib/safeStorage';
import { StreamDeduplicator, mergeStreamChunk } from '@/lib/streamUtils';
import { extractWikiLinks } from '@/lib/wikilink';
import type { ChatSession as ChatHistorySession } from '@/components/chat/ChatHistory';

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
  createdAt?: number;
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { sessionId } = useParams<{ sessionId: string }>();
  const defaultTitle = t('chat.sessionDefault');

  // ── Layout state ──
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(true);
  const [rightTab, setRightTab] = useState<'doc' | 'search'>('doc');
  const [activeDocPath, setActiveDocPath] = useState<string | null>(null);

  // ── Session state ──
  const [sessions, setSessions] = useState<ChatSession[]>(() => loadSessions().sessions);
  const [activeId, setActiveId] = useState<string>(() => loadSessions().activeId);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [showFindPanel, setShowFindPanel] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [findIndex, setFindIndex] = useState(0);
  const findInputRef = useRef<HTMLInputElement>(null);
  const [llmConfig, setLlmConfig] = useState<{ model: string; provider: string } | null>(null);
  const [online, setOnline] = useState(true);
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

  // Generate panel
  const [showGeneratePanel, setShowGeneratePanel] = useState(false);
  const [generateTarget, setGenerateTarget] = useState<'skill' | 'mcp'>('skill');
  const [generateResult, setGenerateResult] = useState<GenerateResult | null>(null);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateStage, setGenerateStage] = useState<string | null>(null);
  const [editedCode, setEditedCode] = useState('');
  const [isEditingCode, setIsEditingCode] = useState(false);
  const [refineInput, setRefineInput] = useState('');
  const [refineLoading, setRefineLoading] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isAtBottomRef = useRef(true);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const contextSentRef = useRef(false);

  const activeSession = sessions.find((s) => s.id === activeId) || sessions[0];
  const entries = useMemo<ChatEntry[]>(() => activeSession?.messages || [], [activeSession]);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  useDocumentTitle(activeSession?.title || t('chat.title'));

  // Handle URL sessionId: switch to that session if it exists, otherwise create it
  useEffect(() => {
    if (!sessionId) return;
    const exists = sessions.find((s) => s.id === sessionId);
    if (exists) {
      setActiveId(sessionId);
    } else {
      // Create a new session with the given ID (from search result)
      const newSession: ChatSession = {
        id: sessionId,
        title: defaultTitle,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isDefaultTitle: true,
      };
      setSessions((prev) => [...prev, newSession]);
      setActiveId(sessionId);
    }
  }, [sessionId, defaultTitle]);

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

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // ESC: close right panel first, then abort stream
      if (e.key === 'Escape') {
        if (!rightCollapsed) {
          e.preventDefault();
          setRightCollapsed(true);
          return;
        }
        if (abortRef.current) {
          e.preventDefault();
          abortRef.current.abort();
          abortRef.current = null;
        }
      }
      // Ctrl/Cmd + K: open right search tab
      if (e.key === 'k' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setRightTab('search');
        setRightCollapsed(false);
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
  }, [rightCollapsed]);

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
        if (chunk.type === 'sources') {
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
        if (chunk.type === 'chunk') {
          const result = deduper.process(chunk.content);
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
        if (chunk.type === 'error') {
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
        if (chunk.type === 'done') break;
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
        if (chunk.type === 'sources') {
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
        if (chunk.type === 'chunk') {
          const result = deduper.process(chunk.content);
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
        if (chunk.type === 'error') {
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
        if (chunk.type === 'done') break;
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
  }, [defaultTitle]);

  const handleSwitchSession = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const handleDeleteSession = useCallback((id: string) => {
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

  const handleRenameSession = useCallback((id: string, title: string) => {
    const trimmed = title.trim();
    if (trimmed) {
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, title: trimmed, isDefaultTitle: false } : s))
      );
    }
  }, []);

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
        if (chunk.type === 'chunk') {
          const result = deduper.process(chunk.content);
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
        if (chunk.type === 'error') {
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
        if (chunk.type === 'done') break;
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

  const handleGenerate = useCallback(async (target: 'skill' | 'mcp', customQuery?: string) => {
    const genQuery = customQuery || (entries.length > 0 ? entries.map((e) => `${e.role}: ${e.content}`).join('\n\n') : input.trim());
    if (!genQuery) {
      addNotification(t('chat.generateNoQuery', 'Please enter a query or have a conversation first'), 'info');
      return;
    }
    setGenerateTarget(target);
    setGenerateResult(null);
    setGenerateLoading(true);
    setShowGeneratePanel(true);
    setIsEditingCode(false);
    setEditedCode('');
    setRefineInput('');
    setGenerateStage('searching');
    try {
      await new Promise((r) => setTimeout(r, 600));
      setGenerateStage('extracting');
      await new Promise((r) => setTimeout(r, 400));
      setGenerateStage('generating');
      const history = entries.map((e) => ({ role: e.role, content: e.content }));
      const data = await generateFromKnowledge(genQuery, target, history);
      setGenerateResult(data);
      setEditedCode(data.code);
      setGenerateStage(null);
    } catch (err) {
      addNotification((err as Error).message, 'error');
      setShowGeneratePanel(false);
      setGenerateStage(null);
    } finally {
      setGenerateLoading(false);
    }
  }, [entries, input, addNotification, t]);

  const handleRefineGenerate = useCallback(async () => {
    if (!refineInput.trim() || !generateResult || refineLoading) return;
    setRefineLoading(true);
    setGenerateStage('generating');
    try {
      const history = entries.map((e) => ({ role: e.role, content: e.content }));
      history.push({ role: 'assistant', content: `Previous generated code:\n\`\`\`\n${generateResult.code}\n\`\`\`` });
      const data = await generateFromKnowledge(refineInput, generateTarget, history);
      setGenerateResult(data);
      setEditedCode(data.code);
      setRefineInput('');
      setGenerateStage(null);
    } catch (err) {
      addNotification((err as Error).message, 'error');
      setGenerateStage(null);
    } finally {
      setRefineLoading(false);
    }
  }, [refineInput, generateResult, refineLoading, entries, generateTarget, addNotification]);

  const slashCommands = useMemo(() => [
    { id: 'clear', label: t('chat.cmd.clear', 'Clear conversation'), icon: 'trash', action: () => { handleClear(); setInput(''); } },
    { id: 'summarize', label: t('chat.cmd.summarize', 'Summarize conversation'), icon: 'file', action: () => { handleSummarize(); setInput(''); } },
    { id: 'skill', label: t('chat.cmd.skill', 'Generate Skill from wiki'), icon: 'zap', action: () => { handleGenerate('skill'); setInput(''); } },
    { id: 'mcp', label: t('chat.cmd.mcp', 'Generate MCP Server from wiki'), icon: 'plug', action: () => { handleGenerate('mcp'); setInput(''); } },
    { id: 'search', label: t('chat.cmd.search', 'Search wiki'), icon: 'search', action: () => { setRightTab('search'); setRightCollapsed(false); setInput(''); } },
    { id: 'web', label: t('chat.cmd.web', 'Web search'), icon: 'globe', action: () => { setRightTab('search'); setRightCollapsed(false); setInput(''); } },
  ], [t, handleClear, handleSummarize, handleGenerate, setRightTab, setRightCollapsed]);

  const filteredSlashCommands = useMemo(() => {
    if (!slashQuery) return slashCommands;
    return slashCommands.filter((c) => c.id.includes(slashQuery.toLowerCase()) || c.label.toLowerCase().includes(slashQuery.toLowerCase()));
  }, [slashQuery, slashCommands]);

  const handleQuoteResult = (text: string) => {
    setInput((prev) => (prev ? prev + '\n\n' : '') + text);
    textareaRef.current?.focus();
  };

  const handleInstallGenerated = async () => {
    if (!generateResult) return;
    const codeToInstall = isEditingCode ? editedCode : generateResult.code;
    try {
      const endpoint = generateTarget === 'mcp' ? '/api/mcp/install' : '/api/skills/install';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'generated',
          name: generateTarget === 'mcp' ? 'chat-generated-mcp' : 'chat-generated-skill',
          code: codeToInstall,
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

  const navigate = useNavigate();

  const handleSourceClick = useCallback((path: string) => {
    const slug = path.replace('.md', '');
    const parts = slug.split('/');
    const type = parts[0];
    const name = parts.slice(1).join('/');
    if (type === 'sources') navigate(`/s/${name}`);
    else if (type === 'entities') navigate(`/e/${name}`);
    else if (type === 'concepts') navigate(`/c/${name}`);
    else if (type === 'syntheses') navigate(`/y/${name}`);
  }, [navigate]);

  return (
    <div className="h-[calc(100vh-7rem)] -mx-6 -my-8 flex">
      {/* Left sidebar */}
      <ChatHistory
        sessions={sessions.map((s) => ({ ...s, message_count: s.messages.length }))}
        activeId={activeId}
        onSwitch={handleSwitchSession}
        onNew={handleNewSession}
        onDelete={handleDeleteSession}
        onRename={handleRenameSession}
        collapsed={leftCollapsed}
        onToggleCollapse={() => setLeftCollapsed((v) => !v)}
      />

      {/* Center */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 border-b border-[var(--border-default)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <MessageCircle size={18} className="text-apple-blue" />
            <h1 className="text-base font-semibold">{t('chat.title')}</h1>
            {llmConfig && (
              <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[10px] text-[var(--text-tertiary)] rounded-md" title={llmConfig.model}>
                {llmConfig.provider}/{llmConfig.model.split('/').pop()}
              </span>
            )}
            <span className={`hidden sm:inline-flex w-2 h-2 rounded-full ${online ? 'bg-apple-green' : 'bg-apple-red'} ${online ? '' : 'animate-pulse'}`} title={online ? t('chat.online', 'Online') : t('chat.offline', 'Offline')} />
          </div>
          <div className="flex items-center gap-2">
            {!isEmpty && (
              <button
                onClick={handleClear}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-apple-red hover:bg-apple-red/10 transition-colors rounded-lg"
                aria-label={t('chat.clear')}
              >
                <Trash2 size={13} />
                <span className="hidden sm:inline">{t('chat.clear')}</span>
              </button>
            )}
            <button
              onClick={() => setRightCollapsed((v) => !v)}
              className={`p-1.5 rounded-lg transition-colors ${rightCollapsed ? 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]' : 'text-apple-blue bg-apple-blue/10'}`}
              title={t('chat.right.toggle', 'Toggle side panel')}
            >
              <PanelRight size={16} />
            </button>
          </div>
        </div>

        {/* Find in conversation */}
        <AnimatePresence>
          {showFindPanel && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 sm:px-6 pt-2 overflow-hidden border-b border-[var(--border-default)]"
            >
              <div className="flex items-center gap-2 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl px-3 py-1.5 mb-2">
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

        {/* Messages */}
        <ChatConversation
          entries={entries}
          loading={loading}
          streaming={streaming}
          showScrollToBottom={showScrollToBottom}
          copiedIndex={copiedIndex}
          onCopy={handleCopy}
          onReply={handleReplyMessage}
          onToggleBookmark={handleToggleBookmark}
          onContinue={handleContinue}
          onSourceClick={handleSourceClick}
          onDelete={handleDeleteMessage}
          onEdit={handleEditMessage}
          onRegenerate={handleRegenerate}
          onScrollToBottom={() => {
            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
            setShowScrollToBottom(false);
          }}
          scrollRef={scrollRef}
          renderWindow={RENDER_WINDOW}
          findQuery={findQuery}
        />
      </div>

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

              {/* Progress stages */}
              {generateLoading && generateStage && (
                <div className="flex items-center gap-3 py-3 px-2">
                  {(['searching', 'extracting', 'generating'] as const).map((stage, i) => {
                    const stages = ['searching', 'extracting', 'generating'];
                    const currentIdx = stages.indexOf(generateStage);
                    const isActive = stage === generateStage;
                    const isDone = i < currentIdx;
                    return (
                      <div key={stage} className="flex items-center gap-2">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                          isActive ? 'bg-apple-purple text-white animate-pulse' : isDone ? 'bg-apple-green text-white' : 'bg-[var(--bg-primary)] text-[var(--text-tertiary)] border border-[var(--border-default)]'
                        }`}>
                          {isDone ? '✓' : i + 1}
                        </div>
                        <span className={`text-[11px] ${isActive ? 'text-apple-purple font-medium' : isDone ? 'text-apple-green' : 'text-[var(--text-tertiary)]'}`}>
                          {t(`chat.generate.stage.${stage}`, stage === 'searching' ? 'Searching wiki' : stage === 'extracting' ? 'Extracting knowledge' : 'Generating code')}
                        </span>
                        {i < 2 && <div className={`w-6 h-px ${isDone ? 'bg-apple-green' : 'bg-[var(--border-default)]'}`} />}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Loading fallback */}
              {generateLoading && !generateStage && (
                <div className="flex items-center gap-2 py-4">
                  <Loader2 size={16} className="animate-spin text-apple-purple" />
                  <span className="text-xs text-[var(--text-secondary)]">{t('chat.generate.loading', 'Generating...')}</span>
                </div>
              )}

              {generateResult && !generateLoading && (
                <div className="space-y-2">
                  {generateResult.explanation && (
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{generateResult.explanation}</p>
                  )}

                  {/* Code display / edit */}
                  <div className="relative">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">
                        {generateTarget === 'mcp' ? 'Python' : 'Markdown'}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setIsEditingCode(!isEditingCode)}
                          className={`text-[10px] px-2 py-0.5 rounded transition-colors ${isEditingCode ? 'bg-apple-blue/10 text-apple-blue' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
                        >
                          {isEditingCode ? t('chat.generate.preview', 'Preview') : t('chat.generate.edit', 'Edit')}
                        </button>
                        <button
                          onClick={() => navigator.clipboard.writeText(isEditingCode ? editedCode : generateResult.code)}
                          className="text-[10px] px-2 py-0.5 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                        >
                          {t('chat.copy', 'Copy')}
                        </button>
                      </div>
                    </div>

                    {isEditingCode ? (
                      <textarea
                        value={editedCode}
                        onChange={(e) => setEditedCode(e.target.value)}
                        className="w-full text-[11px] font-mono bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-3 max-h-64 overflow-y-auto resize-y focus:outline-none focus:border-apple-blue/40"
                        rows={Math.min(editedCode.split('\n').length + 2, 20)}
                        spellCheck={false}
                      />
                    ) : (
                      <div className="max-h-64 overflow-y-auto rounded-lg border border-[var(--border-default)]">
                        <MarkdownRenderer content={`\`\`\`${generateTarget === 'mcp' ? 'python' : 'markdown'}\n${generateResult.code}\n\`\`\``} />
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={handleInstallGenerated}
                      className="apple-button text-xs py-1.5 bg-apple-green/10 text-apple-green border-apple-green/20"
                    >
                      {t('chat.generate.install', 'Install {{target}}', { target: generateTarget.toUpperCase() })}
                    </button>
                    <button
                      onClick={() => handleGenerate(generateTarget)}
                      className="apple-button text-xs py-1.5"
                    >
                      {t('chat.generate.regenerate', 'Regenerate')}
                    </button>
                    <button
                      onClick={() => {
                        const codeToSave = isEditingCode ? editedCode : generateResult.code;
                        const ext = generateTarget === 'mcp' ? 'py' : 'md';
                        const blob = new Blob([codeToSave], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `generated.${ext}`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="apple-button text-xs py-1.5"
                    >
                      {t('chat.generate.download', 'Download')}
                    </button>
                  </div>

                  {/* Refinement input */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      value={refineInput}
                      onChange={(e) => setRefineInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleRefineGenerate()}
                      placeholder={t('chat.generate.refinePlaceholder', 'Refine: e.g. add error handling, change file paths...')}
                      className="flex-1 text-[11px] bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg px-3 py-1.5 focus:outline-none focus:border-apple-blue/40 placeholder:text-[var(--text-tertiary)]"
                      disabled={refineLoading}
                    />
                    <button
                      onClick={handleRefineGenerate}
                      disabled={!refineInput.trim() || refineLoading}
                      className="apple-button text-xs py-1.5 disabled:opacity-40"
                    >
                      {refineLoading ? <Loader2 size={12} className="animate-spin" /> : t('chat.generate.refine', 'Refine')}
                    </button>
                  </div>

                  {/* Sources */}
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
                  onClick={() => { setRightTab('search'); setRightCollapsed(false); setShowGeneratePanel(false); }}
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
                  disabled={loading}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:text-apple-purple hover:bg-apple-purple/10 transition-colors disabled:opacity-40"
                  title={t('chat.tools.skill', 'Generate Skill')}
                >
                  <Zap size={14} />
                </button>

                {/* MCP */}
                <button
                  onClick={() => handleGenerate('mcp')}
                  disabled={loading}
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

      {/* Right panel */}
      <AnimatePresence initial={false}>
        {!rightCollapsed && (
          <ChatRightPanel
            tab={rightTab}
            onTabChange={setRightTab}
            sources={entries.findLast((e) => e.role === 'assistant')?.sources || []}
            activeDocPath={activeDocPath}
            onSelectPath={setActiveDocPath}
            onQuoteToChat={(text) => setInput((prev) => (prev ? prev + '\n\n' : '') + text)}
            onClose={() => setRightCollapsed(true)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
