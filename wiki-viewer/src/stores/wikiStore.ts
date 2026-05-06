import { create } from 'zustand';
import { fetchGraphData, fetchIndexEtag } from '@/services/dataService';
import { initSearch } from '@/lib/search';
import type { GraphData, GraphNode } from '@/types/graph';

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

const MAX_READING_PROGRESS = 100;
const _readingTimestamps: Record<string, number> = {};

let _initPromise: Promise<void> | null = null;
let _pollInterval: ReturnType<typeof setInterval> | null = null;
let _persistTimer: ReturnType<typeof setTimeout> | null = null;
let _lastEtag = '0';
let _pollFetching = false;

export function stopPolling() {
  if (_pollInterval) {
    clearInterval(_pollInterval);
    _pollInterval = null;
  }
}

function _startPolling() {
  if (_pollInterval) return;
  _pollInterval = setInterval(async () => {
    if (document.hidden || _pollFetching) return;
    _pollFetching = true;
    try {
      const newEtag = await fetchIndexEtag();
      if (newEtag !== _lastEtag && _lastEtag !== '0') {
        const data = await fetchGraphData();
        initSearch(data.nodes);
        useWikiStore.setState({ graphData: data });
        saveGraphCache(data);
      }
      _lastEtag = newEtag;
    } catch {
      // Ignore polling errors
    } finally {
      _pollFetching = false;
    }
  }, 30000);
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

  initialize: async () => {
    stopPolling(); // Clean up any existing interval before re-initializing
    const { graphData } = get();
    if (graphData) return;
    if (_initPromise) return _initPromise;

    _initPromise = (async () => {
      try {
        // Try loading from cache first for instant render
        const cached = loadGraphCache();
        if (cached) {
          initSearch(cached.nodes);
          set({ graphData: cached, loading: false });
          // Silently refresh in background
          try {
            const data = await fetchGraphData();
            initSearch(data.nodes);
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

  refreshGraphData: async () => {
    set({ loading: true, error: null });
    try {
      const data = await fetchGraphData();
      initSearch(data.nodes);
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
