import { create } from 'zustand';
import { fetchGraphData, fetchIndexEtag } from '@/services/dataService';
import { fetchWithRetry } from '@/lib/fetchWithTimeout';
import { initSearch } from '@/lib/search';
import type { GraphData, GraphNode } from '@/types/graph';

interface PageCacheEntry {
  content: string;
  fetchedAt: number;
}

interface WikiState {
  graphData: GraphData | null;
  theme: 'light' | 'dark' | 'system';
  sidebarCollapsed: boolean;
  loading: boolean;
  error: string | null;
  recentPages: string[];
  readingProgress: Record<string, number>;
  favorites: string[];
  commandPaletteOpen: boolean;
  apiConnected: boolean;
  pageCache: Map<string, PageCacheEntry>;
  isOffline: boolean;
  heartbeatFailures: number;
  initialize: () => Promise<void>;
  refreshGraphData: () => Promise<void>;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  toggleSidebar: () => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  getNodeById: (id: string) => GraphNode | undefined;
  getNodeByLabel: (label: string) => GraphNode | undefined;
  getBacklinks: (nodeId: string) => GraphNode[];
  addRecentPage: (pageId: string) => void;
  toggleFavorite: (pageId: string) => void;
  isFavorite: (pageId: string) => boolean;
  setReadingProgress: (pageId: string, progress: number) => void;
  stopPolling: () => void;
  checkApiHealth: () => Promise<boolean>;
  getCachedPage: (slug: string) => string | null;
  setCachedPage: (slug: string, content: string) => void;
  preloadLinkedPages: (content: string) => void;
  startHeartbeat: () => void;
}

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

let _systemThemeListener: ((e: MediaQueryListEvent) => void) | null = null;

function applyTheme(theme: 'light' | 'dark' | 'system') {
  const effective = theme === 'system' ? getSystemTheme() : theme;
  document.documentElement.setAttribute('data-theme', effective);

  // Listen for system theme changes when in "system" mode
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  if (theme === 'system') {
    if (!_systemThemeListener) {
      _systemThemeListener = (e: MediaQueryListEvent) => {
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      };
      mql.addEventListener('change', _systemThemeListener);
    }
  } else {
    if (_systemThemeListener) {
      mql.removeEventListener('change', _systemThemeListener);
      _systemThemeListener = null;
    }
  }
}

import { safeGet, safeSet, isObject } from '@/lib/safeStorage';

const persisted = safeGet('wiki-viewer-storage', isObject, {});

const GRAPH_CACHE_KEY = 'wiki-graph-cache';
const GRAPH_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function loadGraphCache(): GraphData | null {
  const parsed = safeGet(GRAPH_CACHE_KEY, isObject, null);
  if (!parsed) return null;
  if (Date.now() - (parsed._cachedAt as number || 0) > GRAPH_CACHE_TTL_MS) return null;
  const data = parsed.data as Record<string, unknown>;
  if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) return null;
  return data as unknown as GraphData;
}

function saveGraphCache(data: GraphData) {
  safeSet(GRAPH_CACHE_KEY, { data, _cachedAt: Date.now() });
}

// ── Debounced persistence ──
// Scroll-triggered state (readingProgress) fires ~100 times per article read.
// We debounce localStorage writes to 1 second to avoid blocking the main thread.
function writePersist(state: WikiState) {
  const data = {
    theme: state.theme,
    sidebarCollapsed: state.sidebarCollapsed,
    recentPages: state.recentPages,
    readingProgress: state.readingProgress,
    favorites: state.favorites,
  };
  safeSet('wiki-viewer-storage', data);
}

function persistState(state: WikiState) {
  if (_persistTimer) clearTimeout(_persistTimer);
  _persistTimer = setTimeout(() => writePersist(state), 500);
}

const PAGE_CACHE_MAX = 100;
const PAGE_CACHE_TTL = 5 * 60 * 1000;

const MAX_READING_PROGRESS = 100;
const _readingTimestamps: Record<string, number> = {};

let _initPromise: Promise<void> | null = null;
let _pollTimer: ReturnType<typeof setTimeout> | null = null;
let _persistTimer: ReturnType<typeof setTimeout> | null = null;
let _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let _lastEtag = '0';
let _pollFetching = false;
let _consecutiveFailures = 0;
let _currentPollInterval = 30000; // ms, starts at 30s
const BASE_POLL_INTERVAL = 30000;
const MAX_POLL_INTERVAL = 300000; // 5 min cap
const MAX_FAILURES_BEFORE_STOP = 10;

export function stopPolling() {
  if (_pollTimer) {
    clearTimeout(_pollTimer);
    _pollTimer = null;
  }
}

