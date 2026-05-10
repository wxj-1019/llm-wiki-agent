import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe, Plus, Trash2, Play, Zap, Save, Terminal, X, CheckCircle,
  AlertCircle, Loader2, RefreshCw, ChevronDown, ChevronRight,
  Rss, GitBranch, BookOpen, ArrowRight, Bug, Radio, TrendingUp,
  FileText, Layers, Info, HelpCircle, BookMarked, Sparkles, Lightbulb,
} from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import {
  fetchWebSourcesConfig, saveWebSourcesConfig,
  runCrawler, runBatchPipeline, fetchUrlArticle,
  runRssCrawler, runGithubCrawler, runArxivCrawler,
  type CrawlerRunResult, type BatchResult,
} from '@/services/dataService';

/* ── Types ─────────────────────────────────────────────── */

type SourceTab = 'web' | 'rss' | 'github' | 'arxiv' | 'quick';

interface WebUrl { url: string; name: string; tags: string[]; }
interface WebSettings {
  timeout: number; user_agent: string; respect_robots_txt: boolean;
  fallback_to_markitdown: boolean; request_delay: number;
  max_retries: number; content_min_length: number;
  rotate_ua: boolean; use_browser: boolean; use_llm: boolean;
  max_depth: number; stay_in_domain: boolean;
  include_patterns: string[]; exclude_patterns: string[];
  max_pages_per_source: number;
}

interface RssFeed { name: string; url: string; }

interface GithubRepo { repo: string; kinds: string[]; }
interface GithubTrending {
  enabled: boolean; languages: string[]; since_days: number; per_language: number;
}

interface ArxivQuery { label: string; query: string; }

/* ── Network pulse visual ─────────────────────────────── */

