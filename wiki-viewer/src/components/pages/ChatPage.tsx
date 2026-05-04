import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Send, Square, MessageCircle, Trash2, Sparkles, Loader2, Copy, Check, RefreshCw,
  ChevronDown, Plus, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MarkdownRenderer } from '@/components/content/MarkdownRenderer';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { chatWithWikiStream, type WikiChatMessage, type WikiChatSource } from '@/services/chatService';
import { useNotificationStore } from '@/stores/notificationStore';
import { safeGet, safeSet, isObject, isArray } from '@/lib/safeStorage';
import { StreamDeduplicator, mergeStreamChunk } from '@/lib/streamUtils';

const SESSIONS_KEY = 'wiki-chat-sessions';

interface ChatEntry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: WikiChatSource[];
  timestamp?: number;
}

function formatTime(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

  const initial = loadSessions();
  const [sessions, setSessions] = useState<ChatSession[]>(initial.sessions);
  const [activeId, setActiveId] = useState<string>(initial.activeId);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isAtBottomRef = useRef(true);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const contextSentRef = useRef(false);

  const activeSession = sessions.find((s) => s.id === activeId) || sessions[0];
  const entries = activeSession?.messages || [];
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
      isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

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
      if (e.key === 'Escape') {
        if (abortRef.current) {
          e.preventDefault();
          abortRef.current.abort();
          abortRef.current = null;
        }
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
  }, []);

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

  const doSend = useCallback(async (query: string, contextPages?: string[]) => {
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
        // User stopped → leave partial content
      } else {
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
  }, [t, setEntries]);

  const handleSend = useCallback(() => {
    const query = input.trim();
    if (!query || loading) return;
    const userEntry: ChatEntry = { id: generateId(), role: 'user', content: query };
    setEntries((prev) => [...prev, userEntry]);
    setInput('');
    doSend(query);
  }, [input, loading, doSend, setEntries]);

  const handleRegenerate = useCallback(() => {
    const lastUserIndex = entries.findLastIndex((e) => e.role === 'user');
    if (lastUserIndex === -1) return;
    const query = entries[lastUserIndex].content;
    setEntries((prev) => prev.slice(0, lastUserIndex + 1));
    doSend(query);
  }, [entries, doSend, setEntries]);

  const handleStop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

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

  const handleClear = useCallback(() => {
    setEntries([]);
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleExample = (text: string) => {
    setInput(text);
    textareaRef.current?.focus();
  };

  const isEmpty = entries.length === 0;
  const lastAssistantIndex = entries.findLastIndex((e) => e.role === 'assistant');

  return (
    <div className="h-[calc(100vh-7rem)] -mx-6 -my-8 flex flex-col">
      {/* Header */}
      <div className="px-4 sm:px-6 py-4 border-b border-[var(--border-default)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <MessageCircle size={20} className="text-apple-blue" />
          <h1 className="text-lg font-semibold">{t('chat.title')}</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Session dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors border border-[var(--border-default)] rounded-xl max-w-[140px] sm:max-w-[200px]"
            >
              <span className="truncate">{activeSession?.title || defaultTitle}</span>
              <ChevronDown size={12} className={`shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute right-0 top-full mt-2 py-1 glass rounded-xl min-w-[220px] z-50"
              >
                <div className="max-h-60 overflow-y-auto">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => handleSwitchSession(s.id)}
                      className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer transition-colors ${
                        s.id === activeId
                          ? 'bg-apple-blue/10 text-apple-blue'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                      }`}
                    >
                      <span className="truncate flex-1 pr-2">{s.title || defaultTitle}</span>
                      {sessions.length > 1 && (
                        <button
                          onClick={(e) => handleDeleteSession(s.id, e)}
                          className="p-1 hover:bg-red-500/10 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={10} />
                        </button>
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
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={13} />
              <span className="hidden sm:inline">{t('chat.clear')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Message list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4"
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
              <div className="w-16 h-16 mx-auto mb-6 bg-apple-blue/10 rounded-2xl flex items-center justify-center">
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
            {entries.map((entry, i) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <ChatMessage
                  entry={entry}
                  index={i}
                  isLastAssistant={i === lastAssistantIndex}
                  streaming={streaming}
                  copiedIndex={copiedIndex}
                  onCopy={handleCopy}
                  onRegenerate={handleRegenerate}
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
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Input area */}
      <div className="px-4 sm:px-6 py-4 border-t border-[var(--border-default)] shrink-0 glass">
        <div className="flex items-end gap-2 max-w-3xl mx-auto">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('chat.inputPlaceholder')}
            rows={1}
            className="flex-1 apple-input resize-none max-h-32 text-sm py-2.5"
            disabled={loading}
          />
          <button
            onClick={streaming ? handleStop : handleSend}
            disabled={!streaming && !input.trim()}
            className={`shrink-0 p-2.5 transition-colors ${
              streaming
                ? 'rounded-full bg-transparent text-red-500 border border-red-200 hover:border-red-500'
                : 'apple-button disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            {streaming ? <Square size={16} fill="currentColor" /> : <Send size={16} />}
          </button>
        </div>
        <div className="max-w-3xl mx-auto mt-1.5 flex items-center justify-between">
          <p className="text-[10px] text-[var(--text-tertiary)]">
            {t('chat.shortcuts')}
          </p>
          {entries.length > 0 && (
            <button
              onClick={() => {
                const md = entries.map((e) => {
                  const header = e.role === 'user' ? '## User' : '## Assistant';
                  const time = e.timestamp ? ` (${formatTime(e.timestamp)})` : '';
                  return `${header}${time}\n\n${e.content}\n`;
                }).join('\n---\n\n');
                const blob = new Blob([`# ${activeSession?.title || t('chat.title')}\n\n${md}`], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${(activeSession?.title || 'chat').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
                a.click();
                URL.revokeObjectURL(url);
                addNotification(t('chat.exportSuccess', '导出成功'), 'success');
              }}
              className="text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            >
              {t('chat.export')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
