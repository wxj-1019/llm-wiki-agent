import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Settings, Code, Rss, BookOpen, Archive, Save, Download, Check, AlertTriangle, Bot, Key, ExternalLink } from 'lucide-react';
import { useConfigStore } from '@/stores/configStore';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export function SettingsPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('settings.title'));

  const config = useConfigStore((s) => s.config);
  const apiAvailable = useConfigStore((s) => s.apiAvailable);
  const checkApi = useConfigStore((s) => s.checkApi);
  const saveToServer = useConfigStore((s) => s.saveToServer);
  const updateGithub = useConfigStore((s) => s.updateGithub);
  const updateTrending = useConfigStore((s) => s.updateTrending);
  const setRssFeeds = useConfigStore((s) => s.setRssFeeds);
  const setArxivQueries = useConfigStore((s) => s.setArxivQueries);
  const setArchiveTtl = useConfigStore((s) => s.setArchiveTtl);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [activeTab, setActiveTab] = useState<'github' | 'rss' | 'arxiv' | 'archive' | 'llm'>('github');
  const [llmModel, setLlmModel] = useState('claude-3-5-sonnet-latest');
  const [llmModelFast, setLlmModelFast] = useState('claude-3-5-haiku-latest');
  const [llmProvider, setLlmProvider] = useState('anthropic');
  const [llmApiKey, setLlmApiKey] = useState('');
  const [llmKeySet, setLlmKeySet] = useState(false);
  const [llmSaveStatus, setLlmSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    checkApi();
  }, [checkApi]);

  useEffect(() => {
    fetch('/api/llm-config')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setLlmModel(d.model || 'claude-3-5-sonnet-latest');
          setLlmModelFast(d.model_fast || 'claude-3-5-haiku-latest');
          setLlmProvider(d.provider || 'anthropic');
          setLlmKeySet(d.api_key_set || false);
        }
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    if (apiAvailable) {
      const ok = await saveToServer();
      setSaveStatus(ok ? 'success' : 'error');
    } else {
      // Fallback: just localStorage (already persisted)
      setSaveStatus('success');
    }
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const handleDownload = () => {
    const cfg = config;
    const githubYaml = `trending:\n  enabled: ${cfg.github.trending.enabled}\n  languages: [${cfg.github.trending.languages.map((l: string) => `"${l}"`).join(', ')}]\n  since_days: ${cfg.github.trending.since_days}\n  per_language: ${cfg.github.trending.per_language}\n`;
    const blob = new Blob([githubYaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'github_sources.yaml';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveLLM = async () => {
    try {
      const res = await fetch('/api/llm-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: llmModel,
          model_fast: llmModelFast,
          provider: llmProvider,
          api_key: llmApiKey,
        }),
      });
      if (res.ok) {
        setLlmSaveStatus('success');
        setLlmApiKey('');
        setLlmKeySet(true);
      } else {
        setLlmSaveStatus('error');
      }
    } catch {
      setLlmSaveStatus('error');
    }
    setTimeout(() => setLlmSaveStatus('idle'), 2000);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-semibold flex items-center gap-3">
          <Settings size={28} className="text-apple-blue" />
          {t('settings.title')}
        </h1>
        <div className="flex items-center gap-2">
          {apiAvailable === false && (
            <span className="text-xs text-apple-orange flex items-center gap-1">
              <AlertTriangle size={12} />
              {t('settings.apiOffline')}
            </span>
          )}
          <button
            onClick={handleSave}
            className={`apple-button text-sm flex items-center gap-2 ${saveStatus === 'success' ? 'bg-apple-green' : ''}`}
          >
            {saveStatus === 'success' ? <Check size={14} /> : <Save size={14} />}
            {saveStatus === 'success' ? t('settings.saved') : t('settings.save')}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[var(--bg-secondary)] rounded-xl w-fit mb-6">
        {([
          { key: 'github' as const, icon: Code, label: t('settings.tab.github') },
          { key: 'rss' as const, icon: Rss, label: t('settings.tab.rss') },
          { key: 'arxiv' as const, icon: BookOpen, label: t('settings.tab.arxiv') },
          { key: 'archive' as const, icon: Archive, label: t('settings.tab.archive') },
          { key: 'llm' as const, icon: Bot, label: t('settings.tab.llm') || 'LLM' },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* GitHub Panel */}
      {activeTab === 'github' && (
        <div className="space-y-6 max-w-2xl">
          <div className="apple-card p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Code size={16} className="text-apple-blue" />
              {t('settings.github.tokenTitle')}
            </h3>
            <label className="block text-sm text-[var(--text-secondary)] mb-2">{t('settings.github.tokenLabel')}</label>
            <input
              type="password"
              value={config.github.token}
              onChange={(e) => updateGithub({ token: e.target.value })}
              placeholder={t('settings.github.tokenPlaceholder')}
              className="apple-input"
            />
            <p className="text-xs text-[var(--text-tertiary)] mt-2">{t('settings.github.tokenHint')}</p>
          </div>

          <div className="apple-card p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Settings size={16} className="text-apple-purple" />
              {t('settings.github.trendingTitle')}
            </h3>
            <div className="flex items-center gap-3 mb-4">
              <input
                type="checkbox"
                id="trending-enabled"
                checked={config.github.trending.enabled}
                onChange={(e) => updateTrending({ enabled: e.target.checked })}
                className="w-4 h-4 rounded accent-apple-blue"
              />
              <label htmlFor="trending-enabled" className="text-sm">{t('settings.github.trendingEnabled')}</label>
            </div>

            <label className="block text-sm text-[var(--text-secondary)] mb-2">{t('settings.github.languages')}</label>
            <input
              value={config.github.trending.languages.join(', ')}
              onChange={(e) =>
                updateTrending({
                  languages: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                })
              }
              placeholder="python, javascript, rust..."
              className="apple-input mb-4"
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-2">{t('settings.github.sinceDays')}</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={config.github.trending.since_days}
                  onChange={(e) => updateTrending({ since_days: parseInt(e.target.value) || 7 })}
                  className="apple-input"
                />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-2">{t('settings.github.perLanguage')}</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={config.github.trending.per_language}
                  onChange={(e) => updateTrending({ per_language: parseInt(e.target.value) || 5 })}
                  className="apple-input"
                />
              </div>
            </div>
          </div>

          <button onClick={handleDownload} className="flex items-center gap-2 text-sm text-apple-blue hover:underline">
            <Download size={14} />
            {t('settings.downloadConfig')}
          </button>
        </div>
      )}

      {/* RSS Panel */}
      {activeTab === 'rss' && (
        <div className="space-y-4 max-w-2xl">
          {config.rss.feeds.map((feed, idx) => (
            <div key={idx} className="apple-card p-4 flex items-center gap-3">
              <div className="flex-1 space-y-2">
                <input
                  value={feed.name}
                  onChange={(e) => {
                    const next = [...config.rss.feeds];
                    next[idx] = { ...feed, name: e.target.value };
                    setRssFeeds(next);
                  }}
                  placeholder={t('settings.rss.namePlaceholder')}
                  className="apple-input"
                />
                <input
                  value={feed.url}
                  onChange={(e) => {
                    const next = [...config.rss.feeds];
                    next[idx] = { ...feed, url: e.target.value };
                    setRssFeeds(next);
                  }}
                  placeholder="https://example.com/feed.xml"
                  className="apple-input"
                />
              </div>
              <button
                onClick={() => setRssFeeds(config.rss.feeds.filter((_, i) => i !== idx))}
                className="text-apple-red/70 hover:text-apple-red px-2 py-1 text-sm"
              >
                {t('settings.remove')}
              </button>
            </div>
          ))}
          <button
            onClick={() => setRssFeeds([...config.rss.feeds, { name: '', url: '' }])}
            className="apple-button-warm text-sm"
          >
            + {t('settings.rss.addFeed')}
          </button>
        </div>
      )}

      {/* arXiv Panel */}
      {activeTab === 'arxiv' && (
        <div className="space-y-4 max-w-2xl">
          {config.arxiv.queries.map((q, idx) => (
            <div key={idx} className="apple-card p-4 flex items-center gap-3">
              <div className="flex-1 space-y-2">
                <input
                  value={q.label}
                  onChange={(e) => {
                    const next = [...config.arxiv.queries];
                    next[idx] = { ...q, label: e.target.value };
                    setArxivQueries(next);
                  }}
                  placeholder={t('settings.arxiv.labelPlaceholder')}
                  className="apple-input"
                />
                <input
                  value={q.query}
                  onChange={(e) => {
                    const next = [...config.arxiv.queries];
                    next[idx] = { ...q, query: e.target.value };
                    setArxivQueries(next);
                  }}
                  placeholder="cat:cs.AI OR cat:cs.CL"
                  className="apple-input font-mono text-sm"
                />
              </div>
              <button
                onClick={() => setArxivQueries(config.arxiv.queries.filter((_, i) => i !== idx))}
                className="text-apple-red/70 hover:text-apple-red px-2 py-1 text-sm"
              >
                {t('settings.remove')}
              </button>
            </div>
          ))}
          <button
            onClick={() => setArxivQueries([...config.arxiv.queries, { label: '', query: '' }])}
            className="apple-button-warm text-sm"
          >
            + {t('settings.arxiv.addQuery')}
          </button>
        </div>
      )}

      {/* Archive Panel */}
      {activeTab === 'archive' && (
        <div className="max-w-2xl">
          <div className="apple-card p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Archive size={16} className="text-apple-orange" />
              {t('settings.archive.title')}
            </h3>
            <label className="block text-sm text-[var(--text-secondary)] mb-2">
              {t('settings.archive.ttlLabel')}
            </label>
            <input
              type="number"
              min={1}
              max={3650}
              value={config.archive.default_ttl_days}
              onChange={(e) => setArchiveTtl(parseInt(e.target.value) || 90)}
              className="apple-input"
            />
            <p className="text-xs text-[var(--text-tertiary)] mt-2">{t('settings.archive.ttlHint')}</p>
          </div>
        </div>
      )}

      {/* LLM Panel */}
      {activeTab === 'llm' && (
        <div className="max-w-2xl space-y-6">
          <div className="apple-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Bot size={16} className="text-purple-500" />
                {t('settings.llm.title') || 'LLM Provider'}
              </h3>
              <button
                onClick={handleSaveLLM}
                className={`apple-button text-sm flex items-center gap-2 ${llmSaveStatus === 'success' ? 'bg-apple-green' : ''}`}
              >
                {llmSaveStatus === 'success' ? <Check size={14} /> : <Save size={14} />}
                {llmSaveStatus === 'success' ? t('settings.saved') : llmSaveStatus === 'error' ? t('settings.error') || 'Error' : t('settings.save')}
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-2">{t('settings.llm.provider') || 'Provider'}</label>
                <select
                  value={llmProvider}
                  onChange={(e) => {
                    const p = e.target.value;
                    setLlmProvider(p);
                    if (p === 'deepseek') {
                      setLlmModel('deepseek/deepseek-chat');
                      setLlmModelFast('deepseek/deepseek-chat');
                    } else if (p === 'anthropic') {
                      setLlmModel('anthropic/claude-3-5-sonnet-latest');
                      setLlmModelFast('anthropic/claude-3-5-haiku-latest');
                    } else if (p === 'openai') {
                      setLlmModel('openai/gpt-4');
                      setLlmModelFast('openai/gpt-3.5-turbo');
                    }
                  }}
                  className="apple-input"
                >
                  <option value="anthropic">Anthropic (Claude)</option>
                  <option value="openai">OpenAI (GPT)</option>
                  <option value="deepseek">DeepSeek</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-2">{t('settings.llm.model') || 'Model'}</label>
                <input
                  value={llmModel}
                  onChange={(e) => setLlmModel(e.target.value)}
                  placeholder="provider/model-name"
                  className="apple-input"
                />
                <p className="text-xs text-[var(--text-tertiary)] mt-1">
                  e.g. deepseek/deepseek-chat, anthropic/claude-3-5-sonnet-latest
                </p>
              </div>

              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-2">{t('settings.llm.modelFast') || 'Fast Model'}</label>
                <input
                  value={llmModelFast}
                  onChange={(e) => setLlmModelFast(e.target.value)}
                  placeholder="provider/fast-model-name"
                  className="apple-input"
                />
              </div>

              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-2 flex items-center gap-1">
                  <Key size={12} />
                  {t('settings.llm.apiKey') || 'API Key'}
                  {llmKeySet && (
                    <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      {t('settings.llm.keySet') || 'Configured'}
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  value={llmApiKey}
                  onChange={(e) => setLlmApiKey(e.target.value)}
                  placeholder={llmKeySet ? '•••••••• (leave blank to keep existing)' : 'Enter your API key'}
                  className="apple-input"
                />
                <p className="text-xs text-[var(--text-tertiary)] mt-1">
                  {t('settings.llm.keyHint') || 'Stored securely on server. Never sent to frontend after save.'}
                </p>
              </div>

              {llmProvider === 'deepseek' && (
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/30 text-sm text-blue-700 dark:text-blue-400 flex items-start gap-2">
                  <ExternalLink size={14} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">DeepSeek</p>
                    <p className="text-xs mt-0.5">
                      Get your API key from{' '}
                      <a href="https://platform.deepseek.com/" target="_blank" rel="noreferrer" className="underline hover:text-blue-800">
                        platform.deepseek.com
                      </a>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
