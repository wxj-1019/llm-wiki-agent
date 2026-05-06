import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Settings, Code, Rss, BookOpen, Save, Download,
  Check, AlertTriangle, Bot, Key, ExternalLink, Trash2, Plus,
  Sparkles, Flame,
} from 'lucide-react';
import { AppleSelect } from '@/components/ui/AppleSelect';
import { useConfigStore } from '@/stores/configStore';
import { useNotificationStore } from '@/stores/notificationStore';
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

  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [activeTab, setActiveTab] = useState<'llm' | 'github' | 'rss' | 'arxiv'>('llm');
  const [llmModel, setLlmModel] = useState('claude-3-5-sonnet-latest');
  const [llmModelFast, setLlmModelFast] = useState('claude-3-5-haiku-latest');
  const [llmProvider, setLlmProvider] = useState('anthropic');
  const [llmApiKey, setLlmApiKey] = useState('');
  const [llmKeySet, setLlmKeySet] = useState(false);
  const [llmSaveStatus, setLlmSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const addNotification = useNotificationStore((s) => s.addNotification);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const llmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (llmTimerRef.current) clearTimeout(llmTimerRef.current);
    };
  }, [addNotification, t]);

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
      .catch(() => {
        addNotification(t('settings.error', 'Failed to load LLM config'), 'error');
      });
  }, [addNotification, t]);

  const handleSave = async () => {
    if (apiAvailable) {
      const ok = await saveToServer();
      setSaveStatus(ok ? 'success' : 'error');
      addNotification(ok ? t('settings.saved') : t('settings.error'), ok ? 'success' : 'error');
    } else {
      setSaveStatus('success');
      addNotification(t('settings.saved'), 'success');
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
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
        addNotification(t('settings.saved'), 'success');
      } else {
        setLlmSaveStatus('error');
        addNotification(t('settings.error'), 'error');
      }
    } catch {
      setLlmSaveStatus('error');
    }
    if (llmTimerRef.current) clearTimeout(llmTimerRef.current);
    llmTimerRef.current = setTimeout(() => setLlmSaveStatus('idle'), 2000);
  };

  const coreTabs = [
    { key: 'llm' as const, icon: Bot, label: t('settings.tab.llm') },
  ];
  const sourceTabs = [
    { key: 'github' as const, icon: Code, label: t('settings.tab.github') },
    { key: 'rss' as const, icon: Rss, label: t('settings.tab.rss') },
    { key: 'arxiv' as const, icon: BookOpen, label: t('settings.tab.arxiv') },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-semibold flex items-center gap-3">
          <Settings size={28} className="text-apple-blue" />
          {t('settings.title')}
        </h1>
        {apiAvailable === false && (
          <span className="text-xs text-apple-orange flex items-center gap-1">
            <AlertTriangle size={12} />
            {t('settings.apiOffline')}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[var(--bg-secondary)] rounded-xl w-fit mb-6 items-center">
        {coreTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-[var(--bg-primary)] text-apple-purple shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
        <div className="w-px h-5 bg-[var(--border-default)] mx-1" />
        {sourceTabs.map((tab) => (
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
              <Key size={16} className="text-apple-blue" />
              {t('settings.github.tokenTitle')}
            </h3>
            <div className="space-y-3">
              <label htmlFor="github-token" className="block text-sm text-[var(--text-secondary)]">
                {t('settings.github.tokenLabel')}
              </label>
              <input
                id="github-token"
                type="password"
                value={config.github.token}
                onChange={(e) => updateGithub({ token: e.target.value })}
                placeholder={t('settings.github.tokenPlaceholder')}
                className="apple-input"
              />
              <p className="text-xs text-[var(--text-tertiary)]">
                {t('settings.github.tokenHint')}
              </p>
            </div>
          </div>

          <div className="apple-card p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Code size={16} className="text-apple-blue" />
              {t('settings.github.trendingTitle')}
            </h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="trending-enabled"
                  checked={config.github.trending.enabled}
                  onChange={(e) => updateTrending({ enabled: e.target.checked })}
                  className="w-4 h-4 rounded accent-apple-blue"
                />
                <label htmlFor="trending-enabled" className="text-sm">
                  {t('settings.github.trendingEnabled')}
                </label>
              </div>

              <div>
                <label htmlFor="github-languages" className="block text-sm text-[var(--text-secondary)] mb-2">
                  {t('settings.github.languages')}
                </label>
                <input
                  id="github-languages"
                  value={config.github.trending.languages.join(', ')}
                  onChange={(e) =>
                    updateTrending({
                      languages: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  placeholder={t('settings.github.languagesPlaceholder')}
                  className="apple-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="github-since-days" className="block text-sm text-[var(--text-secondary)] mb-2">
                    {t('settings.github.sinceDays')}
                  </label>
                  <input
                    id="github-since-days"
                    type="number"
                    min={1}
                    max={365}
                    value={config.github.trending.since_days}
                    onChange={(e) => updateTrending({ since_days: parseInt(e.target.value) || 7 })}
                    className="apple-input"
                  />
                </div>
                <div>
                  <label htmlFor="github-per-language" className="block text-sm text-[var(--text-secondary)] mb-2">
                    {t('settings.github.perLanguage')}
                  </label>
                  <input
                    id="github-per-language"
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
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={handleDownload}
              className="apple-button-ghost text-sm flex items-center gap-2"
            >
              <Download size={14} />
              {t('settings.downloadConfig')}
            </button>
            <button
              onClick={handleSave}
              className={`apple-button text-sm flex items-center gap-2 ${saveStatus === 'success' ? 'bg-apple-blue' : ''}`}
            >
              {saveStatus === 'success' ? <Check size={14} /> : <Save size={14} />}
              {saveStatus === 'success' ? t('settings.saved') : t('settings.save')}
            </button>
          </div>
        </div>
      )}

      {/* RSS Panel */}
      {activeTab === 'rss' && (
        <div className="space-y-4 max-w-2xl">
          <div className="apple-card p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Rss size={16} className="text-orange-500" />
              {t('settings.tab.rss')}
            </h3>
            <div className="space-y-3">
              {config.rss.feeds.length === 0 && (
                <p className="text-sm text-[var(--text-tertiary)] py-6 text-center">
                  {t('settings.rss.empty')}
                </p>
              )}
              {config.rss.feeds.map((feed, idx) => (
                <div key={idx} className="flex items-start gap-3">
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
                    className="mt-2 p-2 text-red-500/60 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                    title={t('settings.remove')}
                    aria-label={t('settings.remove')}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setRssFeeds([...config.rss.feeds, { name: '', url: '' }])}
              className="mt-4 apple-button-ghost text-sm flex items-center gap-2"
            >
              <Plus size={14} />
              {t('settings.rss.addFeed')}
            </button>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={handleSave}
              className={`apple-button text-sm flex items-center gap-2 ${saveStatus === 'success' ? 'bg-apple-blue' : ''}`}
            >
              {saveStatus === 'success' ? <Check size={14} /> : <Save size={14} />}
              {saveStatus === 'success' ? t('settings.saved') : t('settings.save')}
            </button>
          </div>
        </div>
      )}

      {/* arXiv Panel */}
      {activeTab === 'arxiv' && (
        <div className="space-y-4 max-w-2xl">
          <div className="apple-card p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <BookOpen size={16} className="text-red-500" />
              {t('settings.tab.arxiv')}
            </h3>
            <div className="space-y-3">
              {config.arxiv.queries.length === 0 && (
                <p className="text-sm text-[var(--text-tertiary)] py-6 text-center">
                  {t('settings.arxiv.empty')}
                </p>
              )}
              {config.arxiv.queries.map((q, idx) => (
                <div key={idx} className="flex items-start gap-3">
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
                    className="mt-2 p-2 text-red-500/60 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                    title={t('settings.remove')}
                    aria-label={t('settings.remove')}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setArxivQueries([...config.arxiv.queries, { label: '', query: '' }])}
              className="mt-4 apple-button-ghost text-sm flex items-center gap-2"
            >
              <Plus size={14} />
              {t('settings.arxiv.addQuery')}
            </button>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={handleSave}
              className={`apple-button text-sm flex items-center gap-2 ${saveStatus === 'success' ? 'bg-apple-blue' : ''}`}
            >
              {saveStatus === 'success' ? <Check size={14} /> : <Save size={14} />}
              {saveStatus === 'success' ? t('settings.saved') : t('settings.save')}
            </button>
          </div>
        </div>
      )}

      {/* LLM Panel */}
      {activeTab === 'llm' && (
        <div className="space-y-6 max-w-2xl">
          <div className="apple-card p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Bot size={16} className="text-purple-500" />
              {t('settings.llm.title')}
            </h3>
            <div className="space-y-4">
              <div>
                <AppleSelect
                  id="llm-provider"
                  label={t('settings.llm.provider')}
                  value={llmProvider}
                  onChange={(p) => {
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
                  options={[
                    { value: 'anthropic', label: 'Anthropic (Claude)', icon: <Sparkles size={14} /> },
                    { value: 'openai', label: 'OpenAI (GPT)', icon: <Bot size={14} /> },
                    { value: 'deepseek', label: 'DeepSeek', icon: <Flame size={14} /> },
                  ]}
                />
              </div>

              <div>
                <label htmlFor="llm-model" className="block text-sm text-[var(--text-secondary)] mb-2">
                  {t('settings.llm.model')}
                </label>
                <input
                  id="llm-model"
                  value={llmModel}
                  onChange={(e) => setLlmModel(e.target.value)}
                  placeholder={t('settings.llm.modelPlaceholder')}
                  className="apple-input"
                />
                <p className="text-xs text-[var(--text-tertiary)] mt-1">
                  {t('settings.llm.modelHint')}
                </p>
              </div>

              <div>
                <label htmlFor="llm-model-fast" className="block text-sm text-[var(--text-secondary)] mb-2">
                  {t('settings.llm.modelFast')}
                </label>
                <input
                  id="llm-model-fast"
                  value={llmModelFast}
                  onChange={(e) => setLlmModelFast(e.target.value)}
                  placeholder={t('settings.llm.modelFastPlaceholder')}
                  className="apple-input"
                />
              </div>
            </div>
          </div>

          <div className="apple-card p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Key size={16} className="text-emerald-500" />
              {t('settings.llm.apiKey')}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-2 flex items-center gap-2">
                  <span>{t('settings.llm.apiKey')}</span>
                  {llmKeySet && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 rounded-full">
                      {t('settings.llm.keySet')}
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  value={llmApiKey}
                  onChange={(e) => setLlmApiKey(e.target.value)}
                  placeholder={llmKeySet ? t('settings.llm.keyPlaceholderSet') : t('settings.llm.keyPlaceholder')}
                  className="apple-input"
                />
                <p className="text-xs text-[var(--text-tertiary)] mt-1">
                  {t('settings.llm.keyHint')}
                </p>
              </div>

              {llmProvider === 'deepseek' && (
                <div className="p-3 bg-apple-blue/10 border border-apple-blue/20 rounded-xl text-sm text-apple-blue flex items-start gap-2">
                  <ExternalLink size={14} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">DeepSeek</p>
                    <p className="text-xs mt-0.5">
                      {t('settings.llm.keyHelpPrefix')}{' '}
                      <a href="https://platform.deepseek.com/" target="_blank" rel="noreferrer" className="underline hover:text-blue-800">
                        platform.deepseek.com
                      </a>
                      {' '}{t('settings.llm.keyHelpSuffix')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={handleSaveLLM}
              className={`apple-button text-sm flex items-center gap-2 ${llmSaveStatus === 'success' ? 'bg-apple-blue' : ''}`}
            >
              {llmSaveStatus === 'success' ? <Check size={14} /> : <Save size={14} />}
              {llmSaveStatus === 'success' ? t('settings.saved') : llmSaveStatus === 'error' ? t('settings.error') : t('settings.save')}
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
