import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useNotificationStore } from '@/stores/notificationStore';
import { Server, Play, Square, RotateCcw, Trash2, Plus, Terminal, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import { MCPPageSkeleton } from '@/components/ui/Skeleton';

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
  const addNotification = useNotificationStore((s) => s.addNotification);

  const fetchServers = useCallback(async () => {
    try {
      const res = await fetch('/api/mcp/list');
      const data = await res.json();
      setServers(data.servers || []);
    } catch (e) {
      setError(String(e));
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Server size={24} className="text-apple-blue" />
          <h1 className="text-2xl font-semibold">{t('mcp.title', 'MCP 管理')}</h1>
        </div>
        <button
          onClick={() => addNotification(t('mcp.comingSoon', '安装功能即将推出，请手动将 server.py 放入 mcp-servers/ 目录'), 'info')}
          disabled={loading}
          className="apple-button text-sm flex items-center gap-2 disabled:opacity-50"
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
                    aria-label={t('mcp.start', '启动')}
                  >
                    <Play size={14} />
                  </button>
                ) : (
                  <button
                    onClick={() => action(`/api/mcp/stop/${s.name}`, 'POST', s.display_name || s.name)}
                    disabled={actioningServer === s.name}
                    className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-xl transition-colors disabled:opacity-50"
                    title={t('mcp.stop', '停止')}
                    aria-label={t('mcp.stop', '停止')}
                  >
                    <Square size={14} />
                  </button>
                )}
                <button
                  onClick={() => action(`/api/mcp/restart/${s.name}`, 'POST', s.display_name || s.name)}
                  disabled={actioningServer === s.name}
                  className="p-2 hover:bg-apple-blue/10 hover:text-apple-blue rounded-xl transition-colors disabled:opacity-50"
                  title={t('mcp.restart', '重启')}
                  aria-label={t('mcp.restart', '重启')}
                >
                  <RotateCcw size={14} />
                </button>
                <button
                  onClick={() => showLogs(s.name)}
                  className="p-2 hover:bg-[var(--bg-secondary)] rounded-xl transition-colors"
                  title={t('mcp.logs', '日志')}
                  aria-label={t('mcp.logs', '日志')}
                >
                  <Terminal size={14} />
                </button>
                <button
                  onClick={() => action(`/api/mcp/uninstall/${s.name}`, 'DELETE', s.display_name || s.name)}
                  disabled={actioningServer === s.name}
                  className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-xl transition-colors disabled:opacity-50"
                  title={t('mcp.uninstall', '卸载')}
                  aria-label={t('mcp.uninstall', '卸载')}
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
                <span>
                  {s.tools.length} {t('mcp.tools', '个工具')}
                </span>
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
    </div>
  );
}
