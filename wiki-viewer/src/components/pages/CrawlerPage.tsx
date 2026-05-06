import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe, Plus, Trash2, Play, Zap, Save, Terminal, X, CheckCircle,
  AlertCircle, Loader2, RefreshCw, ChevronDown, ChevronRight,
} from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import {
  fetchWebSourcesConfig, saveWebSourcesConfig,
  runCrawler, runBatchPipeline,
  type CrawlerRunResult, type BatchResult,
} from '@/services/dataService';

interface CrawlUrl {
  url: string;
  name: string;
  tags: string[];
}

interface CrawlSettings {
  timeout: number;
  user_agent: string;
  respect_robots_txt: boolean;
  fallback_to_markitdown: boolean;
  request_delay: number;
  max_retries: number;
  content_min_length: number;
}

function parseYaml(raw: string): { urls: CrawlUrl[]; settings: CrawlSettings } {
  const urls: CrawlUrl[] = [];
  const settings: CrawlSettings = {
    timeout: 30, user_agent: 'llm-wiki-agent/1.0',
    respect_robots_txt: true, fallback_to_markitdown: true,
    request_delay: 1, max_retries: 3, content_min_length: 200,
  };

  const urlBlocks = raw.split(/^- url:/m).slice(1);
  for (const block of urlBlocks) {
    const lines = block.split('\n');
    const url = (lines[0] ?? '').trim().replace(/^["']|["']$/g, '');
    let name = '';
    let tags: string[] = [];
    for (const line of lines.slice(1)) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- url:') || trimmed === '') break;
      if (trimmed.startsWith('name:')) name = trimmed.slice(5).trim().replace(/^["']|["']$/g, '');
      if (trimmed.startsWith('tags:')) {
        const tagStr = trimmed.slice(5).trim();
        tags = tagStr.replace(/[[\]]/g, '').split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      }
    }
    if (url) urls.push({ url, name, tags });
  }

  const settingsMatch = raw.match(/^settings:\s*\n([\s\S]*?)(?=\n\S|\n*$)/m);
  if (settingsMatch?.[1]) {
    for (const line of settingsMatch[1].split('\n')) {
      const m = line.match(/^\s+(\w+):\s*(.+)/);
      if (m?.[1] && m[2]) {
        const key = m[1] as keyof CrawlSettings;
        const val = m[2].trim().replace(/^["']|["']$/g, '');
        if (key === 'timeout' || key === 'request_delay' || key === 'max_retries' || key === 'content_min_length') {
          (settings as Record<string, unknown>)[key] = parseInt(val, 10) || settings[key];
        } else if (key === 'respect_robots_txt' || key === 'fallback_to_markitdown') {
          (settings as Record<string, unknown>)[key] = val === 'true';
        } else if (key === 'user_agent') {
          settings.user_agent = val;
        }
      }
    }
  }

  return { urls, settings };
}

function buildYaml(urls: CrawlUrl[], settings: CrawlSettings): string {
  let yaml = 'urls:\n';
  for (const item of urls) {
    yaml += `  - url: "${item.url}"\n`;
    if (item.name) yaml += `    name: "${item.name}"\n`;
    if (item.tags.length) yaml += `    tags: [${item.tags.join(', ')}]\n`;
  }
  yaml += '\nsettings:\n';
  yaml += `  timeout: ${settings.timeout}\n`;
  yaml += `  user_agent: "${settings.user_agent}"\n`;
  yaml += `  respect_robots_txt: ${settings.respect_robots_txt}\n`;
  yaml += `  fallback_to_markitdown: ${settings.fallback_to_markitdown}\n`;
  yaml += `  request_delay: ${settings.request_delay}\n`;
  yaml += `  max_retries: ${settings.max_retries}\n`;
  yaml += `  content_min_length: ${settings.content_min_length}\n`;
  return yaml;
}

export function CrawlerPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('crawler.title'));

  const [urls, setUrls] = useState<CrawlUrl[]>([]);
  const [settings, setSettings] = useState<CrawlSettings>({
    timeout: 30, user_agent: 'llm-wiki-agent/1.0',
    respect_robots_txt: true, fallback_to_markitdown: true,
    request_delay: 1, max_retries: 3, content_min_length: 200,
  });
  const [newUrl, setNewUrl] = useState('');
  const [newName, setNewName] = useState('');
  const [newTags, setNewTags] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [runningPipeline, setRunningPipeline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [crawlResult, setCrawlResult] = useState<CrawlerRunResult | null>(null);
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const [dirty, setDirty] = useState(false);

  const terminalRef = useBodyScrollLock<HTMLDivElement>(showOutput);

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const cfg = await fetchWebSourcesConfig();
      const parsed = parseYaml(cfg.content);
      setUrls(parsed.urls);
      setSettings(parsed.settings);
      setDirty(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load config');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const yaml = buildYaml(urls, settings);
      await saveWebSourcesConfig(yaml);
      setDirty(false);
      setSuccess(t('crawler.saved'));
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleAddUrl = () => {
    const url = newUrl.trim();
    if (!url) return;
    setUrls(prev => [...prev, {
      url,
      name: newName.trim(),
      tags: newTags.split(',').map(s => s.trim()).filter(Boolean),
    }]);
    setNewUrl('');
    setNewName('');
    setNewTags('');
    setDirty(true);
  };

  const handleRemoveUrl = (idx: number) => {
    setUrls(prev => prev.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const handleCrawl = async () => {
    try {
      setRunning(true);
      setError(null);
      setCrawlResult(null);
      setShowOutput(true);
      const result = await runCrawler();
      setCrawlResult(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Crawl failed');
    } finally {
      setRunning(false);
    }
  };

  const handleBatch = async () => {
    try {
      setRunningPipeline(true);
      setError(null);
      setBatchResult(null);
      setShowOutput(true);
      const result = await runBatchPipeline();
      setBatchResult(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Pipeline failed');
    } finally {
      setRunningPipeline(false);
    }
  };

  const isBusy = running || runningPipeline || saving;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Globe className="w-6 h-6 text-apple-blue" />
            {t('crawler.title')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('crawler.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <span className="text-xs text-apple-orange bg-apple-orange/10 px-2 py-1 rounded-full">
              {t('crawler.unsaved')}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={isBusy || !dirty}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-apple-green/10 text-apple-green hover:bg-apple-green/20 disabled:opacity-50 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? t('crawler.saving') : t('crawler.save')}
          </button>
        </div>
      </div>

      {/* Error / Success */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 p-3 rounded-lg bg-apple-red/10 text-apple-red text-sm"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="p-1 hover:bg-apple-red/20 rounded">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 p-3 rounded-lg bg-apple-green/10 text-apple-green text-sm"
          >
            <CheckCircle className="w-4 h-4" />
            {success}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Run Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleCrawl}
          disabled={isBusy || urls.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-apple-blue text-white hover:bg-apple-blue/90 disabled:opacity-50 transition-colors text-sm font-medium"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {running ? t('crawler.running') : t('crawler.crawlAll')}
        </button>
        <button
          onClick={handleBatch}
          disabled={isBusy || urls.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-apple-purple text-white hover:bg-apple-purple/90 disabled:opacity-50 transition-colors text-sm font-medium"
        >
          {runningPipeline ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {runningPipeline ? t('crawler.runningPipeline') : t('crawler.runPipeline')}
        </button>
        <button
          onClick={loadConfig}
          disabled={isBusy}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {t('crawler.reload')}
        </button>
      </div>

      {/* Stats from last run */}
      {crawlResult && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: t('crawler.stats.saved'), value: crawlResult.stats.saved, color: 'text-apple-green', bg: 'bg-apple-green/10' },
            { label: t('crawler.stats.skipped'), value: crawlResult.stats.skipped, color: 'text-apple-orange', bg: 'bg-apple-orange/10' },
            { label: t('crawler.stats.errors'), value: crawlResult.stats.errors, color: 'text-apple-red', bg: 'bg-apple-red/10' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`rounded-xl ${bg} p-4 text-center`}>
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Batch pipeline result */}
      {batchResult && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('crawler.pipelineSteps')}</h3>
          {batchResult.steps.map((step) => (
            <div
              key={step.name}
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                step.success
                  ? 'border-apple-green/30 bg-apple-green/5'
                  : 'border-apple-red/30 bg-apple-red/5'
              }`}
            >
              {step.success
                ? <CheckCircle className="w-4 h-4 text-apple-green flex-shrink-0" />
                : <AlertCircle className="w-4 h-4 text-apple-red flex-shrink-0" />}
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{step.name}</span>
              <span className="text-xs text-gray-500 ml-auto">exit {step.returncode}</span>
            </div>
          ))}
          {batchResult.stopped_at && (
            <p className="text-xs text-apple-red">{t('crawler.stoppedAt')}: {batchResult.stopped_at}</p>
          )}
        </div>
      )}

      {/* Settings (collapsible) */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="w-full flex items-center gap-2 px-5 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        >
          {showSettings ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          {t('crawler.settings')}
        </button>
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { key: 'timeout', label: t('crawler.setting.timeout'), type: 'number' },
                  { key: 'request_delay', label: t('crawler.setting.delay'), type: 'number' },
                  { key: 'max_retries', label: t('crawler.setting.retries'), type: 'number' },
                  { key: 'content_min_length', label: t('crawler.setting.minLen'), type: 'number' },
                  { key: 'user_agent', label: t('crawler.setting.userAgent'), type: 'text' },
                ].map(({ key, label, type }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</label>
                    <input
                      type={type}
                      value={(settings as Record<string, unknown>)[key] as string | number}
                      onChange={(e) => {
                        const val = type === 'number' ? parseInt(e.target.value, 10) || 0 : e.target.value;
                        setSettings(prev => ({ ...prev, [key]: val }));
                        setDirty(true);
                      }}
                      className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-apple-blue/50 focus:border-transparent"
                    />
                  </div>
                ))}
                {[
                  { key: 'respect_robots_txt', label: t('crawler.setting.robots') },
                  { key: 'fallback_to_markitdown', label: t('crawler.setting.fallback') },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(settings as Record<string, unknown>)[key] as boolean}
                      onChange={(e) => {
                        setSettings(prev => ({ ...prev, [key]: e.target.checked }));
                        setDirty(true);
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-apple-blue focus:ring-apple-blue/50"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                  </label>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Add URL */}
      <div className="glass-card rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          {t('crawler.addUrl')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="url"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder={t('crawler.urlPlaceholder')}
            className="sm:col-span-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-apple-blue/50 focus:border-transparent"
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddUrl(); }}
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('crawler.namePlaceholder')}
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-apple-blue/50 focus:border-transparent"
            />
            <button
              onClick={handleAddUrl}
              disabled={!newUrl.trim() || isBusy}
              className="px-3 py-2 rounded-lg bg-apple-blue text-white hover:bg-apple-blue/90 disabled:opacity-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
        <input
          type="text"
          value={newTags}
          onChange={(e) => setNewTags(e.target.value)}
          placeholder={t('crawler.tagsPlaceholder')}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-apple-blue/50 focus:border-transparent"
        />
      </div>

      {/* URL List */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200/50 dark:border-gray-700/50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {t('crawler.urlList')} ({urls.length})
          </h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            {t('crawler.loading')}
          </div>
        ) : urls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Globe className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">{t('crawler.empty')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {urls.map((item, idx) => (
              <div key={idx} className="flex items-start gap-3 px-5 py-3 group hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                <Globe className="w-4 h-4 text-apple-blue mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  {item.name && (
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{item.name}</p>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.url}</p>
                  {item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.tags.map((tag) => (
                        <span key={tag} className="px-1.5 py-0.5 text-[10px] rounded-full bg-apple-blue/10 text-apple-blue">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleRemoveUrl(idx)}
                  disabled={isBusy}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-apple-red hover:bg-apple-red/10 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Output Terminal */}
      <AnimatePresence>
        {showOutput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card rounded-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200/50 dark:border-gray-700/50">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Terminal className="w-4 h-4" />
                {t('crawler.output')}
              </h3>
              <button
                onClick={() => setShowOutput(false)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div ref={terminalRef} className="p-4 max-h-80 overflow-y-auto bg-gray-950 text-green-400 font-mono text-xs leading-relaxed">
              {(crawlResult?.stdout || batchResult?.steps.map(s => `=== ${s.name} ===\n${s.stdout}`).join('\n\n') || (isBusy ? t('crawler.waiting') : '')).split('\n').map((line, i) => (
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
