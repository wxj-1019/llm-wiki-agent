import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useNotificationStore } from '@/stores/notificationStore';
import {
  Wrench, Play, Trash2, Plus, Power, PowerOff, FileText,
  Zap, LayoutTemplate, X, Loader2, Frown, Rocket,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SkillsSkeleton } from '@/components/ui/Skeleton';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

interface Skill {
  name: string;
  version: string;
  description: string;
  source: string;
  enabled: boolean;
  usage_count: number;
  last_used: string | null;
}

interface SkillTemplate {
  name: string;
  description: string;
  type: string;
}

export function SkillsPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('skills.title', 'Skill 管理'));
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<{ meta: Skill; files: Record<string, string> } | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<SkillTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);
  const [executeResult, setExecuteResult] = useState<{ name: string; result: unknown } | null>(null);
  const addNotification = useNotificationStore((s) => s.addNotification);

  useBodyScrollLock(showTemplates);

  const fetchSkills = useCallback(async () => {
    try {
      const res = await fetch('/api/skills/list');
      const data = await res.json();
      setSkills(data.skills || []);
    } catch (e) {
      setError(String(e));
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSkills();
    const interval = setInterval(() => fetchSkills(), 30000);
    return () => clearInterval(interval);
  }, [fetchSkills]);

  const action = useCallback(async (url: string, method: string = 'POST', name?: string) => {
    setLoading(true);
    try {
      const res = await fetch(url, { method });
      const data = await res.json();
      await fetchSkills();
      if (data.error) {
        addNotification(data.error, 'error');
      } else if (name) {
        addNotification(`${name} ${t('skills.action.success', '操作成功')}`, 'success');
      }
      return data;
    } catch (e) {
      setError(String(e));
      addNotification(String(e), 'error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchSkills, addNotification, t]);

  const executeSkill = useCallback(async (name: string) => {
    setExecuting(name);
    try {
      const res = await fetch(`/api/skills/execute/${name}`, { method: 'POST' });
      const data = await res.json();
      await fetchSkills();
      if (data.error) {
        addNotification(data.error, 'error');
      } else {
        setExecuteResult({ name, result: data });
        addNotification(t('skills.execute.success', { name }), 'success');
      }
    } catch (e) {
      addNotification(String(e), 'error');
    } finally {
      setExecuting(null);
    }
  }, [fetchSkills, addNotification, t]);

  const showDetail = async (name: string) => {
    try {
      const res = await fetch(`/api/skills/detail/${name}`);
      const data = await res.json();
      if (!data.error) setDetail(data);
    } catch (e) {
      setError(String(e));
    }
  };

  const loadTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const res = await fetch('/api/skills/templates');
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (e) {
      addNotification(String(e), 'error');
    } finally {
      setTemplatesLoading(false);
    }
  };

  const installTemplate = async (templateName: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/skills/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: templateName }),
      });
      const data = await res.json();
      await fetchSkills();
      if (data.error) {
        addNotification(data.error, 'error');
      } else {
        addNotification(t('skills.install.success', { name: templateName }), 'success');
      }
    } catch (e) {
      addNotification(String(e), 'error');
    } finally {
      setLoading(false);
    }
  };

  const openTemplates = () => {
    setShowTemplates(true);
    loadTemplates();
  };

  if (initialLoading) {
    return <SkillsSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wrench size={24} className="text-apple-blue" />
          <h1 className="text-2xl font-semibold">{t('skills.title', 'Skill 管理')}</h1>
        </div>
        <button
          onClick={openTemplates}
          className="apple-button flex items-center gap-2 text-sm"
        >
          <Plus size={14} />
          {t('skills.install', 'Install')}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 text-red-500 rounded-xl text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {skills.length === 0 && (
          <div className="empty-state-warm md:col-span-2 py-12">
            <Zap size={40} className="text-[var(--text-tertiary)] mb-3" />
            <h3 className="text-lg font-semibold mb-1">{t('skills.empty.title', 'No skills installed')}</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">{t('skills.empty.description', 'Install skills to extend your wiki agent capabilities.')}</p>
            <button onClick={openTemplates} className="apple-button text-xs">
              {t('skills.browseTemplates', 'Browse Templates')}
            </button>
          </div>
        )}
        {skills.map((s, i) => (
          <motion.div
            key={s.name}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`apple-card p-5 space-y-3 ${!s.enabled ? 'opacity-60' : ''}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="font-semibold truncate">{s.name}</h3>
                <span className="text-xs text-[var(--text-tertiary)] bg-[var(--bg-secondary)] px-2 py-0.5 rounded-full shrink-0">
                  v{s.version}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => executeSkill(s.name)}
                  disabled={!s.enabled || executing === s.name || loading}
                  className="p-2 rounded-xl transition-colors hover:bg-apple-blue/10 hover:text-apple-blue disabled:opacity-40"
                  title={t('skills.execute', 'Execute')}
                >
                  {executing === s.name ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                </button>
                <button
                  onClick={() => action(`/api/skills/${s.enabled ? 'disable' : 'enable'}/${s.name}`, 'POST', s.name)}
                  disabled={loading}
                  className={`p-2 rounded-xl transition-colors ${
                    s.enabled
                      ? 'hover:bg-red-500/10 hover:text-red-500'
                      : 'hover:bg-green-500/10 hover:text-green-500'
                  }`}
                  title={s.enabled ? t('skills.disable', '禁用') : t('skills.enable', '启用')}
                >
                  {s.enabled ? <PowerOff size={14} /> : <Power size={14} />}
                </button>
                <button
                  onClick={() => showDetail(s.name)}
                  className="p-2 hover:bg-[var(--bg-secondary)] rounded-xl transition-colors"
                  title={t('skills.detail', '详情')}
                >
                  <FileText size={14} />
                </button>
                <button
                  onClick={() => action(`/api/skills/uninstall/${s.name}`, 'DELETE', s.name)}
                  disabled={loading}
                  className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-xl transition-colors"
                  title={t('skills.uninstall', '卸载')}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">{s.description}</p>
            <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)] flex-wrap">
              <span>{t('skills.source', '来源')}: {s.source}</span>
              <span>{t('skills.usage', '使用')}: {s.usage_count}</span>
              {s.last_used && <span>{t('skills.lastUsed', '最近使用')}: {s.last_used}</span>}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Detail Panel */}
      <AnimatePresence>
        {detail && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="apple-card p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{detail.meta.name} {t('skills.detail', '详情')}</h3>
              <button onClick={() => setDetail(null)} className="p-1 hover:bg-[var(--bg-secondary)] rounded-lg transition-colors">
                <X size={14} />
              </button>
            </div>
            <div className="space-y-3">
              {Object.entries(detail.files).map(([fname, content]) => (
                <div key={fname}>
                  <h4 className="text-xs font-medium text-[var(--text-tertiary)] mb-1">{fname}</h4>
                  <pre className="text-xs bg-[var(--bg-secondary)] rounded-xl p-3 max-h-40 overflow-y-auto font-mono">
                    {content}
                  </pre>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Execute Result */}
      <AnimatePresence>
        {executeResult && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="apple-card p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Rocket size={16} className="text-apple-blue" />
                <h3 className="font-semibold">{executeResult.name} {t('skills.execute.result', 'Execution Result')}</h3>
              </div>
              <button onClick={() => setExecuteResult(null)} className="p-1 hover:bg-[var(--bg-secondary)] rounded-lg transition-colors">
                <X size={14} />
              </button>
            </div>
            <pre className="text-xs bg-[var(--bg-secondary)] rounded-xl p-3 max-h-60 overflow-y-auto font-mono">
              {JSON.stringify(executeResult.result, null, 2)}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Templates Modal */}
      <AnimatePresence>
        {showTemplates && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
            onClick={() => setShowTemplates(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-2xl shadow-2xl max-w-xl w-full max-h-[80vh] flex flex-col"
              role="dialog"
              aria-modal="true"
              aria-label={t('skills.templates', 'Skill Templates')}
            >
              <div className="flex items-center justify-between p-4 border-b border-[var(--border-default)]">
                <div className="flex items-center gap-2">
                  <LayoutTemplate size={18} className="text-apple-blue" />
                  <h2 className="font-semibold">{t('skills.templates', 'Skill Templates')}</h2>
                </div>
                <button
                  onClick={() => setShowTemplates(false)}
                  className="p-1 hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"
                  aria-label={t('common.close', '关闭')}
                >
                  <X size={16} />
                </button>
              </div>
              <div className="p-4 overflow-y-auto space-y-3">
                {templatesLoading ? (
                  <div className="flex flex-col items-center py-8 gap-2">
                    <Loader2 size={24} className="animate-spin text-apple-blue" />
                    <p className="text-sm text-[var(--text-secondary)]">{t('skills.loading', 'Loading...')}</p>
                  </div>
                ) : templates.length === 0 ? (
                  <div className="text-center py-8 text-[var(--text-secondary)]">
                    <Frown size={32} className="mx-auto mb-2" />
                    {t('skills.noTemplates', 'No templates available')}
                  </div>
                ) : (
                  templates.map((tmpl) => (
                    <div key={tmpl.name} className="apple-card p-4 flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{tmpl.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-tertiary)] uppercase">
                            {tmpl.type}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)]">{tmpl.description}</p>
                      </div>
                      <button
                        onClick={() => installTemplate(tmpl.name)}
                        disabled={loading}
                        className="apple-button text-xs shrink-0"
                      >
                        {t('skills.install', 'Install')}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
