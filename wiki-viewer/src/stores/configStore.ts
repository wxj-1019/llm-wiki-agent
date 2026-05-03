import { create } from 'zustand';

export interface RSSFeed {
  name: string;
  url: string;
}

export interface ArxivQuery {
  label: string;
  query: string;
}

export interface SystemConfig {
  github: {
    token: string;
    trending: {
      enabled: boolean;
      languages: string[];
      since_days: number;
      per_language: number;
    };
  };
  rss: {
    feeds: RSSFeed[];
  };
  arxiv: {
    queries: ArxivQuery[];
  };
  archive: {
    default_ttl_days: number;
  };
}

const DEFAULT_CONFIG: SystemConfig = {
  github: {
    token: '',
    trending: {
      enabled: true,
      languages: ['python', 'javascript', 'typescript', 'rust', 'go'],
      since_days: 7,
      per_language: 5,
    },
  },
  rss: {
    feeds: [
      { name: 'Hacker News - AI', url: 'https://hnrss.org/newest?q=artificial+intelligence' },
    ],
  },
  arxiv: {
    queries: [
      { label: 'LLMs & Agents', query: 'cat:cs.AI OR cat:cs.CL OR cat:cs.LG' },
    ],
  },
  archive: {
    default_ttl_days: 90,
  },
};

import { safeGet, safeSet, isObject } from '@/lib/safeStorage';

function loadFromStorage(): SystemConfig {
  const stored = safeGet('wiki-system-config', isObject, {});
  return { ...DEFAULT_CONFIG, ...stored } as SystemConfig;
}

interface ConfigState {
  config: SystemConfig;
  apiAvailable: boolean | null;
  setConfig: (partial: Partial<SystemConfig>) => void;
  updateGithub: (partial: Partial<SystemConfig['github']>) => void;
  updateTrending: (partial: Partial<SystemConfig['github']['trending']>) => void;
  setRssFeeds: (feeds: RSSFeed[]) => void;
  setArxivQueries: (queries: ArxivQuery[]) => void;
  setArchiveTtl: (days: number) => void;
  checkApi: () => Promise<void>;
  saveToServer: () => Promise<boolean>;
  loadFromServer: () => Promise<boolean>;
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  config: loadFromStorage(),
  apiAvailable: null,

  setConfig: (partial) => {
    const next = { ...get().config, ...partial };
    set({ config: next });
    safeSet('wiki-system-config', next);
  },

  updateGithub: (partial) => {
    const next = { ...get().config, github: { ...get().config.github, ...partial } };
    set({ config: next });
    safeSet('wiki-system-config', next);
  },

  updateTrending: (partial) => {
    const next = {
      ...get().config,
      github: { ...get().config.github, trending: { ...get().config.github.trending, ...partial } },
    };
    set({ config: next });
    safeSet('wiki-system-config', next);
  },

  setRssFeeds: (feeds) => {
    const next = { ...get().config, rss: { feeds } };
    set({ config: next });
    safeSet('wiki-system-config', next);
  },

  setArxivQueries: (queries) => {
    const next = { ...get().config, arxiv: { queries } };
    set({ config: next });
    safeSet('wiki-system-config', next);
  },

  setArchiveTtl: (days) => {
    const next = { ...get().config, archive: { default_ttl_days: days } };
    set({ config: next });
    safeSet('wiki-system-config', next);
  },

  checkApi: async () => {
    try {
      const res = await fetch('/api/health', { signal: AbortSignal.timeout(3000) });
      set({ apiAvailable: res.ok });
    } catch {
      set({ apiAvailable: false });
    }
  },