function _schedulePoll() {
  if (_pollTimer) clearTimeout(_pollTimer);
  _pollTimer = setTimeout(async () => {
    if (document.hidden || _pollFetching) {
      _schedulePoll();
      return;
    }
    _pollFetching = true;
    try {
      const newEtag = await fetchIndexEtag();
      _consecutiveFailures = 0;
      _currentPollInterval = BASE_POLL_INTERVAL;
      useWikiStore.setState({ apiConnected: true, error: null });
      if (newEtag !== _lastEtag && _lastEtag !== '0') {
        const data = await fetchGraphData();
        initSearch(data.nodes);
        _hydratePageCache(data);
        useWikiStore.setState({ graphData: data });
        saveGraphCache(data);
      }
      _lastEtag = newEtag;
      _schedulePoll();
    } catch {
      _consecutiveFailures++;
      _currentPollInterval = Math.min(BASE_POLL_INTERVAL * Math.pow(2, _consecutiveFailures), MAX_POLL_INTERVAL);
      if (_consecutiveFailures >= MAX_FAILURES_BEFORE_STOP) {
        stopPolling();
        useWikiStore.setState({ apiConnected: false, error: 'Backend server unreachable. Polling stopped.' });
      } else {
        _schedulePoll();
        useWikiStore.setState({ apiConnected: false });
      }
    } finally {
      _pollFetching = false;
    }
  }, _currentPollInterval);
}

function _startPolling() {
  if (_pollTimer) return;
  _consecutiveFailures = 0;
  _currentPollInterval = BASE_POLL_INTERVAL;
  _schedulePoll();
}

function _hydratePageCache(data: GraphData) {
  const store = useWikiStore.getState();
  const cache = new Map(store.pageCache);
  const now = Date.now();
  for (const node of data.nodes) {
    if (node.markdown && !cache.has(node.label)) {
      if (cache.size >= PAGE_CACHE_MAX) {
        const oldest = [...cache.entries()].sort((a, b) => a[1].fetchedAt - b[1].fetchedAt)[0];
        if (oldest) cache.delete(oldest[0]);
      }
      cache.set(node.label, { content: node.markdown, fetchedAt: now });
    }
  }
  useWikiStore.setState({ pageCache: cache });
}

