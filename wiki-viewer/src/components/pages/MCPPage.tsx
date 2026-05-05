import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useNotificationStore } from '@/stores/notificationStore';
import { Server, Play, Square, RotateCcw, Trash2, Plus, Terminal, Activity, X, Package, Globe, FolderOpen, Wand2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MCPSkeleton } from '@/components/ui/Skeleton';

interface MCPServer {
  name: string;
  display_name: string;
  description: string;
  version: string;
  source: string;
  status: string;
  pid: number | null;
  tools: string[];
  installed_at: string;
  memory_mb?: number;
  cpu_percent?: number;
  uptime_sec?: number;
}

type InstallMethod = 'npm' | 'pip' | 'url' | 'local' | 'generate';

interface InstallFormData {
  method: InstallMethod;
  packageName: string;
  url: string;
  localPath: string;
  templateName: string;
  templateCategory: string;
}

const INITIAL_FORM: InstallFormData = {
  method: 'npm',
  packageName: '',
  url: '',
  localPath: '',
  templateName: '',
  templateCategory: 'rag',
};

function InstallWizard({
  open,
  onClose,
  onInstalled,
  t,
}: {
  open: boolean;
  onClose: () => void;
  onInstalled: () => void;
  t: (key: string, fallback: string) => string;
}) {
  useBodyScrollLock(open);
  const [form, setForm] = useState<InstallFormData>({ ...INITIAL_FORM });
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState('');
  const addNotification = useNotificationStore((s) => s.addNotification);

  const methods: { key: InstallMethod; icon: typeof Package; label: string }[] = [
    { key: 'npm', icon: Package, label: 'npm' },
    { key: 'pip', icon: Package, label: 'pip' },
    { key: 'url', icon: Globe, label: 'URL' },
    { key: 'local', icon: FolderOpen, label: t('mcp.install.local', '本地') },
    { key: 'generate', icon: Wand2, label: t('mcp.install.generate', '生成') },
  ];

  const handleInstall = async () => {
    setInstalling(true);
    setError('');
    try {
      if (form.method === 'generate') {
        const res = await fetch('/api/mcp/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: form.templateName.trim() || 'wiki-server', category: form.templateCategory }),
        });
        const data = await res.json();
        if (data.error) { setError(data.error); setInstalling(false); return; }
        addNotification(`${t('mcp.install.generated', '已生成')} ${data.name || form.templateName}`, 'success');
        onInstalled();
        onClose();
        setForm({ ...INITIAL_FORM });
        setInstalling(false);
        return;
      }

      let body: Record<string, string> = {};
      if (form.method === 'npm' || form.method === 'pip') {
        if (!form.packageName.trim()) { setError(t('mcp.install.nameRequired', '请输入包名')); setInstalling(false); return; }
        body = { source: form.method, name: form.packageName.trim() };
      } else if (form.method === 'url') {
        if (!form.url.trim()) { setError(t('mcp.install.urlRequired', '请输入 URL')); setInstalling(false); return; }
        body = { source: 'url', url: form.url.trim() };
      } else if (form.method === 'local') {
        if (!form.localPath.trim()) { setError(t('mcp.install.pathRequired', '请输入路径')); setInstalling(false); return; }
        body = { source: 'local', path: form.localPath.trim() };
      }

      const res = await fetch('/api/mcp/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        addNotification(`${data.name || form.packageName} ${t('mcp.install.success', '安装成功')}`, 'success');
        onInstalled();
        onClose();
        setForm({ ...INITIAL_FORM });
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setInstalling(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="relative glass rounded-2xl p-6 w-full max-w-lg space-y-5 z-10"
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            role="dialog"
            aria-modal="true"
            aria-label={t('mcp.install.title', '安装 MCP Server')}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('mcp.install.title', '安装 MCP Server')}</h2>
              <button onClick={onClose} className="p-1 hover:bg-[var(--bg-secondary)] rounded-lg transition-colors" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="flex gap-2 flex-wrap">
              {methods.map((m) => (
                <button
                  key={m.key}
                  onClick={() => { setForm((f) => ({ ...f, method: m.key })); setError(''); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm transition-all ${
                    form.method === m.key
                      ? 'bg-[var(--accent)] text-white shadow-sm'
                      : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]'
                  }`}
                >
                  <m.icon size={14} />
                  {m.label}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {(form.method === 'npm' || form.method === 'pip') && (
                <div>
                  <label className="text-sm text-[var(--text-secondary)] mb-1 block">
                    {form.method === 'npm' ? 'npm' : 'PyPI'} {t('mcp.install.packageName', '包名')}
                  </label>
                  <input
                    type="text"
                    value={form.packageName}
                    onChange={(e) => setForm((f) => ({ ...f, packageName: e.target.value }))}
                    placeholder={form.method === 'npm' ? '@modelcontextprotocol/server-filesystem' : 'mcp-server-fetch'}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] focus:border-[var(--accent)] focus:outline-none text-sm"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleInstall()}
                  />
                </div>
              )}
              {form.method === 'url' && (
                <div>
                  <label className="text-sm text-[var(--text-secondary)] mb-1 block">{t('mcp.install.serverUrl', '服务器 URL')}</label>
                  <input
                    type="text"
                    value={form.url}
                    onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                    placeholder="https://example.com/mcp"
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] focus:border-[var(--accent)] focus:outline-none text-sm"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleInstall()}
                  />
                </div>
              )}
              {form.method === 'local' && (
                <div>
                  <label className="text-sm text-[var(--text-secondary)] mb-1 block">{t('mcp.install.filePath', '文件路径')}</label>
                  <input
                    type="text"
                    value={form.localPath}
                    onChange={(e) => setForm((f) => ({ ...f, localPath: e.target.value }))}
                    placeholder="/path/to/server.py"
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] focus:border-[var(--accent)] focus:outline-none text-sm"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleInstall()}
                  />
                </div>
              )}
              {form.method === 'generate' && (
                <>
                  <div>
                    <label className="text-sm text-[var(--text-secondary)] mb-1 block">{t('mcp.install.serverName', '服务器名称')}</label>
                    <input
                      type="text"
                      value={form.templateName}
                      onChange={(e) => setForm((f) => ({ ...f, templateName: e.target.value }))}
                      placeholder="wiki-server"
                      className="w-full px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] focus:border-[var(--accent)] focus:outline-none text-sm"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-sm text-[var(--text-secondary)] mb-1 block">{t('mcp.install.category', '类别')}</label>
                    <div className="flex gap-2">
                      {(['rag', 'agent', 'utility'] as const).map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, templateCategory: cat }))}
                          className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                            form.templateCategory === cat
                              ? 'bg-[var(--accent)] text-white shadow-sm'
                              : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]'
                          }`}
                        >
                          {cat === 'rag' ? 'RAG' : cat === 'agent' ? 'Agent' : 'Utility'}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 text-red-500 rounded-xl text-sm">{error}</div>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="btn-secondary px-4 py-2 text-sm">
                {t('common.close', '取消')}
              </button>
              <button
                onClick={handleInstall}
                disabled={installing}
                className="btn-primary px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-50"
              >
                {installing ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {installing ? t('mcp.installing', '安装中...') : t('mcp.install.action', '安装')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function MCPPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('mcp.title', 'MCP 管理'));
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [actioningServer, setActioningServer] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [logName, setLogName] = useState('');
  const [showInstallWizard, setShowInstallWizard] = useState(false);
  const addNotification = useNotificationStore((s) => s.addNotification);

  const fetchServers = useCallback(async () => {
    try {
      const res = await fetch('/api/mcp/list');
      const data = await res.json();
      setServers(data.servers || []);
    } catch (e) {
      setError(String(e));
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServers();
    const id = setInterval(fetchServers, 10000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchServers();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchServers]);

  const action = useCallback(async (url: string, method: string = 'POST', name?: string) => {
    setLoading(true);
    if (name) setActioningServer(name);
    try {
      const res = await fetch(url, { method });
      const data = await res.json();
      await fetchServers();
      if (data.error) {
        addNotification(data.error, 'error');
      } else if (name) {
        addNotification(`${name} ${t('mcp.action.success', '操作成功')}`, 'success');
      }
    } catch (e) {
      setError(String(e));
      addNotification(String(e), 'error');
    } finally {
      setLoading(false);
      setActioningServer(null);
    }
  }, [fetchServers, addNotification, t]);

  const showLogs = async (name: string) => {
    setLogName(name);
    try {
      const res = await fetch(`/api/mcp/logs/${name}?lines=50`);
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (e) {
      setLogs([String(e)]);
    }
  };

  if (initialLoading) {
    return <MCPSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Server size={24} className="text-apple-blue" />
          <h1 className="text-2xl font-semibold">{t('mcp.title', 'MCP 管理')}</h1>
        </div>
        <button
          onClick={() => setShowInstallWizard(true)}
          className="btn-primary text-sm flex items-center gap-2"
        >
          <Plus size={14} />
          {t('mcp.action.install', '安装 Server')}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 text-red-500 rounded-xl text-sm">{error}</div>
      )}

      <div className="grid gap-4">
        {servers.length === 0 && (
          <div className="empty-state-warm py-12">
            <div className="flex justify-center mb-3">
              <Server size={40} className="text-[var(--text-tertiary)]" />
            </div>
            <h3 className="text-lg font-semibold mb-1">{t('mcp.empty', '暂无已安装的 MCP Server')}</h3>
          </div>
        )}
        {servers.map((s) => (
          <motion.div
            key={s.name}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    s.status === 'running' ? 'bg-emerald-500' : 'bg-[var(--text-tertiary)]'
                  }`}
                />
                <h3 className="font-semibold">{s.display_name || s.name}</h3>
                <span className="text-xs text-[var(--text-tertiary)] bg-[var(--bg-secondary)] px-2 py-0.5 rounded-full">
                  v{s.version}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {s.status !== 'running' ? (
                  <button
                    onClick={() => action(`/api/mcp/start/${s.name}`, 'POST', s.display_name || s.name)}
                    disabled={actioningServer === s.name}
                    className="p-2 hover:bg-green-500/10 hover:text-green-500 rounded-xl transition-colors disabled:opacity-50"
                    title={t('mcp.start', '启动')}
                  >
                    <Play size={14} />
                  </button>
                ) : (
                  <button
                    onClick={() => action(`/api/mcp/stop/${s.name}`, 'POST', s.display_name || s.name)}
                    disabled={actioningServer === s.name}
                    className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-xl transition-colors disabled:opacity-50"
                    title={t('mcp.stop', '停止')}
                  >
                    <Square size={14} />
                  </button>
                )}
                <button
                  onClick={() => action(`/api/mcp/restart/${s.name}`, 'POST', s.display_name || s.name)}
                  disabled={actioningServer === s.name}
                  className="p-2 hover:bg-apple-blue/10 hover:text-apple-blue rounded-xl transition-colors disabled:opacity-50"
                  title={t('mcp.restart', '重启')}
                >
                  <RotateCcw size={14} />
                </button>
                <button
                  onClick={() => showLogs(s.name)}
                  className="p-2 hover:bg-[var(--bg-secondary)] rounded-xl transition-colors"
                  title={t('mcp.logs', '日志')}
                >
                  <Terminal size={14} />
                </button>
                <button
                  onClick={() => action(`/api/mcp/uninstall/${s.name}`, 'DELETE', s.display_name || s.name)}
                  disabled={actioningServer === s.name}
                  className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-xl transition-colors disabled:opacity-50"
                  title={t('mcp.uninstall', '卸载')}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">{s.description}</p>
            <div className="flex items-center gap-4 text-xs text-[var(--text-tertiary)]">
              <span className="flex items-center gap-1">
                <Activity size={12} />
                {s.status === 'running' ? `PID: ${s.pid}` : t('mcp.stopped', '已停止')}
              </span>
              {s.status === 'running' && s.memory_mb !== undefined && (
                <span>{s.memory_mb} MB</span>
              )}
              {s.status === 'running' && s.cpu_percent !== undefined && (
                <span>CPU {s.cpu_percent}%</span>
              )}
              <span>{t('mcp.source', '来源')}: {s.source}</span>
              {s.tools.length > 0 && (
                <span>{s.tools.length} {t('mcp.tools', '个工具')}</span>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {logName && (
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Terminal size={14} />
              {logName} {t('mcp.logs', '日志')}
            </h3>
            <button onClick={() => setLogName('')} className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
              {t('common.close', '关闭')}
            </button>
          </div>
          <pre className="text-xs bg-[var(--bg-secondary)] rounded-xl p-3 max-h-60 overflow-y-auto font-mono">
            {logs.length > 0 ? logs.join('\n') : t('mcp.noLogs', '暂无日志')}
          </pre>
        </div>
      )}

      <InstallWizard
        open={showInstallWizard}
        onClose={() => setShowInstallWizard(false)}
        onInstalled={fetchServers}
        t={t}
      />
    </div>
  );
}