function NetworkPulse() {
  return (
    <div className="relative w-full h-20 overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)]">
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="np-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--apple-blue)" stopOpacity="0" />
            <stop offset="50%" stopColor="var(--apple-blue)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--apple-blue)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="15%" y1="50%" x2="38%" y2="30%" stroke="url(#np-grad)" strokeWidth="1.5">
          <animate attributeName="stroke-opacity" values="0.1;0.4;0.1" dur="4s" repeatCount="indefinite" />
        </line>
        <line x1="38%" y1="30%" x2="62%" y2="65%" stroke="url(#np-grad)" strokeWidth="1.5">
          <animate attributeName="stroke-opacity" values="0.1;0.35;0.1" dur="5s" repeatCount="indefinite" />
        </line>
        <line x1="62%" y1="65%" x2="85%" y2="40%" stroke="url(#np-grad)" strokeWidth="1.5">
          <animate attributeName="stroke-opacity" values="0.1;0.3;0.1" dur="6s" repeatCount="indefinite" />
        </line>
        {[['15%', '50%', '3s'], ['38%', '30%', '4s'], ['62%', '65%', '5s'], ['85%', '40%', '3.5s']].map(([cx, cy, dur], i) => (
          <g key={i}>
            <circle cx={cx} cy={cy} r="5" fill="var(--bg-secondary)">
              <animate attributeName="r" values="4;6;4" dur={dur} repeatCount="indefinite" />
            </circle>
            <circle cx={cx} cy={cy} r="3" fill="var(--apple-blue)" opacity="0.6">
              <animate attributeName="opacity" values="0.4;0.8;0.4" dur={dur} repeatCount="indefinite" />
            </circle>
          </g>
        ))}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center gap-6 pointer-events-none">
        {[
          { icon: Globe, label: 'Web', color: 'text-apple-blue' },
          { icon: Rss, label: 'RSS', color: 'text-apple-orange' },
          { icon: GitBranch, label: 'GitHub', color: 'text-apple-purple' },
          { icon: BookOpen, label: 'arXiv', color: 'text-apple-green' },
        ].map(({ icon: Icon, label, color }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
            <Icon className={`w-3.5 h-3.5 ${color}`} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Help components ──────────────────────────────────── */

function HelpCard({ children, title }: { children: React.ReactNode; title: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="apple-card overflow-hidden bg-gradient-to-r from-[var(--bg-secondary)] to-color-mix(in_srgb,var(--marshmallow-sky)_6%,var(--bg-secondary))">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-5 py-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-colors"
      >
        <HelpCircle className="w-4 h-4 text-apple-blue" />
        <span className="flex-1 text-left">{title}</span>
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 text-sm text-[var(--text-secondary)] space-y-2">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InlineHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] text-[var(--text-tertiary)] mt-1 flex items-start gap-1">
      <Info className="w-3 h-3 mt-0.5 flex-shrink-0 opacity-60" />
      <span>{children}</span>
    </p>
  );
}

function PresetButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 text-xs text-apple-blue hover:text-apple-blue-hover transition-colors"
    >
      <Sparkles className="w-3 h-3" />
      {label}
    </button>
  );
}

/* ── YAML helpers ─────────────────────────────────────── */

function parseWebYaml(raw: string): { urls: WebUrl[]; settings: WebSettings } {
  const urls: WebUrl[] = [];
  const settings: WebSettings = {
    timeout: 30, user_agent: 'llm-wiki-agent/1.0',
    respect_robots_txt: true, fallback_to_markitdown: true,
    request_delay: 1, max_retries: 3, content_min_length: 200,
    rotate_ua: true, use_browser: false, use_llm: false,
    max_depth: 0, stay_in_domain: true,
    include_patterns: [], exclude_patterns: [],
    max_pages_per_source: 10,
  };
  const urlBlocks = raw.split(/^- url:/m).slice(1);
  for (const block of urlBlocks) {
    const lines = block.split('\n');
    const url = (lines[0] ?? '').trim().replace(/^["']|["']$/g, '');
    let name = '';
    let tags: string[] = [];
    for (const line of lines.slice(1)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('- url:') || trimmed.startsWith('settings:')) break;
      if (trimmed.startsWith('name:')) name = trimmed.slice(5).trim().replace(/^["']|["']$/g, '');
      if (trimmed.startsWith('tags:')) {
        const tagStr = trimmed.slice(5).trim();
        tags = tagStr.replace(/[\[\]]/g, '').split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      }
    }
    if (url) urls.push({ url, name, tags });
  }
  const settingsMatch = raw.match(/^settings:\s*\n([\s\S]*?)(?=\n\S|\n*$)/m);
  if (settingsMatch?.[1]) {
    for (const line of settingsMatch[1].split('\n')) {
      const m = line.match(/^\s+(\w+):\s*(.+)/);
      if (m?.[1] && m[2]) {
        const key = m[1] as keyof WebSettings;
        const val = m[2].trim().replace(/^["']|["']$/g, '');
        if (key === 'timeout' || key === 'request_delay' || key === 'max_retries' || key === 'content_min_length' || key === 'max_depth' || key === 'max_pages_per_source') {
          (settings as unknown as Record<string, unknown>)[key] = parseInt(val, 10) || (settings as unknown as Record<string, unknown>)[key];
        } else if (key === 'respect_robots_txt' || key === 'fallback_to_markitdown' || key === 'rotate_ua' || key === 'use_browser' || key === 'use_llm' || key === 'stay_in_domain') {
          (settings as unknown as Record<string, unknown>)[key] = val === 'true';
        } else if (key === 'user_agent') {
          settings.user_agent = val;
        } else if (key === 'include_patterns' || key === 'exclude_patterns') {
          (settings as unknown as Record<string, unknown>)[key] = val.replace(/[\[\]]/g, '').split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
        }
      }
    }
  }
  return { urls, settings };
}

function buildWebYaml(urls: WebUrl[], settings: WebSettings): string {
  const esc = (s: string): string => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  let yaml = 'urls:\n';
  for (const item of urls) {
    yaml += `  - url: ${esc(item.url)}\n`;
    if (item.name) yaml += `    name: ${esc(item.name)}\n`;
    if (item.tags.length) yaml += `    tags: [${item.tags.join(', ')}]\n`;
  }
  yaml += '\nsettings:\n';
  yaml += `  timeout: ${settings.timeout}\n`;
  yaml += `  user_agent: ${esc(settings.user_agent)}\n`;
  yaml += `  respect_robots_txt: ${settings.respect_robots_txt}\n`;
  yaml += `  fallback_to_markitdown: ${settings.fallback_to_markitdown}\n`;
  yaml += `  request_delay: ${settings.request_delay}\n`;
  yaml += `  max_retries: ${settings.max_retries}\n`;
  yaml += `  content_min_length: ${settings.content_min_length}\n`;
  yaml += `  rotate_ua: ${settings.rotate_ua}\n`;
  yaml += `  use_browser: ${settings.use_browser}\n`;
  yaml += `  use_llm: ${settings.use_llm}\n`;
  yaml += `  max_depth: ${settings.max_depth}\n`;
  yaml += `  stay_in_domain: ${settings.stay_in_domain}\n`;
  yaml += `  max_pages_per_source: ${settings.max_pages_per_source}\n`;
  if (settings.include_patterns.length) yaml += `  include_patterns: [${settings.include_patterns.map(esc).join(', ')}]\n`;
  if (settings.exclude_patterns.length) yaml += `  exclude_patterns: [${settings.exclude_patterns.map(esc).join(', ')}]\n`;
  return yaml;
}

function parseRssYaml(raw: string): { feeds: RssFeed[] } {
  const feeds: RssFeed[] = [];
  const blocks = raw.split(/^- name:/m).slice(1);
  for (const block of blocks) {
    const lines = block.split('\n');
    const name = (lines[0] ?? '').trim().replace(/^["']|["']$/g, '');
    let url = '';
    for (const line of lines.slice(1)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('- name:')) break;
      if (trimmed.startsWith('url:')) url = trimmed.slice(4).trim().replace(/^["']|["']$/g, '');
    }
    if (name && url) feeds.push({ name, url });
  }
  return { feeds };
}

function buildRssYaml(feeds: RssFeed[]): string {
  const esc = (s: string): string => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  let yaml = 'feeds:\n';
  for (const f of feeds) {
    yaml += `  - name: ${esc(f.name)}\n`;
    yaml += `    url: ${esc(f.url)}\n`;
  }
  return yaml;
}

function parseGithubYaml(raw: string): { repos: GithubRepo[]; trending: GithubTrending } {
  const repos: GithubRepo[] = [];
  const trending: GithubTrending = { enabled: false, languages: ['all'], since_days: 7, per_language: 5 };
  const repoBlocks = raw.split(/^- repo:/m).slice(1);
  for (const block of repoBlocks) {
    const lines = block.split('\n');
    const repo = (lines[0] ?? '').trim().replace(/^["']|["']$/g, '');
    let kinds: string[] = [];
    for (const line of lines.slice(1)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('- repo:') || trimmed.startsWith('trending:')) break;
      if (trimmed.startsWith('kinds:')) {
        kinds = trimmed.slice(6).trim().replace(/[\[\]]/g, '').split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      }
    }
    if (repo) repos.push({ repo, kinds: kinds.length ? kinds : ['info'] });
  }
  const trendMatch = raw.match(/^trending:\s*\n([\s\S]*?)(?=\n\S|\n*$)/m);
  if (trendMatch?.[1]) {
    for (const line of trendMatch[1].split('\n')) {
      const m = line.match(/^\s+(\w+):\s*(.+)/);
      if (!m) continue;
      const key = m[1];
      const val = m[2].trim().replace(/^["']|["']$/g, '');
      if (key === 'enabled') trending.enabled = val === 'true';
      if (key === 'since_days') trending.since_days = parseInt(val, 10) || 7;
      if (key === 'per_language') trending.per_language = parseInt(val, 10) || 5;
      if (key === 'languages') {
        trending.languages = val.replace(/[\[\]]/g, '').split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      }
    }
  }
  return { repos, trending };
}

function buildGithubYaml(repos: GithubRepo[], trending: GithubTrending): string {
  const esc = (s: string): string => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  let yaml = 'repos:\n';
  for (const r of repos) {
    yaml += `  - repo: ${esc(r.repo)}\n`;
    yaml += `    kinds: [${r.kinds.join(', ')}]\n`;
  }
  yaml += '\ntrending:\n';
  yaml += `  enabled: ${trending.enabled}\n`;
  yaml += `  languages: [${trending.languages.join(', ')}]\n`;
  yaml += `  since_days: ${trending.since_days}\n`;
  yaml += `  per_language: ${trending.per_language}\n`;
  return yaml;
}

function parseArxivYaml(raw: string): { queries: ArxivQuery[] } {
  const queries: ArxivQuery[] = [];
  const blocks = raw.split(/^- label:/m).slice(1);
  for (const block of blocks) {
    const lines = block.split('\n');
    const label = (lines[0] ?? '').trim().replace(/^["']|["']$/g, '');
    let query = '';
    for (const line of lines.slice(1)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('- label:')) break;
      if (trimmed.startsWith('query:')) query = trimmed.slice(6).trim().replace(/^["']|["']$/g, '');
    }
    if (label && query) queries.push({ label, query });
  }
  return { queries };
}

function buildArxivYaml(queries: ArxivQuery[]): string {
  const esc = (s: string): string => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  let yaml = 'queries:\n';
  for (const q of queries) {
    yaml += `  - label: ${esc(q.label)}\n`;
    yaml += `    query: ${esc(q.query)}\n`;
  }
  return yaml;
}

/* ── Main component ───────────────────────────────────── */

const TAB_META: Record<SourceTab, { label: string; icon: React.ElementType; color: string; configName: string }> = {
  web: { label: 'Web', icon: Globe, color: 'text-apple-blue', configName: 'web_sources' },
  rss: { label: 'RSS', icon: Rss, color: 'text-apple-orange', configName: 'rss_sources' },
  github: { label: 'GitHub', icon: GitBranch, color: 'text-apple-purple', configName: 'github_sources' },
  arxiv: { label: 'arXiv', icon: BookOpen, color: 'text-apple-green', configName: 'arxiv_sources' },
  quick: { label: 'Quick Fetch', icon: Zap, color: 'text-apple-teal', configName: '' },
};

export function CrawlerPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('crawler.title'));

  const [activeTab, setActiveTab] = useState<SourceTab>('web');

  /* Web */
  const [webUrls, setWebUrls] = useState<WebUrl[]>([]);
  const [webSettings, setWebSettings] = useState<WebSettings>({
    timeout: 30, user_agent: 'llm-wiki-agent/1.0',
    respect_robots_txt: true, fallback_to_markitdown: true,
    request_delay: 1, max_retries: 3, content_min_length: 200,
    rotate_ua: true, use_browser: false, use_llm: false,
    max_depth: 0, stay_in_domain: true,
    include_patterns: [], exclude_patterns: [],
    max_pages_per_source: 10,
  });
  const [newWebUrl, setNewWebUrl] = useState('');
  const [newWebName, setNewWebName] = useState('');
  const [newWebTags, setNewWebTags] = useState('');

  /* RSS */
  const [rssFeeds, setRssFeeds] = useState<RssFeed[]>([]);
  const [newRssName, setNewRssName] = useState('');
  const [newRssUrl, setNewRssUrl] = useState('');

  /* GitHub */
  const [ghRepos, setGhRepos] = useState<GithubRepo[]>([]);
  const [ghTrending, setGhTrending] = useState<GithubTrending>({ enabled: false, languages: ['all'], since_days: 7, per_language: 5 });
  const [newGhRepo, setNewGhRepo] = useState('');

  /* arXiv */
  const [arxivQueries, setArxivQueries] = useState<ArxivQuery[]>([]);
  const [newArxivLabel, setNewArxivLabel] = useState('');
  const [newArxivQuery, setNewArxivQuery] = useState('');

  /* Quick fetch */
  const [quickUrl, setQuickUrl] = useState('');
  const [quickName, setQuickName] = useState('');
  const [quickTags, setQuickTags] = useState('');
  const [quickUseLlm, setQuickUseLlm] = useState(false);
  const [quickUseBrowser, setQuickUseBrowser] = useState(false);
  const [quickResult, setQuickResult] = useState<{ success: boolean; saved_file: string | null; quality: string | null; engine: string | null } | null>(null);

  /* Global UI */
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState<Record<SourceTab, boolean>>({ web: false, rss: false, github: false, arxiv: false, quick: false });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [crawlResult, setCrawlResult] = useState<Record<string, CrawlerRunResult | null>>({});
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  const [showOutput, setShowOutput] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);

  useBodyScrollLock(showOutput);

  const isBusy = Object.values(running).some(Boolean) || saving;

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const configs = await Promise.all([
        fetchConfig('web_sources'),
        fetchConfig('rss_sources'),
        fetchConfig('github_sources'),
        fetchConfig('arxiv_sources'),
      ]);
      const web = parseWebYaml(configs[0]);
      setWebUrls(web.urls);
      setWebSettings(web.settings);
      const rss = parseRssYaml(configs[1]);
      setRssFeeds(rss.feeds);
      const gh = parseGithubYaml(configs[2]);
      setGhRepos(gh.repos);
      setGhTrending(gh.trending);
      const arx = parseArxivYaml(configs[3]);
      setArxivQueries(arx.queries);
      setDirty({ web: false, rss: false, github: false, arxiv: false, quick: false });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('crawler.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function fetchConfig(name: string): Promise<string> {
    const res = await fetch(`/api/config/${name}`);
    if (!res.ok) throw new Error(`Failed to load ${name}`);
    const data = await res.json();
    return data.content || '';
  }

  async function saveConfig(name: string, content: string) {
    const res = await fetch(`/api/config/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/yaml' },
      body: content,
    });
    if (!res.ok) throw new Error(`Failed to save ${name}`);
  }

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      await Promise.all([
        dirty.web ? saveConfig('web_sources', buildWebYaml(webUrls, webSettings)) : Promise.resolve(),
        dirty.rss ? saveConfig('rss_sources', buildRssYaml(rssFeeds)) : Promise.resolve(),
        dirty.github ? saveConfig('github_sources', buildGithubYaml(ghRepos, ghTrending)) : Promise.resolve(),
        dirty.arxiv ? saveConfig('arxiv_sources', buildArxivYaml(arxivQueries)) : Promise.resolve(),
      ]);
      setDirty({ web: false, rss: false, github: false, arxiv: false, quick: false });
      setSuccess(t('crawler.saved'));
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('crawler.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const runForTab = async (tab: SourceTab) => {
    const runners: Record<string, () => Promise<CrawlerRunResult>> = {
      web: () => runCrawler({ use_llm: webSettings.use_llm, use_browser: webSettings.use_browser }),
      rss: runRssCrawler,
      github: runGithubCrawler,
      arxiv: runArxivCrawler,
    };
    if (!runners[tab]) return;
    try {
      setRunning(prev => ({ ...prev, [tab]: true }));
      setError(null);
      setShowOutput(true);
      const result = await runners[tab]();
      setCrawlResult(prev => ({ ...prev, [tab]: result }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('crawler.crawlFailed'));
    } finally {
      setRunning(prev => ({ ...prev, [tab]: false }));
    }
  };

  const handleBatch = async () => {
    try {
      setRunning(prev => ({ ...prev, batch: true }));
      setError(null);
      setBatchResult(null);
      setShowOutput(true);
      const result = await runBatchPipeline();
      setBatchResult(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('crawler.pipelineFailed'));
    } finally {
      setRunning(prev => ({ ...prev, batch: false }));
    }
  };

  const handleQuickFetch = async () => {
    if (!quickUrl.trim()) return;
    try {
      setRunning(prev => ({ ...prev, quick: true }));
      setError(null);
      setQuickResult(null);
      setShowOutput(true);
      const result = await fetchUrlArticle(
        quickUrl.trim(),
        quickName.trim(),
        quickTags.split(',').map(s => s.trim()).filter(Boolean),
        { use_llm: quickUseLlm, use_browser: quickUseBrowser },
      );
      setQuickResult(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('crawler.crawlFailed'));
    } finally {
      setRunning(prev => ({ ...prev, quick: false }));
    }
  };

  const hasDirty = Object.values(dirty).some(Boolean);

  const statCards = [
    { key: 'web', label: 'Web', icon: Globe, color: 'text-apple-blue', bg: 'bg-apple-blue/10', count: webUrls.length },
    { key: 'rss', label: 'RSS', icon: Rss, color: 'text-apple-orange', bg: 'bg-apple-orange/10', count: rssFeeds.length },
    { key: 'github', label: 'GitHub', icon: GitBranch, color: 'text-apple-purple', bg: 'bg-apple-purple/10', count: ghRepos.length },
    { key: 'arxiv', label: 'arXiv', icon: BookOpen, color: 'text-apple-green', bg: 'bg-apple-green/10', count: arxivQueries.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-heading-1 flex items-center gap-2">
            <Bug className="w-6 h-6 text-apple-blue" />
            {t('crawler.title')}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">{t('crawler.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {hasDirty && (
            <span className="text-xs text-apple-orange bg-apple-orange/10 px-2 py-1 rounded-full">
              {t('crawler.unsaved')}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={isBusy || !hasDirty}
            className="apple-button-ghost text-sm gap-1.5 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? t('crawler.saving') : t('crawler.save')}
          </button>
        </div>
      </div>

      <NetworkPulse />

      {/* Source stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map(({ key, label, icon: Icon, color, bg, count }) => (
          <motion.button
            key={key}
            whileHover={{ y: -2 }}
            onClick={() => setActiveTab(key as SourceTab)}
            className={`apple-card p-4 flex items-center gap-3 text-left transition-all ${activeTab === key ? 'ring-2 ring-[var(--apple-blue)] ring-offset-2 ring-offset-[var(--bg-primary)]' : ''}`}
          >
            <div className={`p-2.5 rounded-xl ${bg} ${color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <div className="text-lg font-semibold">{count}</div>
              <div className="text-[11px] text-[var(--text-secondary)]">{label}</div>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Alerts */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 p-3 rounded-xl bg-apple-red/10 text-apple-red text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="p-1 rounded-xl hover:bg-apple-red/20" aria-label={t('common.dismiss')}>
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
        {success && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 p-3 rounded-xl bg-apple-green/10 text-apple-green text-sm">
            <CheckCircle className="w-4 h-4" />
            {success}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(TAB_META) as SourceTab[]).map((tab) => {
          const { label, icon: Icon, color } = TAB_META[tab];
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                active
                  ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${active ? color : ''}`} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {activeTab === 'web' && (
          <motion.div key="web" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
            <HelpCard title="How Web Crawling Works">
              <p>Configure URLs to fetch article content automatically. The crawler visits each URL, extracts the main article body, and saves it as Markdown in <code className="px-1 py-0.5 bg-[var(--bg-tertiary)] rounded text-[11px] font-mono">raw-inbox/fetched/web/</code>.</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li><strong>URL</strong> — Full address starting with <code className="font-mono">https://</code></li>
                <li><strong>Name</strong> — Optional display name for your reference</li>
                <li><strong>Tags</strong> — Categories like <code className="font-mono">ai, paper, blog</code> (comma separated)</li>
                <li><strong>Settings</strong> — Adjust timeout, request delay (politeness), and content quality threshold</li>
              </ul>
              <div className="pt-1">
                <PresetButton label="Load example URLs" onClick={() => {
                  setWebUrls([
                    { url: 'https://news.ycombinator.com/', name: 'Hacker News', tags: ['tech', 'news'] },
                    { url: 'https://openai.com/blog/', name: 'OpenAI Blog', tags: ['ai', 'llm'] },
                  ]);
                  setDirty(prev => ({ ...prev, web: true }));
                }} />
              </div>
            </HelpCard>

            <div className="flex flex-wrap items-center gap-3">
              <button onClick={() => runForTab('web')} disabled={isBusy || webUrls.length === 0} className="apple-button text-sm gap-2 disabled:opacity-50">
                {running.web ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {running.web ? t('crawler.running') : t('crawler.crawlAll')}
              </button>
              <button onClick={handleBatch} disabled={isBusy} className="apple-button text-sm gap-2 disabled:opacity-50">
                {running.batch ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                {running.batch ? t('crawler.runningPipeline') : t('crawler.runPipeline')}
              </button>
              <button onClick={loadAll} disabled={isBusy} className="apple-button-ghost text-sm gap-1.5 disabled:opacity-50">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                {t('crawler.reload')}
              </button>
            </div>

            {/* Settings */}
            <div className="apple-card overflow-hidden">
              <button onClick={() => setShowSettings(!showSettings)} className="w-full flex items-center gap-2 px-5 py-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors">
                {showSettings ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                {t('crawler.settings')}
              </button>
              <AnimatePresence>
                {showSettings && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="px-5 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t('crawler.setting.timeout')}</label>
                        <input type="number" value={webSettings.timeout} onChange={(e) => { setWebSettings(p => ({ ...p, timeout: parseInt(e.target.value, 10) || 0 })); setDirty(prev => ({ ...prev, web: true })); }} className="apple-input w-full py-1.5 text-sm" />
                        <InlineHint>Seconds to wait for each page to load before giving up.</InlineHint>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t('crawler.setting.delay')}</label>
                        <input type="number" value={webSettings.request_delay} onChange={(e) => { setWebSettings(p => ({ ...p, request_delay: parseInt(e.target.value, 10) || 0 })); setDirty(prev => ({ ...prev, web: true })); }} className="apple-input w-full py-1.5 text-sm" />
                        <InlineHint>Seconds between requests. Increase to be polite to target servers.</InlineHint>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t('crawler.setting.retries')}</label>
                        <input type="number" value={webSettings.max_retries} onChange={(e) => { setWebSettings(p => ({ ...p, max_retries: parseInt(e.target.value, 10) || 0 })); setDirty(prev => ({ ...prev, web: true })); }} className="apple-input w-full py-1.5 text-sm" />
                        <InlineHint>How many times to retry a failed request.</InlineHint>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t('crawler.setting.minLen')}</label>
                        <input type="number" value={webSettings.content_min_length} onChange={(e) => { setWebSettings(p => ({ ...p, content_min_length: parseInt(e.target.value, 10) || 0 })); setDirty(prev => ({ ...prev, web: true })); }} className="apple-input w-full py-1.5 text-sm" />
                        <InlineHint>Minimum article length in characters. Shorter pages are skipped.</InlineHint>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t('crawler.setting.userAgent')}</label>
                        <input type="text" value={webSettings.user_agent} onChange={(e) => { setWebSettings(p => ({ ...p, user_agent: e.target.value })); setDirty(prev => ({ ...prev, web: true })); }} className="apple-input w-full py-1.5 text-sm" />
                        <InlineHint>Identifies your crawler to websites. Keep it honest and descriptive.</InlineHint>
                      </div>
                      <div className="flex flex-col gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={webSettings.respect_robots_txt} onChange={(e) => { setWebSettings(p => ({ ...p, respect_robots_txt: e.target.checked })); setDirty(prev => ({ ...prev, web: true })); }} className="w-4 h-4 rounded border-[var(--border-default)] text-apple-blue accent-apple-blue" />
                          <span className="text-sm text-[var(--text-secondary)]">{t('crawler.setting.robots')}</span>
                        </label>
                        <InlineHint>Respect robots.txt rules on target websites (recommended).</InlineHint>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={webSettings.fallback_to_markitdown} onChange={(e) => { setWebSettings(p => ({ ...p, fallback_to_markitdown: e.target.checked })); setDirty(prev => ({ ...prev, web: true })); }} className="w-4 h-4 rounded border-[var(--border-default)] text-apple-blue accent-apple-blue" />
                          <span className="text-sm text-[var(--text-secondary)]">{t('crawler.setting.fallback')}</span>
                        </label>
                        <InlineHint>Fallback to markitdown if trafilatura extraction fails.</InlineHint>
                      </div>

                      {/* New settings: Advanced */}
                      <div className="sm:col-span-2 pt-2 border-t border-[var(--border-subtle)]">
                        <h4 className="text-xs font-semibold text-[var(--text-secondary)] mb-3 flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3 text-apple-purple" />
                          {t('crawler.settingsAdvanced')}
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="flex flex-col gap-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={webSettings.rotate_ua} onChange={(e) => { setWebSettings(p => ({ ...p, rotate_ua: e.target.checked })); setDirty(prev => ({ ...prev, web: true })); }} className="w-4 h-4 rounded border-[var(--border-default)] text-apple-purple accent-apple-purple" />
                              <span className="text-sm text-[var(--text-secondary)]">{t('crawler.setting.rotateUA')}</span>
                            </label>
                            <InlineHint>Randomly rotate User-Agent strings to reduce fingerprinting.</InlineHint>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={webSettings.use_browser} onChange={(e) => { setWebSettings(p => ({ ...p, use_browser: e.target.checked })); setDirty(prev => ({ ...prev, web: true })); }} className="w-4 h-4 rounded border-[var(--border-default)] text-apple-purple accent-apple-purple" />
                              <span className="text-sm text-[var(--text-secondary)]">{t('crawler.setting.useBrowser')}</span>
                            </label>
                            <InlineHint>{t('crawler.setting.useBrowserHint')}</InlineHint>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={webSettings.use_llm} onChange={(e) => { setWebSettings(p => ({ ...p, use_llm: e.target.checked })); setDirty(prev => ({ ...prev, web: true })); }} className="w-4 h-4 rounded border-[var(--border-default)] text-apple-purple accent-apple-purple" />
                              <span className="text-sm text-[var(--text-secondary)]">{t('crawler.setting.useLLM')}</span>
                            </label>
                            <InlineHint>{t('crawler.setting.useLLMHint')}</InlineHint>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={webSettings.stay_in_domain} onChange={(e) => { setWebSettings(p => ({ ...p, stay_in_domain: e.target.checked })); setDirty(prev => ({ ...prev, web: true })); }} className="w-4 h-4 rounded border-[var(--border-default)] text-apple-purple accent-apple-purple" />
                              <span className="text-sm text-[var(--text-secondary)]">{t('crawler.setting.stayInDomain')}</span>
                            </label>
                            <InlineHint>When crawling deep links, only follow links within the same domain.</InlineHint>
                          </div>
                          <div className="flex flex-col gap-3">
                            <div>
                              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t('crawler.setting.maxDepth')}</label>
                              <input type="number" min={0} value={webSettings.max_depth} onChange={(e) => { setWebSettings(p => ({ ...p, max_depth: parseInt(e.target.value, 10) || 0 })); setDirty(prev => ({ ...prev, web: true })); }} className="apple-input w-full py-1.5 text-sm" />
                              <InlineHint>Max link depth to follow from the seed URL. 0 = no deep crawling.</InlineHint>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t('crawler.setting.maxPagesPerSource')}</label>
                              <input type="number" min={1} value={webSettings.max_pages_per_source} onChange={(e) => { setWebSettings(p => ({ ...p, max_pages_per_source: parseInt(e.target.value, 10) || 10 })); setDirty(prev => ({ ...prev, web: true })); }} className="apple-input w-full py-1.5 text-sm" />
                              <InlineHint>Max pages to save per source URL during deep crawling.</InlineHint>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Add URL */}
            <div className="apple-card p-5 space-y-3">
              <h3 className="text-sm font-semibold text-[var(--text-secondary)] flex items-center gap-2">
                <Plus className="w-4 h-4" />
                {t('crawler.addUrl')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input type="url" value={newWebUrl} onChange={(e) => setNewWebUrl(e.target.value)} placeholder={t('crawler.urlPlaceholder')}
                  className="sm:col-span-2 apple-input py-2 text-sm" onKeyDown={(e) => { if (e.key === 'Enter') {
                    if (newWebUrl.trim()) { setWebUrls(p => [...p, { url: newWebUrl.trim(), name: newWebName.trim(), tags: newWebTags.split(',').map(s => s.trim()).filter(Boolean) }]); setNewWebUrl(''); setNewWebName(''); setNewWebTags(''); setDirty(prev => ({ ...prev, web: true })); }
                  } }} />
                <div className="flex gap-2">
                  <input type="text" value={newWebName} onChange={(e) => setNewWebName(e.target.value)} placeholder={t('crawler.namePlaceholder')} className="flex-1 apple-input py-2 text-sm" />
                  <button onClick={() => { if (newWebUrl.trim()) { setWebUrls(p => [...p, { url: newWebUrl.trim(), name: newWebName.trim(), tags: newWebTags.split(',').map(s => s.trim()).filter(Boolean) }]); setNewWebUrl(''); setNewWebName(''); setNewWebTags(''); setDirty(prev => ({ ...prev, web: true })); } }}
                    disabled={!newWebUrl.trim() || isBusy} className="apple-button p-2 disabled:opacity-50" aria-label={t('crawler.addUrl')}>
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <input type="text" value={newWebTags} onChange={(e) => setNewWebTags(e.target.value)} placeholder={t('crawler.tagsPlaceholder')} className="w-full apple-input py-2 text-sm" />
              <InlineHint>Tags help categorize fetched content. Use comma-separated values like ai, paper, blog.</InlineHint>
            </div>

            {/* URL List */}
            <div className="apple-card overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--border-default)] flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--text-secondary)]">{t('crawler.urlList')} ({webUrls.length})</h3>
              </div>
              {webUrls.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-[var(--text-tertiary)]">
                  <Globe className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-sm">{t('crawler.empty')}</p>
                  <p className="text-xs mt-1">Add URLs above or load the example preset to get started.</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-subtle)]">
                  {webUrls.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3 px-5 py-3 group hover:bg-[var(--bg-secondary)] transition-colors">
                      <Globe className="w-4 h-4 text-apple-blue mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        {item.name && <p className="text-sm font-medium text-[var(--text-primary)] truncate">{item.name}</p>}
                        <p className="text-xs text-[var(--text-secondary)] truncate">{item.url}</p>
                        {item.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.tags.map(tag => <span key={tag} className="px-1.5 py-0.5 text-[10px] rounded-full bg-apple-blue/10 text-apple-blue">{tag}</span>)}
                          </div>
                        )}
                      </div>
                      <button onClick={() => { setWebUrls(p => p.filter((_, i) => i !== idx)); setDirty(prev => ({ ...prev, web: true })); }}
                        disabled={isBusy} className="p-1.5 rounded-xl text-[var(--text-tertiary)] hover:text-apple-red hover:bg-apple-red/10 opacity-0 group-hover:opacity-100 transition-all" aria-label={t('common.delete')}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'rss' && (
          <motion.div key="rss" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
            <HelpCard title="How RSS Fetching Works">
              <p>Subscribe to RSS or Atom feeds to automatically pull new articles. The system fetches each feed, extracts article content via trafilatura or LLM, and saves entries as Markdown.</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li><strong>Feed Name</strong> — A label to identify this source (e.g., "Hacker News - AI")</li>
                <li><strong>Feed URL</strong> — The RSS/Atom endpoint (usually ends in <code className="font-mono">.rss</code>, <code className="font-mono">.xml</code>, or <code className="font-mono">/feed</code>)</li>
              </ul>
              <div className="pt-1">
                <PresetButton label="Load example feeds" onClick={() => {
                  setRssFeeds([
                    { name: 'Hacker News - AI', url: 'https://hnrss.org/newest?q=artificial+intelligence' },
                    { name: 'OpenAI Blog', url: 'https://openai.com/blog/rss.xml' },
                  ]);
                  setDirty(prev => ({ ...prev, rss: true }));
                }} />
              </div>
            </HelpCard>

            <div className="flex flex-wrap items-center gap-3">
              <button onClick={() => runForTab('rss')} disabled={isBusy || rssFeeds.length === 0} className="apple-button text-sm gap-2 disabled:opacity-50">
                {running.rss ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
                {running.rss ? t('crawler.running') : 'Fetch RSS'}
              </button>
            </div>
            <div className="apple-card p-5 space-y-3">
              <h3 className="text-sm font-semibold text-[var(--text-secondary)] flex items-center gap-2"><Plus className="w-4 h-4" /> Add Feed</h3>
              <div className="flex gap-3">
                <input type="text" value={newRssName} onChange={(e) => setNewRssName(e.target.value)} placeholder="Feed name (e.g., Hacker News)" className="flex-1 apple-input py-2 text-sm" />
                <input type="url" value={newRssUrl} onChange={(e) => setNewRssUrl(e.target.value)} placeholder="RSS URL (e.g., https://site.com/feed.xml)" className="flex-[2] apple-input py-2 text-sm"
                  onKeyDown={(e) => { if (e.key === 'Enter' && newRssName.trim() && newRssUrl.trim()) { setRssFeeds(p => [...p, { name: newRssName.trim(), url: newRssUrl.trim() }]); setNewRssName(''); setNewRssUrl(''); setDirty(prev => ({ ...prev, rss: true })); } }} />
                <button onClick={() => { if (newRssName.trim() && newRssUrl.trim()) { setRssFeeds(p => [...p, { name: newRssName.trim(), url: newRssUrl.trim() }]); setNewRssName(''); setNewRssUrl(''); setDirty(prev => ({ ...prev, rss: true })); } }}
                  disabled={!newRssName.trim() || !newRssUrl.trim() || isBusy} className="apple-button p-2 disabled:opacity-50"><Plus className="w-4 h-4" /></button>
              </div>
              <InlineHint>Most blogs and news sites offer RSS feeds. Look for the RSS icon or append /rss, /feed, or .xml to the domain.</InlineHint>
            </div>
            <div className="apple-card overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--border-default)]"><h3 className="text-sm font-semibold text-[var(--text-secondary)]">Feeds ({rssFeeds.length})</h3></div>
              {rssFeeds.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-[var(--text-tertiary)]"><Rss className="w-8 h-8 mb-2 opacity-40" /><p className="text-sm">No RSS feeds configured</p><p className="text-xs mt-1">Add feeds above or load the example preset.</p></div>
              ) : (
                <div className="divide-y divide-[var(--border-subtle)]">
                  {rssFeeds.map((f, idx) => (
                    <div key={idx} className="flex items-center gap-3 px-5 py-3 group hover:bg-[var(--bg-secondary)] transition-colors">
                      <Rss className="w-4 h-4 text-apple-orange flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">{f.name}</p>
                        <p className="text-xs text-[var(--text-secondary)] truncate">{f.url}</p>
                      </div>
                      <button onClick={() => { setRssFeeds(p => p.filter((_, i) => i !== idx)); setDirty(prev => ({ ...prev, rss: true })); }}
                        disabled={isBusy} className="p-1.5 rounded-xl text-[var(--text-tertiary)] hover:text-apple-red hover:bg-apple-red/10 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'github' && (
          <motion.div key="github" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
            <HelpCard title="How GitHub Monitoring Works">
              <p>Track GitHub repositories for releases and project updates, or discover trending repos by language. Data is saved as Markdown for ingestion into your wiki.</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li><strong>Repo</strong> — Format: <code className="font-mono">owner/repo</code> (e.g., <code className="font-mono">microsoft/markitdown</code>)</li>
                <li><strong>kinds</strong> — <code className="font-mono">info</code> (project details + README), <code className="font-mono">releases</code> (version notes)</li>
                <li><strong>Trending</strong> — Finds recently active repos by programming language (no specific repo needed)</li>
              </ul>
              <div className="pt-1">
                <PresetButton label="Load example repos" onClick={() => {
                  setGhRepos([
                    { repo: 'microsoft/markitdown', kinds: ['info', 'releases'] },
                    { repo: 'langchain-ai/langchain', kinds: ['info'] },
                  ]);
                  setGhTrending(p => ({ ...p, enabled: true, languages: ['python', 'typescript'] }));
                  setDirty(prev => ({ ...prev, github: true }));
                }} />
              </div>
            </HelpCard>

            <div className="flex flex-wrap items-center gap-3">
              <button onClick={() => runForTab('github')} disabled={isBusy || ghRepos.length === 0} className="apple-button text-sm gap-2 disabled:opacity-50">
                {running.github ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitBranch className="w-4 h-4" />}
                {running.github ? t('crawler.running') : 'Fetch GitHub'}
              </button>
            </div>
            <div className="apple-card p-5 space-y-3">
              <h3 className="text-sm font-semibold text-[var(--text-secondary)] flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Trending Repos</h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={ghTrending.enabled} onChange={(e) => { setGhTrending(p => ({ ...p, enabled: e.target.checked })); setDirty(prev => ({ ...prev, github: true })); }}
                  className="w-4 h-4 rounded border-[var(--border-default)] text-apple-blue accent-apple-blue" />
                <span className="text-sm text-[var(--text-secondary)]">Enable trending repos discovery</span>
              </label>
              <InlineHint>When enabled, the crawler also fetches recently active popular repositories by language.</InlineHint>
              {ghTrending.enabled && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Languages</label>
                    <input type="text" value={ghTrending.languages.join(', ')} onChange={(e) => { setGhTrending(p => ({ ...p, languages: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })); setDirty(prev => ({ ...prev, github: true })); }}
                      placeholder="python, typescript, go" className="apple-input py-2 text-sm" />
                    <InlineHint>Comma-separated. Use "all" for any language.</InlineHint>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Since Days</label>
                    <input type="number" value={ghTrending.since_days} onChange={(e) => { setGhTrending(p => ({ ...p, since_days: parseInt(e.target.value, 10) || 7 })); setDirty(prev => ({ ...prev, github: true })); }}
                      placeholder="7" className="apple-input py-2 text-sm" />
                    <InlineHint>How many days back to look for activity.</InlineHint>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Per Language</label>
                    <input type="number" value={ghTrending.per_language} onChange={(e) => { setGhTrending(p => ({ ...p, per_language: parseInt(e.target.value, 10) || 5 })); setDirty(prev => ({ ...prev, github: true })); }}
                      placeholder="5" className="apple-input py-2 text-sm" />
                    <InlineHint>Maximum trending repos to fetch per language.</InlineHint>
                  </div>
                </div>
              )}
            </div>
            <div className="apple-card p-5 space-y-3">
              <h3 className="text-sm font-semibold text-[var(--text-secondary)] flex items-center gap-2"><Plus className="w-4 h-4" /> Add Repository</h3>
              <div className="flex gap-3">
                <input type="text" value={newGhRepo} onChange={(e) => setNewGhRepo(e.target.value)} placeholder="owner/repo (e.g., microsoft/markitdown)" className="flex-1 apple-input py-2 text-sm"
                  onKeyDown={(e) => { if (e.key === 'Enter' && newGhRepo.trim()) { setGhRepos(p => [...p, { repo: newGhRepo.trim(), kinds: ['info', 'releases'] }]); setNewGhRepo(''); setDirty(prev => ({ ...prev, github: true })); } }} />
                <button onClick={() => { if (newGhRepo.trim()) { setGhRepos(p => [...p, { repo: newGhRepo.trim(), kinds: ['info', 'releases'] }]); setNewGhRepo(''); setDirty(prev => ({ ...prev, github: true })); } }}
                  disabled={!newGhRepo.trim() || isBusy} className="apple-button p-2 disabled:opacity-50"><Plus className="w-4 h-4" /></button>
              </div>
              <InlineHint>Enter a repository in owner/repo format. Both public and your own private repos (with token) are supported.</InlineHint>
            </div>
            <div className="apple-card overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--border-default)]"><h3 className="text-sm font-semibold text-[var(--text-secondary)]">Repositories ({ghRepos.length})</h3></div>
              {ghRepos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-[var(--text-tertiary)]"><GitBranch className="w-8 h-8 mb-2 opacity-40" /><p className="text-sm">No repositories configured</p><p className="text-xs mt-1">Add repos above or load the example preset.</p></div>
              ) : (
                <div className="divide-y divide-[var(--border-subtle)]">
                  {ghRepos.map((r, idx) => (
                    <div key={idx} className="flex items-center gap-3 px-5 py-3 group hover:bg-[var(--bg-secondary)] transition-colors">
                      <GitBranch className="w-4 h-4 text-apple-purple flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">{r.repo}</p>
                        <p className="text-xs text-[var(--text-secondary)]">Tracking: {r.kinds.join(', ')}</p>
                      </div>
                      <button onClick={() => { setGhRepos(p => p.filter((_, i) => i !== idx)); setDirty(prev => ({ ...prev, github: true })); }}
                        disabled={isBusy} className="p-1.5 rounded-xl text-[var(--text-tertiary)] hover:text-apple-red hover:bg-apple-red/10 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'arxiv' && (
          <motion.div key="arxiv" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
            <HelpCard title="How arXiv Fetching Works">
              <p>Search arXiv by category or keywords to pull paper abstracts and metadata. Perfect for tracking research in specific fields.</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li><strong>Label</strong> — A friendly name for this search (e.g., "LLMs & Agents")</li>
                <li><strong>Query</strong> — arXiv search syntax. Examples:</li>
              </ul>
              <div className="bg-[var(--bg-tertiary)] rounded-lg p-2 space-y-1 font-mono text-[11px]">
                <p><code>cat:cs.AI OR cat:cs.CL</code> — All AI or Computation and Language papers</p>
                <p><code>all:knowledge graph AND cat:cs.AI</code> — Knowledge graph papers in AI</p>
                <p><code>au:Hinton_G</code> — Papers by a specific author</p>
              </div>
              <div className="pt-1">
                <PresetButton label="Load example queries" onClick={() => {
                  setArxivQueries([
                    { label: 'LLMs & Agents', query: 'cat:cs.AI OR cat:cs.CL OR cat:cs.LG' },
                    { label: 'Knowledge Graphs', query: 'all:knowledge graph AND (cat:cs.AI OR cat:cs.DB)' },
                  ]);
                  setDirty(prev => ({ ...prev, arxiv: true }));
                }} />
              </div>
            </HelpCard>

            <div className="flex flex-wrap items-center gap-3">
              <button onClick={() => runForTab('arxiv')} disabled={isBusy || arxivQueries.length === 0} className="apple-button text-sm gap-2 disabled:opacity-50">
                {running.arxiv ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
                {running.arxiv ? t('crawler.running') : 'Fetch arXiv'}
              </button>
            </div>
            <div className="apple-card p-5 space-y-3">
              <h3 className="text-sm font-semibold text-[var(--text-secondary)] flex items-center gap-2"><Plus className="w-4 h-4" /> Add Query</h3>
              <div className="flex gap-3">
                <input type="text" value={newArxivLabel} onChange={(e) => setNewArxivLabel(e.target.value)} placeholder="Label (e.g., RAG Systems)" className="flex-1 apple-input py-2 text-sm" />
                <input type="text" value={newArxivQuery} onChange={(e) => setNewArxivQuery(e.target.value)} placeholder="arXiv query (e.g., all:retrieval augmented generation)" className="flex-[2] apple-input py-2 text-sm"
                  onKeyDown={(e) => { if (e.key === 'Enter' && newArxivLabel.trim() && newArxivQuery.trim()) { setArxivQueries(p => [...p, { label: newArxivLabel.trim(), query: newArxivQuery.trim() }]); setNewArxivLabel(''); setNewArxivQuery(''); setDirty(prev => ({ ...prev, arxiv: true })); } }} />
                <button onClick={() => { if (newArxivLabel.trim() && newArxivQuery.trim()) { setArxivQueries(p => [...p, { label: newArxivLabel.trim(), query: newArxivQuery.trim() }]); setNewArxivLabel(''); setNewArxivQuery(''); setDirty(prev => ({ ...prev, arxiv: true })); } }}
                  disabled={!newArxivLabel.trim() || !newArxivQuery.trim() || isBusy} className="apple-button p-2 disabled:opacity-50"><Plus className="w-4 h-4" /></button>
              </div>
              <InlineHint>Use arXiv search syntax: cat:cs.AI for category, all:term for full-text, au:Name for author. Combine with AND/OR.</InlineHint>
            </div>
            <div className="apple-card overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--border-default)]"><h3 className="text-sm font-semibold text-[var(--text-secondary)]">Queries ({arxivQueries.length})</h3></div>
              {arxivQueries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-[var(--text-tertiary)]"><BookOpen className="w-8 h-8 mb-2 opacity-40" /><p className="text-sm">No arXiv queries configured</p><p className="text-xs mt-1">Add queries above or load the example preset.</p></div>
              ) : (
                <div className="divide-y divide-[var(--border-subtle)]">
                  {arxivQueries.map((q, idx) => (
                    <div key={idx} className="flex items-center gap-3 px-5 py-3 group hover:bg-[var(--bg-secondary)] transition-colors">
                      <BookOpen className="w-4 h-4 text-apple-green flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">{q.label}</p>
                        <p className="text-xs text-[var(--text-secondary)] truncate font-mono">{q.query}</p>
                      </div>
                      <button onClick={() => { setArxivQueries(p => p.filter((_, i) => i !== idx)); setDirty(prev => ({ ...prev, arxiv: true })); }}
                        disabled={isBusy} className="p-1.5 rounded-xl text-[var(--text-tertiary)] hover:text-apple-red hover:bg-apple-red/10 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'quick' && (
          <motion.div key="quick" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
            <HelpCard title="Quick Fetch — Instant Article Grab">
              <p>Fetch a single article instantly without saving it to any config file. Perfect for one-off reads or testing extraction quality on a new source.</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Pastes the article into <code className="font-mono">raw-inbox/</code> immediately</li>
                <li>Does not require prior configuration</li>
                <li>Quality score is reported so you can evaluate the source</li>
              </ul>
            </HelpCard>

            <div className="apple-card p-6 space-y-4">
              <h3 className="text-sm font-semibold text-[var(--text-secondary)] flex items-center gap-2">
                <Zap className="w-4 h-4 text-apple-teal" />
                Quick URL Fetch
              </h3>
              <div className="space-y-3">
                <input type="url" value={quickUrl} onChange={(e) => setQuickUrl(e.target.value)} placeholder="https://example.com/article" className="w-full apple-input py-2 text-sm" />
                <InlineHint>Enter any article URL. The crawler extracts the main content and saves it as Markdown.</InlineHint>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input type="text" value={quickName} onChange={(e) => setQuickName(e.target.value)} placeholder="Display name (optional)" className="apple-input py-2 text-sm" />
                  <input type="text" value={quickTags} onChange={(e) => setQuickTags(e.target.value)} placeholder="Tags, comma separated" className="apple-input py-2 text-sm" />
                </div>
                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={quickUseLlm} onChange={(e) => setQuickUseLlm(e.target.checked)}
                      className="w-4 h-4 rounded border-[var(--border-default)] text-apple-purple accent-apple-purple" />
                    <span className="text-sm text-[var(--text-secondary)]">{t('crawler.setting.useLLM')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={quickUseBrowser} onChange={(e) => setQuickUseBrowser(e.target.checked)}
                      className="w-4 h-4 rounded border-[var(--border-default)] text-apple-purple accent-apple-purple" />
                    <span className="text-sm text-[var(--text-secondary)]">{t('crawler.setting.useBrowser')}</span>
                  </label>
                </div>
                <button onClick={handleQuickFetch} disabled={isBusy || !quickUrl.trim()} className="apple-button text-sm gap-2 disabled:opacity-50">
                  {running.quick ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  {running.quick ? 'Fetching...' : 'Fetch Article'}
                </button>
              </div>
              {quickResult && (
                <div className={`p-4 rounded-xl border ${quickResult.success ? 'border-apple-green/30 bg-apple-green/5' : 'border-apple-red/30 bg-apple-red/5'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {quickResult.success ? <CheckCircle className="w-4 h-4 text-apple-green" /> : <AlertCircle className="w-4 h-4 text-apple-red" />}
                    <span className="text-sm font-medium">{quickResult.success ? t('crawler.quickFetchSuccess') : t('crawler.quickFetchFailed')}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    {quickResult.saved_file && (
                      <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                        <FileText className="w-3 h-3" />
                        <span className="truncate">{quickResult.saved_file}</span>
                      </div>
                    )}
                    {quickResult.quality && (
                      <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                        <TrendingUp className="w-3 h-3" />
                        {t('crawler.result.quality')}: {quickResult.quality}
                      </div>
                    )}
                    {quickResult.engine && (
                      <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                        <Layers className="w-3 h-3" />
                        {t('crawler.result.engine')}: {quickResult.engine}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Output Terminal */}
      <AnimatePresence>
        {showOutput && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="apple-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-default)]">
              <h3 className="text-sm font-semibold text-[var(--text-secondary)] flex items-center gap-2">
                <Terminal className="w-4 h-4" />
                {t('crawler.output')}
              </h3>
              <button onClick={() => setShowOutput(false)} className="p-1 rounded-xl hover:bg-[var(--bg-secondary)]">
                <X className="w-4 h-4 text-[var(--text-tertiary)]" />
              </button>
            </div>
            <div ref={terminalRef} className="p-4 max-h-80 overflow-y-auto bg-gray-950 text-green-400 font-mono text-xs leading-relaxed">
              {(crawlResult[activeTab]?.stdout || batchResult?.steps.map(s => `=== ${s.name} ===\n${s.stdout}`).join('\n\n') || (isBusy ? t('crawler.waiting') : ''))
                .split('\n').map((line, i) => (
                  <div key={i} className={
                    line.includes('[OK]') ? 'text-green-400' :
                    line.includes('[SKIP]') ? 'text-yellow-400' :
                    line.includes('[ERROR]') || line.includes('[FAIL]') ? 'text-red-400' :
                    line.includes('[INFO]') || line.includes('[CHECK]') ? 'text-blue-400' :
                    'text-gray-400'
                  }>
                    {line || '\u00A0'}
                  </div>
                ))}
              {isBusy && (
                <div className="flex items-center gap-2 text-yellow-400 mt-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {t('crawler.running')}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