export const useWikiStore = create<WikiState>((set, get) => ({
  graphData: null,
  theme: (persisted.theme as WikiState['theme']) || 'system',
  sidebarCollapsed: (persisted.sidebarCollapsed as boolean) ?? false,
  loading: false,
  error: null,
  recentPages: (persisted.recentPages as string[]) || [],
  readingProgress: (persisted.readingProgress as Record<string, number>) || {},
  favorites: (persisted.favorites as string[]) || [],
  commandPaletteOpen: false,
  apiConnected: true,
  pageCache: new Map(),
  isOffline: false,
  heartbeatFailures: 0,

  initialize: async () => {
    stopPolling();
    const { graphData } = get();
    if (graphData) return;
    if (_initPromise) return _initPromise;

    _initPromise = (async () => {
      try {
        const cached = loadGraphCache();
        if (cached) {
          initSearch(cached.nodes);
          _hydratePageCache(cached);
          set({ graphData: cached, loading: false });
          try {
            const data = await fetchGraphData();
            initSearch(data.nodes);
            _hydratePageCache(data);
            set({ graphData: data, loading: false });
            saveGraphCache(data);
            const etag = await fetchIndexEtag();
            if (etag !== '0') _lastEtag = etag;
          } catch {
            // Keep cached data on refresh failure
          }
          _startPolling();
          return;
        }

        set({ loading: true, error: null });
        try {
          const data = await fetchGraphData();
          initSearch(data.nodes);
          _hydratePageCache(data);
          set({ graphData: data, loading: false });
          saveGraphCache(data);
          _startPolling();
        } catch (err) {
          set({ error: (err as Error).message, loading: false });
        }
      } finally {
        _initPromise = null;
      }
    })();
    return _initPromise;
  },

  stopPolling: () => {
    stopPolling();
  },

  checkApiHealth: async () => {
    try {
      const etag = await fetchIndexEtag();
      const connected = etag !== '0' && etag !== '';
      set({ apiConnected: connected, error: connected ? null : get().error });
      if (connected && !_pollTimer) {
        _consecutiveFailures = 0;
        _currentPollInterval = BASE_POLL_INTERVAL;
        _startPolling();
      }
      return connected;
    } catch {
      set({ apiConnected: false });
      return false;
    }
  },

  refreshGraphData: async () => {
    if (_initPromise) {
      try { await _initPromise; } catch { /* init failed, proceed with refresh */ }
    }
    if (get().isOffline) {
      const cached = loadGraphCache();
      if (cached) {
        initSearch(cached.nodes);
        _hydratePageCache(cached);
        set({ graphData: cached, loading: false });
        return;
      }
    }
    set({ loading: true, error: null });
    try {
      const data = await fetchGraphData();
      initSearch(data.nodes);
      _hydratePageCache(data);
      set({ graphData: data, loading: false });
      saveGraphCache(data);
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },

  toggleSidebar: () => {
    set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed }));
  },

  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),

  getNodeById: (id) => {
    return get().graphData?.nodes.find((n) => n.id === id);
  },

  getNodeByLabel: (label) => {
    return get().graphData?.nodes.find((n) => n.label === label);
  },

  getBacklinks: (() => {
    // Stable empty array to avoid unnecessary re-renders when graphData is null
    const EMPTY: GraphNode[] = [];
    return (nodeId: string) => {
      const { graphData } = get();
      if (!graphData) return EMPTY;
      const fromIds = new Set(
        graphData.edges.filter((e) => e.to === nodeId).map((e) => e.from)
      );
      return fromIds.size === 0 ? EMPTY : graphData.nodes.filter((n) => fromIds.has(n.id));
    };
  })(),

  addRecentPage: (pageId) => {
    set((s) => {
      const filtered = s.recentPages.filter((id) => id !== pageId);
      const recentPages = [pageId, ...filtered].slice(0, 20);
      return { recentPages };
    });
  },

  toggleFavorite: (pageId) => {
    set((s) => {
      const favorites = s.favorites.includes(pageId)
        ? s.favorites.filter((id) => id !== pageId)
        : [...s.favorites, pageId];
      return { favorites };
    });
  },

  isFavorite: (pageId) => get().favorites.includes(pageId),

  setReadingProgress: (pageId, progress) => {
    set((s) => {
      const readingProgress = { ...s.readingProgress, [pageId]: progress };
      _readingTimestamps[pageId] = Date.now();
      const keys = Object.keys(readingProgress);
      if (keys.length > MAX_READING_PROGRESS) {
        const sorted = keys.sort((a, b) => (_readingTimestamps[a] ?? 0) - (_readingTimestamps[b] ?? 0));
        const toDelete = sorted.slice(0, keys.length - MAX_READING_PROGRESS);
        for (const k of toDelete) {
          delete readingProgress[k];
          delete _readingTimestamps[k];
        }
      }
      return { readingProgress };
    });
  },

  getCachedPage: (slug: string) => {
    const cache = get().pageCache;
    const entry = cache.get(slug);
    if (entry && Date.now() - entry.fetchedAt < PAGE_CACHE_TTL) {
      return entry.content;
    }
    return null;
  },

  setCachedPage: (slug: string, content: string) => {
    const cache = new Map(get().pageCache);
    if (cache.size >= PAGE_CACHE_MAX) {
      const oldest = [...cache.entries()].sort((a, b) => a[1].fetchedAt - b[1].fetchedAt)[0];
      if (oldest) cache.delete(oldest[0]);
    }
    cache.set(slug, { content, fetchedAt: Date.now() });
    set({ pageCache: cache });
  },

  preloadLinkedPages: (content: string) => {
    const wikilinks = content.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g) || [];
    const targets = [...new Set(wikilinks.slice(0, 5).map(l => l.slice(2, -2).split('|')[0].trim()))];
    const cache = get().pageCache;
    const graphData = get().graphData;
    for (const target of targets) {
      if (!cache.has(target)) {
        const node = graphData?.nodes.find(n => n.label === target);
        if (node?.markdown) {
          setTimeout(() => {
            get().setCachedPage(target, node.markdown);
          }, 0);
        }
      }
    }
  },

  startHeartbeat: () => {
    if (_heartbeatTimer) return;
    _heartbeatTimer = setInterval(async () => {
      try {
        const resp = await fetchWithRetry('/api/health', { timeoutMs: 5000, retries: 2, retryDelayMs: 1000 });
        if (resp.ok) {
          if (get().heartbeatFailures > 0 || get().isOffline) {
            set({ heartbeatFailures: 0, isOffline: false });
          }
        } else {
          const failures = get().heartbeatFailures + 1;
          set({ heartbeatFailures: failures, isOffline: failures >= 3 });
        }
      } catch {
        const failures = get().heartbeatFailures + 1;
        set({ heartbeatFailures: failures, isOffline: failures >= 3 });
      }
    }, 30000);
  },
}));

// Auto-persist when relevant fields change
useWikiStore.subscribe((state, prevState) => {
  if (
    state.theme !== prevState.theme ||
    state.sidebarCollapsed !== prevState.sidebarCollapsed ||
    state.recentPages !== prevState.recentPages ||
    state.readingProgress !== prevState.readingProgress ||
    state.favorites !== prevState.favorites
  ) {
    persistState(state);
  }
});

applyTheme((persisted.theme as WikiState['theme']) || 'system');

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (_persistTimer) {
      clearTimeout(_persistTimer);
      _persistTimer = null;
      writePersist(useWikiStore.getState());
    }
  });
}
