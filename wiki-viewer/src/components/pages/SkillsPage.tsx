import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useNotificationStore } from '@/stores/notificationStore';
import { Wrench, Play, Trash2, Plus, Power, PowerOff, FileText } from 'lucide-react';
import { motion } from 'framer-motion';

interface Skill {
  name: string;
  version: string;
  description: string;
  source: string;
  enabled: boolean;
  usage_count: number;
  last_used: string | null;
}

export function SkillsPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('skills.title', 'Skill 管理'));
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<{ meta: Skill; files: Record<string, string> } | null>(null);
  const addNotification = useNotificationStore((s) => s.addNotification);

  const fetchSkills = useCallback(async () => {
    try {
      const res = await fetch('/api/skills/list');
      const data = await res.json();
      setSkills(data.skills || []);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const action = async (url: string, method: string = 'POST', name?: string) => {
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
    } catch (e) {
      setError(String(e));
      addNotification(String(e), 'error');
    } finally {
      setLoading(false);
    }
  };

  const showDetail = async (name: string) => {
    try {
      const res = await fetch(`/api/skills/detail/${name}`);
      const data = await res.json();
      if (!data.error) setDetail(data);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wrench size={24} className="text-apple-blue" />
          <h1 className="text-2xl font-semibold">{t('skills.title', 'Skill 管理')}</h1>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 text-red-500 rounded-xl text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {skills.length === 0 && (
          <div className="text-center py-12 text-[var(--text-secondary)] md:col-span-2">
            {t('skills.empty', '暂无已安装的 Skill')}
          </div>
        )}
        {skills.map((s) => (
          <motion.div
            key={s.name}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`glass rounded-2xl p-5 space-y-3 ${
              !s.enabled ? 'opacity-60' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{s.name}</h3>
                <span className="text-xs text-[var(--text-tertiary)] bg-[var(--bg-secondary)] px-2 py-0.5 rounded-full">
                  v{s.version}
                </span>
              </div>
              <div className="flex items-center gap-1">
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
            <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)]">
              <span>{t('skills.source', '来源')}: {s.source}</span>
              <span>{t('skills.usage', '使用')}: {s.usage_count}</span>
              {s.last_used && <span>{t('skills.lastUsed', '最近使用')}: {s.last_used}</span>}
            </div>
          </motion.div>
        ))}
      </div>

      {detail && (
        <div className="glass rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{detail.meta.name} {t('skills.detail', '详情')}</h3>
            <button onClick={() => setDetail(null)} className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
              {t('common.close', '关闭')}
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
        </div>
      )}
    </div>
  );
}