  saveToServer: async () => {
    try {
      const cfg = get().config;
      // Save github sources
      const githubYaml = buildGithubYaml(cfg);
      const g1 = await fetch('/api/config/github_sources', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: githubYaml,
      });
      // Save rss sources
      const rssYaml = buildRssYaml(cfg);
      const g2 = await fetch('/api/config/rss_sources', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: rssYaml,
      });
      // Save arxiv sources
      const arxivYaml = buildArxivYaml(cfg);
      const g3 = await fetch('/api/config/arxiv_sources', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: arxivYaml,
      });
      return g1.ok && g2.ok && g3.ok;
    } catch {
      return false;
    }
  },

  loadFromServer: async () => {
    try {
      const [g1, g2, g3] = await Promise.all([
        fetch('/api/config/github_sources').then((r) => (r.ok ? r.json().then((d: { content: string }) => d.content) : null)),
        fetch('/api/config/rss_sources').then((r) => (r.ok ? r.json().then((d: { content: string }) => d.content) : null)),
        fetch('/api/config/arxiv_sources').then((r) => (r.ok ? r.json().then((d: { content: string }) => d.content) : null)),
      ]);
      let updated = false;
      if (g1) {
        const parsed = parseGithubYaml(g1);
        if (parsed) {
          set({ config: { ...get().config, ...parsed } });
          updated = true;
        }
      }
      if (g2) {
        const parsed = parseRssYaml(g2);
        if (parsed) {
          set({ config: { ...get().config, ...parsed } });
          updated = true;
        }
      }
      if (g3) {
        const parsed = parseArxivYaml(g3);
        if (parsed) {
          set({ config: { ...get().config, ...parsed } });
          updated = true;
        }
      }
      if (updated) {
        localStorage.setItem('wiki-system-config', JSON.stringify(get().config));
      }
      return updated;
    } catch {
      return false;
    }
  },
}));

function buildGithubYaml(cfg: SystemConfig): string {
  const t = cfg.github.trending;
  return `# GitHub configuration (auto-generated)
repos: []

trending:
  enabled: ${t.enabled}
  languages: [${t.languages.map((l) => `"${l}"`).join(', ')}]
  since_days: ${t.since_days}
  per_language: ${t.per_language}
`;
}

function parseGithubYaml(text: string): Partial<SystemConfig> | null {
  try {
    // Simple heuristic parsing for trending block
    const enabled = /enabled:\s*(true|false)/.exec(text);
    const since = /since_days:\s*(\d+)/.exec(text);
    const per = /per_language:\s*(\d+)/.exec(text);
    const langMatch = /languages:\s*\[(.*?)\]/.exec(text);
    const languages = langMatch
      ? langMatch[1].split(',').map((s) => s.trim().replace(/["']/g, '')).filter(Boolean)
      : ['python'];
    return {
      github: {
        token: '',
        trending: {
          enabled: enabled ? enabled[1] === 'true' : true,
          languages,
          since_days: since ? parseInt(since[1]) : 7,
          per_language: per ? parseInt(per[1]) : 5,
        },
      },
    };
  } catch {
    return null;
  }
}

function buildRssYaml(cfg: SystemConfig): string {
  const feeds = cfg.rss.feeds
    .map((f) => `  - name: "${f.name}"\n    url: "${f.url}"`)
    .join('\n');
  return `# RSS configuration (auto-generated)\nfeeds:\n${feeds}\n`;
}

function parseRssYaml(text: string): Partial<SystemConfig> | null {
  try {
    const feeds: RSSFeed[] = [];
    const lines = text.split('\n');
    let current: Partial<RSSFeed> = {};
    for (const line of lines) {
      const nameMatch = /name:\s*"(.+)"/.exec(line);
      const urlMatch = /url:\s*"(.+)"/.exec(line);
      if (nameMatch) current.name = nameMatch[1];
      if (urlMatch) {
        current.url = urlMatch[1];
        if (current.name) feeds.push({ name: current.name, url: current.url });
        current = {};
      }
    }
    return { rss: { feeds } };
  } catch {
    return null;
  }
}

function buildArxivYaml(cfg: SystemConfig): string {
  const queries = cfg.arxiv.queries
    .map((q) => `  - label: "${q.label}"\n    query: "${q.query}"`)
    .join('\n');
  return `# arXiv configuration (auto-generated)\nqueries:\n${queries}\n`;
}

function parseArxivYaml(text: string): Partial<SystemConfig> | null {
  try {
    const queries: ArxivQuery[] = [];
    const lines = text.split('\n');
    let current: Partial<ArxivQuery> = {};
    for (const line of lines) {
      const labelMatch = /label:\s*"(.+)"/.exec(line);
      const queryMatch = /query:\s*"(.+)"/.exec(line);
      if (labelMatch) current.label = labelMatch[1];
      if (queryMatch) {
        current.query = queryMatch[1];
        if (current.label) queries.push({ label: current.label, query: current.query });
        current = {};
      }
    }
    return { arxiv: { queries } };
  } catch {
    return null;
  }
}
